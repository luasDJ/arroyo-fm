const DEMO_PASSWORD = "cambia-esta-clave";
const configKey = "arroyoFmConfig";

const $ = (selector) => document.querySelector(selector);
const getConfig = () => {
  try { return JSON.parse(localStorage.getItem(configKey) || "{}"); }
  catch { return {}; }
};

$("#loginBtn").addEventListener("click", () => {
  if ($("#password").value === DEMO_PASSWORD) {
    $("#loginBox").classList.add("hidden");
    $("#settingsBox").classList.remove("hidden");
    loadSettings();
  } else {
    $("#loginError").textContent = "Contraseña incorrecta.";
  }
});

function loadSettings() {
  const config = getConfig();
  $("#mode").value = config.mode || "caster";
  $("#gocastUrl").value = config.gocastUrl || "";
  $("#gocastType").value = config.gocastType || "link";
}

$("#saveBtn").addEventListener("click", () => {
  const config = {
    mode: $("#mode").value,
    gocastUrl: $("#gocastUrl").value.trim(),
    gocastType: $("#gocastType").value
  };
  localStorage.setItem(configKey, JSON.stringify(config));
  $("#saveMessage").textContent = "Guardado en este navegador. La web pública de otros usuarios no se actualiza con esta versión.";
});

$("#logoutBtn").addEventListener("click", () => {
  $("#settingsBox").classList.add("hidden");
  $("#loginBox").classList.remove("hidden");
  $("#password").value = "";
});
