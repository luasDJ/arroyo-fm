
const SUPABASE_URL = "https://gixdaycfpnijlvlzfvny.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_h2CWl2ydWgI3safRUcYmxg_ffIDzs3h";
const ADMIN_ACCESS_CODE = "arroyo-fm";
const ACCESS_SESSION_KEY = "arroyo-fm-admin-access";

const $ = (selector) => document.querySelector(selector);
const accessPanel = $("#accessPanel");
const settingsPanel = $("#settingsPanel");
const accessForm = $("#accessForm");
const accessCodeInput = $("#accessCode");
const accessMessage = $("#accessMessage");
const modeInput = $("#mode");
const urlInput = $("#gocastUrl");
const typeInput = $("#gocastType");
const saveButton = $("#saveBtn");
const message = $("#saveMessage");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `notice ${type}`.trim();
}

function openSettings() {
  accessPanel.classList.add("hidden");
  settingsPanel.classList.remove("hidden");
  settingsPanel.setAttribute("aria-hidden", "false");
  loadSettings();
}

if (sessionStorage.getItem(ACCESS_SESSION_KEY) === "granted") {
  openSettings();
}

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (accessCodeInput.value === ADMIN_ACCESS_CODE) {
    sessionStorage.setItem(ACCESS_SESSION_KEY, "granted");
    accessMessage.textContent = "";
    openSettings();
    return;
  }

  accessMessage.textContent = "Código incorrecto.";
  accessMessage.className = "notice error";
  accessCodeInput.select();
});

// Cargar configuración actual
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

// Guardar configuración en Supabase
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