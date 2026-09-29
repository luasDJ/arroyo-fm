
const SUPABASE_URL = "https://gixdaycfpnijlvlzfvny.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_h2CWl2ydWgI3safRUcYmxg_ffIDzs3h";

const STORAGE_KEYS = {
  events: "arroyofm_events",
  announcements: "arroyofm_announcements"
};

const DEFAULTS = {
  mode: "caster",
  gocastUrl: "",
  gocastType: "link"
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

const casterEmbed = `
<div data-type="newStreamPlayer"
     data-publicToken="ae702e4c-24d7-4f04-84eb-eae2b97663ed"
     data-theme="light"
     data-color="e81e4d"
     data-channelId=""
     data-rendered="false"
     class="cstrEmbed">
  <a href="https://www.caster.fm">Shoutcast Hosting</a>
  <a href="https://www.caster.fm">Stream Hosting</a>
  <a href="https://www.caster.fm">Radio Server Hosting</a>
</div>
`;

function readStoredCollection(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key);

    if (!storedValue) {
      return fallback;
    }

    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn("No se pudo leer desde localStorage:", error);
    return fallback;
  }
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

function renderAnnouncements() {
  const list = document.querySelector("#announcementsList");

  if (!list) return;

  const announcements = readStoredCollection(STORAGE_KEYS.announcements, DEFAULT_ANNOUNCEMENTS);

  if (!announcements.length) {
    list.innerHTML = "<p class=\"empty-state\">No hay anuncios publicados.</p>";
    return;
  }

  list.innerHTML = announcements
    .slice()
    .reverse()
    .map(
      (item) => `
        <article class="announcement-item">
          <span class="announcement-tag">Aviso</span>
          <h3>${escapeText(item.title || "Anuncio")}</h3>
          <p>${escapeText(item.text || "")}</p>
        </article>
      `
    )
    .join("");
}

function renderCalendar() {
  const list = document.querySelector("#eventsList");

  if (!list) return;

  const events = readStoredCollection(STORAGE_KEYS.events, DEFAULT_EVENTS);

  if (!events.length) {
    list.innerHTML = "<p class=\"empty-state\">Todavía no hay eventos programados.</p>";
    return;
  }

  list.innerHTML = events
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(
      (item) => `
        <article class="event-item">
          <div class="event-date-box">
            <span>${new Date(`${item.date}T12:00:00`).toLocaleDateString("es-ES", { day: "2-digit" })}</span>
            <strong>${new Date(`${item.date}T12:00:00`).toLocaleDateString("es-ES", { month: "short" })}</strong>
          </div>
          <div class="event-copy">
            <h3>${escapeText(item.title || "Evento")}</h3>
            <p class="event-date-text">${formatEventDate(item.date || "")}</p>
            <p>${escapeText(item.description || "")}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function refreshDynamicContent() {
  renderAnnouncements();
  renderCalendar();
}

async function getConfig() {
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

    if (!response.ok) {
      throw new Error("No se pudo consultar Supabase");
    }

    const data = await response.json();

    if (!data.length) return DEFAULTS;

    return {
      mode: data[0].mode === "gocast" ? "gocast" : DEFAULTS.mode,
      gocastUrl: data[0].gocast_url || "",
      gocastType: data[0].gocast_type === "iframe" ? "iframe" : DEFAULTS.gocastType
    };
  } catch (error) {
    console.error(error);
    return DEFAULTS;
  }
}

async function renderPlayer() {
  const config = await getConfig();

  const container = document.querySelector("#playerContainer");
  const badge = document.querySelector("#modeBadge");
  const label = document.querySelector("#modeLabel");
  const hint = document.querySelector("#playerHint");

  if (!container) return;

  if (config.mode === "gocast") {
    badge.textContent = "AUTODJ";
    label.textContent = "RadioKing";

    if (!config.gocastUrl) {
      hint.textContent = "Configura una URL de GoCast desde el panel de emisión.";
      container.innerHTML = "<p class=\"muted\">No hay una URL de GoCast configurada.</p>";
      return;
    }

    hint.textContent = config.gocastType === "iframe"
      ? "AutoDJ de RadioKing"
      : "Abre el reproductor alternativo de RadioKing";

    if (config.gocastType === "iframe") {
      container.innerHTML = `
        <iframe
          src="${escapeAttr(config.gocastUrl)}"
          title="RadioKing AutoDJ"
          allow="autoplay"
          style="width:100%; min-height:180px; border:0;">
        </iframe>`;
    } else {
      container.innerHTML = `
        <a
          class="external-player"
          target="_blank"
          rel="noopener"
          href="${escapeAttr(config.gocastUrl)}">
          Abrir RadioKing AutoDJ
        </a>`;
    }
  } else {
    badge.textContent = "DIRECTO";
    label.textContent = "Caster.fm";
    hint.textContent = "Reproductor de Arroyo FM";

    container.innerHTML = casterEmbed;

    const script = document.createElement("script");
    script.src = "https://cdn.cloud.caster.fm//widgets/embed.js";
    container.appendChild(script);
  }
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEYS.events || event.key === STORAGE_KEYS.announcements) {
    refreshDynamicContent();
  }
});

renderPlayer();
renderAnnouncements();
renderCalendar();