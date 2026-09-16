const DEFAULTS = {
  mode: "caster",
  gocastUrl: "",
  gocastType: "link"
};

const casterEmbed = `
<div data-type="newStreamPlayer"
     data-publicToken="ae702e4c-24d7-4f04-84eb-eae2b97663ed"
     data-theme="dark"
     data-color="0084FF"
     data-channelId="a2c0abdf-020d-4d8a-8181-ba0cb61e864b"
     data-rendered="false"
     class="cstrEmbed">
  <a href="https://www.caster.fm">Shoutcast Hosting</a>
  <a href="https://www.caster.fm">Stream Hosting</a>
  <a href="https://www.caster.fm">Radio Server Hosting</a>
</div>
<script src="https://cdn.cloud.caster.fm//widgets/embed.js"><\/script>`;

function getConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("arroyoFmConfig") || "{}") };
  } catch {
    return DEFAULTS;
  }
}

function renderPlayer() {
  const config = getConfig();
  const container = document.querySelector("#playerContainer");
  const badge = document.querySelector("#modeBadge");
  const label = document.querySelector("#modeLabel");
  const hint = document.querySelector("#playerHint");

  if (!container) return;

  if (config.mode === "gocast" && config.gocastUrl) {
    badge.textContent = "AUTODJ";
    label.textContent = "GoCast";
    hint.textContent = config.gocastType === "iframe"
      ? "AutoDJ de GoCast"
      : "Abre el reproductor alternativo de GoCast";
    if (config.gocastType === "iframe") {
      container.innerHTML = `<iframe src="${escapeAttr(config.gocastUrl)}" title="GoCast AutoDJ" allow="autoplay"></iframe>`;
    } else {
      container.innerHTML = `<a class="external-player" target="_blank" rel="noopener" href="${escapeAttr(config.gocastUrl)}">Abrir GoCast AutoDJ</a>`;
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
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

document.querySelector("#year").textContent = new Date().getFullYear();
renderPlayer();
