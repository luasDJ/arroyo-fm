
const ADMIN_ACCESS_CODE = "1234567";

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

function getSupabaseClient() {
  const url = (window.SUPABASE_URL || "").trim();
  const key = (window.SUPABASE_ANON_KEY || "").trim();

  if (!url || !key || !window.supabase) {
    return null;
  }

  return window.supabase.createClient(url, key);
}

function isSupabaseConfigured() {
  return Boolean(getSupabaseClient());
}

const DEFAULT_EVENTS = [];
const DEFAULT_ANNOUNCEMENTS = [];

const $ = (selector) => document.querySelector(selector);
const accessPanel = $("#accessPanel");
const settingsPanel = $("#settingsPanel");
const contentPanel = $("#contentPanel");
const accessForm = $("#accessForm");
const accessCodeInput = $("#accessCode");
const accessMessage = $("#accessMessage");
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

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `notice ${type}`.trim();
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

  const { data: migratedItems, error: migrationError } = await supabase
    .from(tableName)
    .insert(itemsToMigrate)
    .select();

  if (migrationError || !Array.isArray(migratedItems)) {
    console.warn(`No se pudo migrar el contenido local de ${tableName}:`, migrationError);
    const messageElement = tableName === "radio_events" ? eventMessage : announcementMessage;
    messageElement.textContent = "No se pudo importar el contenido local a Supabase.";
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
            <strong>${event.title}</strong>
            <small>${formatEventDate(event.date)}</small>
            <p>${event.description || "Sin descripción."}</p>
          </div>
          <button type="button" class="danger-button" data-delete-event="${event.id}">Eliminar</button>
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
            <strong>${announcement.title}</strong>
            <p>${announcement.text}</p>
          </div>
          <button type="button" class="danger-button" data-delete-announcement="${announcement.id}">Eliminar</button>
        </div>
      `
    )
    .join("");
}

async function loadStoredContent() {
  if (!getSupabaseClient()) {
    renderAdminEvents([]);
    renderAdminAnnouncements([]);
    eventMessage.textContent = "No hay conexión con Supabase; los cambios no se pueden compartir.";
    eventMessage.className = "notice error";
    announcementMessage.textContent = eventMessage.textContent;
    announcementMessage.className = "notice error";
    return;
  }

  const events = await loadOrMigrateCollection("radio_events", STORAGE_KEYS.events);
  const announcements = await loadOrMigrateCollection("radio_announcements", STORAGE_KEYS.announcements);

  renderAdminEvents(events);
  renderAdminAnnouncements(announcements);
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

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (accessCodeInput.value.trim() === ADMIN_ACCESS_CODE) {
    accessMessage.textContent = "";
    openSettings();
    return;
  }

  accessMessage.textContent = "Código incorrecto.";
  accessMessage.className = "notice error";
  accessCodeInput.select();
});

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

  const supabase = getSupabaseClient();

  if (!supabase) {
    showMessage("No hay conexión con Supabase; la configuración no se guardó.", "error");
    return;
  }

  const { error } = await supabase.from("radio_config").upsert(config, { onConflict: "id" });

  if (error) {
    showMessage("No se pudo guardar la configuración en Supabase.", "error");
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

  const supabase = getSupabaseClient();

  if (!supabase) {
    eventMessage.textContent = "No hay conexión con Supabase; el evento no se guardó.";
    eventMessage.className = "notice error";
    return;
  }

  const { error } = await supabase.from("radio_events").insert(payload);

  if (error) {
    eventMessage.textContent = "No se pudo guardar el evento en Supabase.";
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

  const supabase = getSupabaseClient();

  if (!supabase) {
    announcementMessage.textContent = "No hay conexión con Supabase; el anuncio no se publicó.";
    announcementMessage.className = "notice error";
    return;
  }

  const { error } = await supabase.from("radio_announcements").insert(payload);

  if (error) {
    announcementMessage.textContent = "No se pudo guardar el anuncio en Supabase.";
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

eventList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-event]");

  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteEvent;
  const supabase = getSupabaseClient();

  if (!supabase) {
    eventMessage.textContent = "No hay conexión con Supabase; el evento no se eliminó.";
    eventMessage.className = "notice error";
    return;
  }

  const { error } = await supabase.from("radio_events").delete().eq("id", id);

  if (error) {
    eventMessage.textContent = "No se pudo borrar el evento en Supabase.";
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
  const supabase = getSupabaseClient();

  if (!supabase) {
    announcementMessage.textContent = "No hay conexión con Supabase; el anuncio no se eliminó.";
    announcementMessage.className = "notice error";
    return;
  }

  const { error } = await supabase.from("radio_announcements").delete().eq("id", id);

  if (error) {
    announcementMessage.textContent = "No se pudo borrar el anuncio en Supabase.";
    announcementMessage.className = "notice error";
    return;
  }

  await loadStoredContent();
  notifyContentRefresh();
  announcementMessage.textContent = "Anuncio eliminado.";
  announcementMessage.className = "notice success";
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