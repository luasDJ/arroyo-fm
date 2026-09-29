
const SUPABASE_URL = "https://gixdaycfpnijlvlzfvny.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_h2CWl2ydWgI3safRUcYmxg_ffIDzs3h";
const ADMIN_ACCESS_CODE = "1234567";

const STORAGE_KEYS = {
  events: "arroyofm_events",
  announcements: "arroyofm_announcements"
};

const DEFAULT_EVENTS = [
  {
    id: "default-event-1",
    title: "Noche de música en directo",
    date: "2026-10-04",
    description: "Sintoniza con nosotros para una sesión especial con artistas locales."
  },
  {
    id: "default-event-2",
    title: "Encuentro con la comunidad",
    date: "2026-10-11",
    description: "Charla, música y actividades para acompañar el fin de semana."
  }
];

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: "default-announcement-1",
    title: "Nueva temporada",
    text: "Arranca la nueva programación con entrevistas, música y propuestas exclusivas para la comunidad."
  }
];

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
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn("No se pudo leer localStorage:", error);
    return fallback;
  }
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

function renderAdminEvents() {
  if (!eventList) return;

  const events = readStoredCollection(STORAGE_KEYS.events, DEFAULT_EVENTS);

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

function renderAdminAnnouncements() {
  if (!announcementList) return;

  const announcements = readStoredCollection(STORAGE_KEYS.announcements, DEFAULT_ANNOUNCEMENTS);

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

function loadStoredContent() {
  renderAdminEvents();
  renderAdminAnnouncements();
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
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/radio_config?select=mode,gocast_url,gocast_type&limit=1`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        },
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.length) {
      throw new Error("No se pudo cargar la configuración");
    }

    modeInput.value = data[0].mode || "caster";
    urlInput.value = data[0].gocast_url || "";
    typeInput.value = data[0].gocast_type || "link";
  } catch (error) {
    console.error(error);
    showMessage("No se pudo cargar la configuración.", "error");
  }
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
    mode: modeInput.value,
    gocast_url: gocastUrl,
    gocast_type: typeInput.value,
    updated_at: new Date().toISOString()
  };

  saveButton.disabled = true;
  showMessage("Guardando...");

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/radio_config?id=eq.1`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(config)
      }
    );

    if (!response.ok) {
      throw new Error("Error al guardar en Supabase");
    }

    showMessage("Guardado. El cambio se aplicará a todos los visitantes.", "success");
  } catch (error) {
    console.error(error);
    showMessage("No se pudo guardar. Revisa las políticas RLS de Supabase.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById("addEventBtn").addEventListener("click", () => {
  const title = eventTitleInput.value.trim();
  const date = eventDateInput.value;
  const description = eventDescriptionInput.value.trim();

  if (!title || !date) {
    eventMessage.textContent = "Completa el título y la fecha del evento.";
    eventMessage.className = "notice error";
    return;
  }

  const events = readStoredCollection(STORAGE_KEYS.events, DEFAULT_EVENTS);
  const newEvent = {
    id: `event-${Date.now()}`,
    title,
    date,
    description
  };

  persistCollection(STORAGE_KEYS.events, [...events, newEvent]);
  renderAdminEvents();
  eventMessage.textContent = "Evento guardado correctamente.";
  eventMessage.className = "notice success";
  eventTitleInput.value = "";
  eventDateInput.value = "";
  eventDescriptionInput.value = "";
  window.dispatchEvent(new Event("storage"));
});

document.getElementById("addAnnouncementBtn").addEventListener("click", () => {
  const title = announcementTitleInput.value.trim();
  const text = announcementTextInput.value.trim();

  if (!title || !text) {
    announcementMessage.textContent = "Completa el título y el texto del anuncio.";
    announcementMessage.className = "notice error";
    return;
  }

  const announcements = readStoredCollection(STORAGE_KEYS.announcements, DEFAULT_ANNOUNCEMENTS);
  const newAnnouncement = {
    id: `announcement-${Date.now()}`,
    title,
    text
  };

  persistCollection(STORAGE_KEYS.announcements, [...announcements, newAnnouncement]);
  renderAdminAnnouncements();
  announcementMessage.textContent = "Anuncio publicado.";
  announcementMessage.className = "notice success";
  announcementTitleInput.value = "";
  announcementTextInput.value = "";
  window.dispatchEvent(new Event("storage"));
});

eventList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-event]");

  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteEvent;
  const events = readStoredCollection(STORAGE_KEYS.events, DEFAULT_EVENTS).filter((item) => item.id !== id);
  persistCollection(STORAGE_KEYS.events, events);
  renderAdminEvents();
  eventMessage.textContent = "Evento eliminado.";
  eventMessage.className = "notice success";
  window.dispatchEvent(new Event("storage"));
});

announcementList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-announcement]");

  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteAnnouncement;
  const announcements = readStoredCollection(STORAGE_KEYS.announcements, DEFAULT_ANNOUNCEMENTS).filter((item) => item.id !== id);
  persistCollection(STORAGE_KEYS.announcements, announcements);
  renderAdminAnnouncements();
  announcementMessage.textContent = "Anuncio eliminado.";
  announcementMessage.className = "notice success";
  window.dispatchEvent(new Event("storage"));
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEYS.events || event.key === STORAGE_KEYS.announcements) {
    loadStoredContent();
  }
});