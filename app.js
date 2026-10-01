
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
    return parsed !== null ? parsed : fallback;
  } catch (error) {
    console.warn("No se pudo leer desde localStorage:", error);
    return fallback;
  }
}

function normalizeConfig(config) {
  const normalizedConfig = typeof config === "object" && config ? config : {};

  return {
    mode: normalizedConfig.mode === "gocast" ? "gocast" : DEFAULTS.mode,
    gocastUrl: normalizedConfig.gocastUrl || normalizedConfig.gocast_url || "",
    gocastType: normalizedConfig.gocastType === "iframe" || normalizedConfig.gocast_type === "iframe" ? "iframe" : DEFAULTS.gocastType
  };
}

function readStoredConfig() {
  const config = readStoredCollection(STORAGE_KEYS.config, DEFAULTS) || DEFAULTS;
  return normalizeConfig(config);
}

async function fetchRemoteConfig() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return readStoredConfig();
  }

  const { data, error } = await supabase
    .from("radio_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return readStoredConfig();
  }

  return normalizeConfig(data);
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

async function renderAnnouncements() {
  const list = document.querySelector("#announcementsList");

  if (!list) return;

  const announcements = isSupabaseConfigured()
    ? await fetchRemoteCollection("radio_announcements", DEFAULT_ANNOUNCEMENTS)
    : DEFAULT_ANNOUNCEMENTS;

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

async function renderCalendar() {
  const list = document.querySelector("#eventsList");

  if (!list) return;

  const events = isSupabaseConfigured()
    ? await fetchRemoteCollection("radio_events", DEFAULT_EVENTS)
    : DEFAULT_EVENTS;

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

async function refreshDynamicContent() {
  await renderAnnouncements();
  await renderCalendar();
}

async function renderPlayer() {
  const config = isSupabaseConfigured() ? await fetchRemoteConfig() : readStoredConfig();

  const container = document.querySelector("#playerContainer");
  const badge = document.querySelector("#modeBadge");
  const label = document.querySelector("#modeLabel");
  const hint = document.querySelector("#playerHint");

  if (!container) return;

  if (config.mode === "gocast") {
    badge.textContent = "AUTODJ";
    label.textContent = "AutoDJ";

    if (!config.gocastUrl) {
      hint.textContent = "Configura una URL de GoCast desde el panel de emisión.";
      container.innerHTML = "<p class=\"muted\">No hay una URL de GoCast configurada.</p>";
      return;
    }

    hint.textContent = config.gocastType === "iframe"
      ? "Reproductor AutoDJ"
      : "Abre el reproductor alternativo de AutoDJ";

    if (config.gocastType === "iframe") {
      container.innerHTML = `
        <iframe
          src="${escapeAttr(config.gocastUrl)}"
          title="AutoDJ"
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
          Abrir AutoDJ
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

async function handleContentRefresh(event) {
  const changedKey = event && event.key;

  if (!changedKey || [STORAGE_KEYS.config, STORAGE_KEYS.events, STORAGE_KEYS.announcements].includes(changedKey)) {
    await renderPlayer();
    await refreshDynamicContent();
  }
}

window.addEventListener("storage", () => {
  handleContentRefresh({ key: STORAGE_KEYS.config });
});
window.addEventListener("arroyofm:refresh", () => {
  handleContentRefresh({ key: STORAGE_KEYS.config });
});

(async () => {
  await renderPlayer();
  await refreshDynamicContent();
})();