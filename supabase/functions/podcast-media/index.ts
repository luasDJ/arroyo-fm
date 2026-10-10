import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const bucketName = "radio-podcasts";
const podcastPathPattern = /^podcasts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|mp4)$/i;
const podcastIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const storageClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function callAdminRpc(code: string, action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await adminClient.rpc("admin_action", {
    p_code: code,
    p_action: action,
    p_payload: payload
  });
  if (error) {
    if (error.message.includes("Invalid admin code")) {
      throw new Error("Código incorrecto.");
    }
    if (error.message.includes("Admin code is not configured")) {
      throw new Error("El código de administrador aún no está configurado en Supabase.");
    }
    throw new Error("No se pudo validar la operación en Supabase.");
  }
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond(405, { error: "Método no permitido." });
  }

  try {
    const input = await request.json();
    const code = typeof input.code === "string" ? input.code : "";
    const action = typeof input.action === "string" ? input.action : "";
    if (!code || code.length > 256) {
      return respond(400, { error: "Introduce el código de administrador." });
    }
    await callAdminRpc(code, "verify");

    if (action === "create-upload") {
      const mediaType = input.mediaType;
      if (mediaType !== "audio/mpeg" && mediaType !== "video/mp4") {
        return respond(400, { error: "El archivo debe ser MP3 o MP4." });
      }

      const extension = mediaType === "audio/mpeg" ? "mp3" : "mp4";
      const mediaPath = `podcasts/${crypto.randomUUID()}.${extension}`;
      const { data, error } = await storageClient.storage
        .from(bucketName)
        .createSignedUploadUrl(mediaPath);
      if (error) {
        throw new Error("No se pudo preparar la subida en Supabase Storage.");
      }
      return respond(200, { path: data.path, token: data.token });
    }

    if (action === "cleanup") {
      const mediaPath = typeof input.mediaPath === "string" ? input.mediaPath : "";
      if (!podcastPathPattern.test(mediaPath)) {
        return respond(400, { error: "Ruta de archivo no válida." });
      }

      const { error } = await storageClient.storage.from(bucketName).remove([mediaPath]);
      if (error) {
        throw new Error("No se pudo eliminar el archivo temporal.");
      }
      return respond(200, { ok: true });
    }

    if (action === "delete") {
      const id = typeof input.id === "string" ? input.id : "";
      if (!podcastIdPattern.test(id)) {
        return respond(400, { error: "Podcast no válido." });
      }

      const deletedPodcast = await callAdminRpc(code, "delete_podcast", { id });
      const mediaPath = deletedPodcast?.media_path;
      if (typeof mediaPath !== "string" || !podcastPathPattern.test(mediaPath)) {
        throw new Error("Se eliminó el podcast, pero la ruta de su archivo no es válida.");
      }

      const { error } = await storageClient.storage.from(bucketName).remove([mediaPath]);
      if (error) {
        throw new Error("El podcast se eliminó, pero no se pudo borrar el archivo de Supabase Storage.");
      }
      return respond(200, { ok: true });
    }

    return respond(400, { error: "Operación no reconocida." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al procesar el archivo.";
    console.error("podcast-media:", message);
    return respond(400, { error: message });
  }
});
