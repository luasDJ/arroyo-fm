
const SUPABASE_URL = "https://gixdaycfpnijlvlzfvny.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_h2CWl2ydWgI3safRUcYmxg_ffIDzs3h";

const $ = (selector) => document.querySelector(selector);

let accessToken = null;

async function supabaseRequest(path, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
}

// Iniciar sesión
$("#loginBtn").addEventListener("click", async () => {
  const email = $("#email").value.trim();
  const password = $("#password").value;

  $("#loginError").textContent = "Iniciando sesión...";

  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || "No se pudo iniciar sesión");
    }

    accessToken = data.access_token;

    $("#loginBox").classList.add("hidden");
    $("#settingsBox").classList.remove("hidden");
    $("#loginError").textContent = "";

    await loadSettings();
  } catch (error) {
    $("#loginError").textContent = error.message;
  }
});

// Cargar configuración
async function loadSettings() {
  const response = await supabaseRequest(
    "/rest/v1/radio_config?select=mode,gocast_url,gocast_type&limit=1"
  );

  const data = await response.json();

  if (!response.ok || !data.length) {
    $("#saveMessage").textContent = "No se pudo cargar la configuración.";
    return;
  }

  $("#mode").value = data[0].mode || "caster";
  $("#gocastUrl").value = data[0].gocast_url || "";
  $("#gocastType").value = data[0].gocast_type || "link";
}

// Guardar configuración
$("#saveBtn").addEventListener("click", async () => {
  const config = {
    mode: $("#mode").value,
    gocast_url: $("#gocastUrl").value.trim(),
    gocast_type: $("#gocastType").value,
    updated_at: new Date().toISOString()
  };

  $("#saveMessage").textContent = "Guardando...";

  try {
    const response = await supabaseRequest(
      "/rest/v1/radio_config?id=eq.1",
      {
        method: "PATCH",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify(config)
      }
    );

    if (!response.ok) {
      throw new Error("No se pudo guardar la configuración.");
    }

    $("#saveMessage").textContent =
      "✅ Configuración guardada para todos los visitantes.";
  } catch (error) {
    $("#saveMessage").textContent = `❌ ${error.message}`;
  }
});

// Cerrar sesión
$("#logoutBtn").addEventListener("click", async () => {
  if (accessToken) {
    await supabaseRequest("/auth/v1/logout", {
      method: "POST"
    });
  }

  accessToken = null;

  $("#settingsBox").classList.add("hidden");
  $("#loginBox").classList.remove("hidden");
  $("#password").value = "";
});