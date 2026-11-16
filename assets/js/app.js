import { MUSIO_CONFIG } from "./core/config.js";
import { MusioSystem } from "./core/system.js";

const system = new MusioSystem(MUSIO_CONFIG);

const browserEnvironmentModule = {
  async init() {
    const supported = {
      audio: typeof window.Audio !== "undefined",
      indexedDB: "indexedDB" in window,
      fileApi: "File" in window
    };

    system.events.emit("environment:checked", supported);
  }
};

system.register("environment", browserEnvironmentModule);

const elements = {
  version: document.querySelector("#core-version"),
  moduleCount: document.querySelector("#module-count"),
  storageStatus: document.querySelector("#storage-status"),
  navItems: document.querySelectorAll("[data-page]")
};

function renderSystemStatus() {
  const status = system.getStatus();

  elements.version.textContent = `v${status.version}`;
  elements.moduleCount.textContent = String(status.moduleCount);
  elements.storageStatus.textContent = "IndexedDB" in window ? "対応" : "非対応";
}

function setupNavigation() {
  for (const item of elements.navItems) {
    item.addEventListener("click", () => {
      for (const navItem of elements.navItems) {
        navItem.classList.toggle("active", navItem === item);
      }

      system.events.emit("navigation:change", {
        page: item.dataset.page
      });
    });
  }
}

function setupPlaylistButton() {
  const button = document.querySelector("#create-playlist");

  button?.addEventListener("click", () => {
    system.events.emit("playlist:create-requested");
    window.alert("プレイリスト機能は次の開発段階で追加します。");
  });
}

async function boot() {
  try {
    setupNavigation();
    setupPlaylistButton();

    system.events.on("system:ready", renderSystemStatus);
    await system.start();

    document.documentElement.dataset.musioState = "ready";
    console.info("[MUSIO] System ready.", system.getStatus());
  } catch (error) {
    document.documentElement.dataset.musioState = "error";
    console.error("[MUSIO] Startup failed.", error);
  }
}

boot();