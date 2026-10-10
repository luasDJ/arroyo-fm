
const STORAGE_KEYS = {
  config: "arroyofm_config",
  events: "arroyofm_events",
  announcements: "arroyofm_announcements"
};

const DEFAULTS = {
  mode: "caster",
  gocastUrl: "",
  gocastType: "link"
};

let supabaseClient;
let adminCode = "";

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = (window.SUPABASE_URL || "").trim();
  const key = (window.SUPABASE_ANON_KEY || "").trim();

  if (!url || !key || !window.supabase) {
    return null;
  }

  supabaseClient = window.supabase.createClient(url, key);
  return supabaseClient;
}

function isSupabaseConfigured() {
  return Boolean(getSupabaseClient());
}

const DEFAULT_EVENTS = [];
const DEFAULT_ANNOUNCEMENTS = [];
const DEFAULT_PODCASTS = [];
const MAX_PODCAST_SIZE = 100 * 1024 * 1024;

const $ = (selector) => document.querySelector(selector);
const accessPanel = $("#accessPanel");
const settingsPanel = $("#settingsPanel");
const contentPanel = $("#contentPanel");
const accessForm = $("#accessForm");
const adminCodeInput = $("#adminCode");
const accessMessage = $("#accessMessage");
const signOutButton = $("#signOutBtn");
const modeInput = $("#mode");
const urlInput = $("#gocastUrl");
const typeInput = $("#gocastType");
const saveButton = $("#saveBtn");
const message = $("#saveMessage");
const eventTitleInput = $("#eventTitle");
const eventDateInput = $("#eventDate");
const eventDescriptionInput = $("#eventDescription");
const eventMessage = $("#eventMessage");
const eventList = $("#eventList");
const announcementTitleInput = $("#announcementTitle");
const announcementTextInput = $("#announcementText");
const announcementMessage = $("#announcementMessage");
const announcementList = $("#announcementList");
const podcastTitleInput = $("#podcastTitle");
const podcastFileInput = $("#podcastFile");
const addPodcastButton = $("#addPodcastBtn");
const podcastMessage = $("#podcastMessage");
const podcastList = $("#podcastList");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `notice ${type}`.trim();
}

function showAccessMessage(text, type = "") {
  accessMessage.textContent = text;
  accessMessage.className = `notice ${type}`.trim();
}

function closeSettings() {
  adminCode = "";
  adminCodeInput.value = "";
  accessPanel.classList.remove("hidden");
  settingsPanel.classList.add("hidden");
  settingsPanel.setAttribute("aria-hidden", "true");
  contentPanel.classList.add("hidden");
  contentPanel.setAttribute("aria-hidden", "true");
}

async function callAdminRpc(action, payload = {}) {
  const supabase = getSupabaseClient();

  if (!supabase || !adminCode) {
    throw new Error("Introduce de nuevo el código de administrador.");
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabase.rpc("admin_action", {
      p_code: adminCode,
      p_action: action,
      p_payload: payload
    }));
  } catch {
    throw new Error("No se pudo conectar con Supabase. Comprueba la conexión e inténtalo de nuevo.");
  }

  if (error) {
    if (error.message.includes("Invalid admin code")) {
      throw new Error("Código incorrecto.");
    }
    if (error.message.includes("Admin code is not configured")) {
      throw new Error("El código de administrador aún no está configurado en Supabase.");
    }
    throw new Error("No se pudo completar la operación. Comprueba que ejecutaste el SQL actualizado en Supabase.");
  }

  return data;
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readStoredCollection(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key);

    if (!storedValue) {
      return fallback;
    }

    const parsed = JSON.parse(storedValue);
    return parsed !== null ? parsed : fallback;
  } catch (error) {
    console.warn("No se pudo leer localStorage:", error);
    return fallback;
  }
}

async function fetchRemoteConfig() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return readStoredCollection(STORAGE_KEYS.config, DEFAULTS);
  }

  const { data, error } = await supabase
    .from("radio_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return readStoredCollection(STORAGE_KEYS.config, DEFAULTS);
  }

  return data;
}

async function fetchRemoteCollection(tableName, fallback) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return readStoredCollection(tableName, fallback);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return fallback;
  }

  return data;
}

async function loadOrMigrateCollection(tableName, storageKey) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from(tableName).select("*");

  if (error || !Array.isArray(data)) {
    const messageElement = tableName === "radio_events" ? eventMessage : announcementMessage;
    messageElement.textContent = "No se pudo leer el contenido de Supabase.";
    messageElement.className = "notice error";
    return [];
  }

  if (data.length) {
    return data;
  }

  const localItems = readStoredCollection(storageKey, []);
  const itemsToMigrate = Array.isArray(localItems)
    ? localItems
      .filter((item) => item && !String(item.id || "").startsWith("default-"))
      .map((item) => tableName === "radio_events"
        ? {
            title: item.title,
            date: item.date,
            description: item.description || "",
            created_at: item.created_at || new Date().toISOString()
          }
        : {
            title: item.title,
            text: item.text,
            created_at: item.created_at || new Date().toISOString()
          })
    : [];

  if (!itemsToMigrate.length) {
    return data;
  }

  let migratedItems;
  try {
    migratedItems = await callAdminRpc("migrate_collection", {
      table: tableName,
      items: itemsToMigrate
    });
  } catch (error) {
    console.warn(`No se pudo migrar el contenido local de ${tableName}:`, error);
    const messageElement = tableName === "radio_events" ? eventMessage : announcementMessage;
    messageElement.textContent = "No se pudo importar el contenido local a Supabase.";
    messageElement.className = "notice error";
    return data;
  }

  if (!Array.isArray(migratedItems)) {
    const messageElement = tableName === "radio_events" ? eventMessage : announcementMessage;
    messageElement.textContent = "Supabase devolvió una respuesta no válida al importar el contenido.";
    messageElement.className = "notice error";
    return data;
  }

  persistCollection(storageKey, migratedItems);
  return migratedItems;
}

function persistCollection(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatEventDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function renderAdminEvents(events = readStoredCollection(STORAGE_KEYS.events, DEFAULT_EVENTS)) {
  if (!eventList) return;

  if (!events.length) {
    eventList.innerHTML = "<p class=\"empty-state\">No hay eventos guardados.</p>";
    return;
  }

  eventList.innerHTML = events
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(
      (event) => `
        <div class="admin-item">
          <div>
            <strong>${escapeText(event.title)}</strong>
            <small>${escapeText(formatEventDate(event.date))}</small>
            <p>${escapeText(event.description || "Sin descripción.")}</p>
          </div>
          <button type="button" class="danger-button" data-delete-event="${escapeText(event.id)}">Eliminar</button>
        </div>
      `
    )
    .join("");
}

function renderAdminAnnouncements(announcements = readStoredCollection(STORAGE_KEYS.announcements, DEFAULT_ANNOUNCEMENTS)) {
  if (!announcementList) return;

  if (!announcements.length) {
    announcementList.innerHTML = "<p class=\"empty-state\">No hay anuncios publicados.</p>";
    return;
  }

  announcementList.innerHTML = announcements
    .slice()
    .reverse()
    .map(
      (announcement) => `
        <div class="admin-item">
          <div>
            <strong>${escapeText(announcement.title)}</strong>
            <p>${escapeText(announcement.text)}</p>
          </div>
          <button type="button" class="danger-button" data-delete-announcement="${escapeText(announcement.id)}">Eliminar</button>
        </div>
      `
    )
    .join("");
}

async function loadStoredContent() {
  if (!getSupabaseClient()) {
    renderAdminEvents([]);
    renderAdminAnnouncements([]);
    renderAdminPodcasts([]);
    eventMessage.textContent = "No hay conexión con Supabase; los cambios no se pueden compartir.";
    eventMessage.className = "notice error";
    announcementMessage.textContent = eventMessage.textContent;
    announcementMessage.className = "notice error";
    podcastMessage.textContent = eventMessage.textContent;
    podcastMessage.className = "notice error";
    return;
  }

  const events = await loadOrMigrateCollection("radio_events", STORAGE_KEYS.events);
  const announcements = await loadOrMigrateCollection("radio_announcements", STORAGE_KEYS.announcements);

  renderAdminEvents(events);
  renderAdminAnnouncements(announcements);
  await loadAdminPodcasts();
}

function renderAdminPodcasts(podcasts = DEFAULT_PODCASTS) {
  if (!podcastList) return;

  if (!podcasts.length) {
    podcastList.innerHTML = "<p class=\"empty-state\">No hay podcasts publicados.</p>";
    return;
  }

  podcastList.innerHTML = podcasts
    .map((podcast) => `
      <div class="admin-item">
        <div>
          <strong>${escapeText(podcast.title)}</strong>
          <small>${podcast.media_type === "video/mp4" ? "Vídeo MP4" : "Audio MP3"}</small>
        </div>
        <button type="button" class="danger-button" data-delete-podcast="${escapeText(podcast.id)}">Eliminar</button>
      </div>
    `)
    .join("");
}

async function loadAdminPodcasts() {
  const { data, error } = await getSupabaseClient()
    .from("radio_podcasts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    renderAdminPodcasts([]);
    podcastMessage.textContent = "No se pudieron cargar los podcasts. Comprueba que ejecutaste el SQL actualizado en Supabase.";
    podcastMessage.className = "notice error";
    return;
  }

  renderAdminPodcasts(Array.isArray(data) ? data : []);
}

async function callPodcastFunction(action, payload = {}) {
  const supabase = getSupabaseClient();
  if (!supabase || !adminCode) {
    throw new Error("Introduce de nuevo el código de administrador.");
  }

  const { data, error } = await supabase.functions.invoke("podcast-media", {
    body: { action, code: adminCode, ...payload }
  });

  if (error) {
    if (error.context instanceof Response) {
      const response = await error.context.json();
      if (typeof response.error === "string") {
        throw new Error(response.error);
      }
    }
    throw new Error(error.message || "No se pudo completar la operación de archivos.");
  }

  return data;
}

function notifyContentRefresh() {
  window.dispatchEvent(new CustomEvent("arroyofm:refresh"));
}

function openSettings() {
  accessPanel.classList.add("hidden");
  settingsPanel.classList.remove("hidden");
  settingsPanel.setAttribute("aria-hidden", "false");
  contentPanel.classList.remove("hidden");
  contentPanel.setAttribute("aria-hidden", "false");
  loadSettings();
  loadStoredContent();
}

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!getSupabaseClient()) {
    showAccessMessage("No hay conexión con Supabase; no se puede validar el código.", "error");
    return;
  }

  adminCode = adminCodeInput.value;
  try {
    await callAdminRpc("verify");
  } catch (error) {
    adminCode = "";
    showAccessMessage(error.message || "Código incorrecto o servicio no disponible.", "error");
    return;
  }

  adminCodeInput.value = "";
  showAccessMessage("");
  openSettings();
});

signOutButton.addEventListener("click", async () => {
  closeSettings();
  showAccessMessage("Sesión cerrada.", "success");
});

if (!getSupabaseClient()) {
  showAccessMessage("Configura la conexión con Supabase para validar el código.", "error");
}

async function loadSettings() {
  const config = isSupabaseConfigured()
    ? await fetchRemoteConfig()
    : readStoredCollection(STORAGE_KEYS.config, DEFAULTS) || DEFAULTS;
  const normalizedConfig = typeof config === "object" ? config : {};

  modeInput.value = normalizedConfig.mode === "gocast" ? "gocast" : "caster";
  urlInput.value = normalizedConfig.gocastUrl || normalizedConfig.gocast_url || "";
  typeInput.value = normalizedConfig.gocastType === "iframe" || normalizedConfig.gocast_type === "iframe" ? "iframe" : "link";
}

saveButton.addEventListener("click", async () => {
  const gocastUrl = urlInput.value.trim();

  if (modeInput.value === "gocast") {
    if (!gocastUrl) {
      showMessage("Introduce una URL de GoCast para activar el AutoDJ.", "error");
      urlInput.focus();
      return;
    }

    try {
      new URL(gocastUrl);
    } catch {
      showMessage("La URL de GoCast no tiene un formato válido.", "error");
      urlInput.focus();
      return;
    }
  }

  const config = {
    id: 1,
    mode: modeInput.value,
    gocast_url: gocastUrl,
    gocast_type: typeInput.value,
    updated_at: new Date().toISOString()
  };

  try {
    await callAdminRpc("save_config", { config });
  } catch (error) {
    showMessage(error.message || "No se pudo guardar la configuración en Supabase.", "error");
    return;
  }

  persistCollection(STORAGE_KEYS.config, {
    mode: modeInput.value,
    gocastUrl,
    gocastType: typeInput.value
  });
  notifyContentRefresh();
  showMessage("Guardado. El cambio se aplicará en todos los navegadores con acceso a la misma base.", "success");
});

document.getElementById("addEventBtn").addEventListener("click", async () => {
  const title = eventTitleInput.value.trim();
  const date = eventDateInput.value;
  const description = eventDescriptionInput.value.trim();

  if (!title || !date) {
    eventMessage.textContent = "Completa el título y la fecha del evento.";
    eventMessage.className = "notice error";
    return;
  }

  const payload = {
    title,
    date,
    description,
    created_at: new Date().toISOString()
  };

  try {
    await callAdminRpc("insert_event", { event: payload });
  } catch (error) {
    eventMessage.textContent = error.message || "No se pudo guardar el evento en Supabase.";
    eventMessage.className = "notice error";
    return;
  }

  await loadStoredContent();
  notifyContentRefresh();
  eventMessage.textContent = "Evento guardado correctamente.";
  eventMessage.className = "notice success";
  eventTitleInput.value = "";
  eventDateInput.value = "";
  eventDescriptionInput.value = "";
});

document.getElementById("addAnnouncementBtn").addEventListener("click", async () => {
  const title = announcementTitleInput.value.trim();
  const text = announcementTextInput.value.trim();

  if (!title || !text) {
    announcementMessage.textContent = "Completa el título y el texto del anuncio.";
    announcementMessage.className = "notice error";
    return;
  }

  const payload = {
    title,
    text,
    created_at: new Date().toISOString()
  };

  try {
    await callAdminRpc("insert_announcement", { announcement: payload });
  } catch (error) {
    announcementMessage.textContent = error.message || "No se pudo guardar el anuncio en Supabase.";
    announcementMessage.className = "notice error";
    return;
  }

  await loadStoredContent();
  notifyContentRefresh();
  announcementMessage.textContent = "Anuncio publicado.";
  announcementMessage.className = "notice success";
  announcementTitleInput.value = "";
  announcementTextInput.value = "";
});

document.getElementById("addPodcastBtn").addEventListener("click", async () => {
  const title = podcastTitleInput.value.trim();
  const file = podcastFileInput.files[0];

  if (!title || !file) {
    podcastMessage.textContent = "Completa el título y selecciona un archivo MP3 o MP4.";
    podcastMessage.className = "notice error";
    return;
  }
  if (title.length > 120) {
    podcastMessage.textContent = "El título no puede superar los 120 caracteres.";
    podcastMessage.className = "notice error";
    return;
  }
  if (file.size > MAX_PODCAST_SIZE) {
    podcastMessage.textContent = "El archivo supera el tamaño máximo de 100 MB.";
    podcastMessage.className = "notice error";
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const mediaType = extension === "mp3" ? "audio/mpeg" : extension === "mp4" ? "video/mp4" : "";
  if (!mediaType || (file.type && file.type !== mediaType)) {
    podcastMessage.textContent = "El archivo debe ser un MP3 de audio o un MP4 de vídeo.";
    podcastMessage.className = "notice error";
    return;
  }

  addPodcastButton.disabled = true;
  podcastMessage.textContent = "Subiendo y publicando el archivo…";
  podcastMessage.className = "notice";

  let mediaPath;
  try {
    const uploadTicket = await callPodcastFunction("create-upload", { mediaType });
    mediaPath = uploadTicket.path;

    const { error: uploadError } = await getSupabaseClient()
      .storage
      .from("radio-podcasts")
      .uploadToSignedUrl(mediaPath, uploadTicket.token, file, {
        contentType: mediaType,
        upsert: false
      });
    if (uploadError) {
      throw new Error("No se pudo subir el archivo a Supabase Storage.");
    }

    await callAdminRpc("insert_podcast", {
      podcast: { title, media_path: mediaPath, media_type: mediaType }
    });
  } catch (error) {
    if (mediaPath) {
      try {
        await callPodcastFunction("cleanup", { mediaPath });
      } catch (cleanupError) {
        console.error("No se pudo limpiar el archivo de podcast tras un error:", cleanupError);
        podcastMessage.textContent = `${error.message || "No se pudo publicar el podcast."} El archivo temporal no se pudo eliminar.`;
        podcastMessage.className = "notice error";
        return;
      }
    }
    podcastMessage.textContent = error.message || "No se pudo publicar el podcast.";
    podcastMessage.className = "notice error";
    return;
  } finally {
    addPodcastButton.disabled = false;
  }

  podcastTitleInput.value = "";
  podcastFileInput.value = "";
  podcastMessage.textContent = "Podcast publicado correctamente.";
  podcastMessage.className = "notice success";
  await loadAdminPodcasts();
  notifyContentRefresh();
});

eventList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-event]");

  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteEvent;
  try {
    await callAdminRpc("delete_event", { id });
  } catch (error) {
    eventMessage.textContent = error.message || "No se pudo borrar el evento en Supabase.";
    eventMessage.className = "notice error";
    return;
  }

  await loadStoredContent();
  notifyContentRefresh();
  eventMessage.textContent = "Evento eliminado.";
  eventMessage.className = "notice success";
});

announcementList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-announcement]");

  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteAnnouncement;
  try {
    await callAdminRpc("delete_announcement", { id });
  } catch (error) {
    announcementMessage.textContent = error.message || "No se pudo borrar el anuncio en Supabase.";
    announcementMessage.className = "notice error";
    return;
  }

  await loadStoredContent();
  notifyContentRefresh();
  announcementMessage.textContent = "Anuncio eliminado.";
  announcementMessage.className = "notice success";
});

podcastList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-podcast]");

  if (!deleteButton) return;

  try {
    await callPodcastFunction("delete", { id: deleteButton.dataset.deletePodcast });
  } catch (error) {
    await loadAdminPodcasts();
    podcastMessage.textContent = error.message || "No se pudo eliminar el podcast.";
    podcastMessage.className = "notice error";
    return;
  }

  await loadAdminPodcasts();
  notifyContentRefresh();
  podcastMessage.textContent = "Podcast eliminado.";
  podcastMessage.className = "notice success";
});

function handleAdminRefresh(event) {
  const changedKey = event && event.key;

  if (!changedKey || [STORAGE_KEYS.config, STORAGE_KEYS.events, STORAGE_KEYS.announcements].includes(changedKey)) {
    loadSettings();
    loadStoredContent();
  }
}

window.addEventListener("storage", handleAdminRefresh);
window.addEventListener("arroyofm:refresh", handleAdminRefresh);