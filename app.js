
const SUPABASE_URL = "https://gixdaycfpnijlvlzfvny.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_h2CWl2ydWgI3safRUcYmxg_ffIDzs3h";

const DEFAULTS = {
  mode: "caster",
  gocastUrl: "",
  gocastType: "link"
};

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
    label.textContent = "GoCast";

    if (!config.gocastUrl) {
      hint.textContent = "Configura una URL de GoCast desde el panel de emisión.";
      container.innerHTML = "<p class=\"muted\">No hay una URL de GoCast configurada.</p>";
      return;
    }

    hint.textContent = config.gocastType === "iframe"
      ? "AutoDJ de GoCast"
      : "Abre el reproductor alternativo de GoCast";

    if (config.gocastType === "iframe") {
      container.innerHTML = `
        <iframe
          src="${escapeAttr(config.gocastUrl)}"
          title="GoCast AutoDJ"
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
          Abrir GoCast AutoDJ
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

const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

renderPlayer();