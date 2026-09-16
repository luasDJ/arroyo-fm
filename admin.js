
const SUPABASE_URL = "https://gixdaycfpnijlvlzfvny.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_h2CWl2ydWgI3safRUcYmxg_ffIDzs3h";

const $ = (selector) => document.querySelector(selector);

// Cargar configuración actual
async function loadSettings() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/radio_config?select=mode,gocast_url,gocast_type&limit=1`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY
      }
    }
  );

  const data = await response.json();

  if (!response.ok || !data.length) {
    $("#saveMessage").textContent =
      "No se pudo cargar la configuración.";
    return;
  }

  $("#mode").value = data[0].mode || "caster";
  $("#gocastUrl").value = data[0].gocast_url || "";
  $("#gocastType").value = data[0].gocast_type || "link";
}

// Mostrar directamente el panel, sin login
$("#loginBox").classList.add("hidden");
$("#settingsBox").classList.remove("hidden");

loadSettings();

// Guardar configuración en Supabase
$("#saveBtn").addEventListener("click", async () => {
  const config = {
    mode: $("#mode").value,
    gocast_url: $("#gocastUrl").value.trim(),
    gocast_type: $("#gocastType").value,
    updated_at: new Date().toISOString()
  };

  $("#saveMessage").textContent = "Guardando...";

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

    $("#saveMessage").textContent =
      "✅ Guardado. El cambio se aplicará a todos los visitantes.";
  } catch (error) {
    console.error(error);
    $("#saveMessage").textContent =
      "❌ No se pudo guardar la configuración.";
  }
});

// Ocultar el botón de cerrar sesión
const logoutButton = $("#logoutBtn");

if (logoutButton) {
  logoutButton.style.display = "none";
}