import { MUSIO_CONFIG } from "./core/config.js";
import { MusioSystem } from "./core/system.js";
import { AudioEngine } from "./audio/engine.js";

const system = new MusioSystem(MUSIO_CONFIG);
let audioEngine = null;
let seekDragging = false;

const audioModule = {
  async init() {
    audioEngine = new AudioEngine(system.events);
  },
  destroy() {
    audioEngine?.destroy();
  }
};

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
system.register("audio-engine", audioModule);

const elements = {
  version: document.querySelector("#core-version"),
  moduleCount: document.querySelector("#module-count"),
  storageStatus: document.querySelector("#storage-status"),
  navItems: document.querySelectorAll("[data-page]"),
  addMusic: document.querySelector("#add-music"),
  fileInput: document.querySelector("#music-files"),
  trackList: document.querySelector("#track-list"),
  libraryCount: document.querySelector("#library-count"),
  nowTitle: document.querySelector("#now-title"),
  nowSubtitle: document.querySelector("#now-subtitle"),
  playPause: document.querySelector("#play-pause"),
  previous: document.querySelector("#previous-track"),
  next: document.querySelector("#next-track"),
  seek: document.querySelector("#seek-bar"),
  currentTime: document.querySelector("#current-time"),
  totalTime: document.querySelector("#total-time"),
  volume: document.querySelector("#volume-bar")
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return minutes + ":" + remainder;
}

function renderSystemStatus() {
  const status = system.getStatus();
  elements.version.textContent = "v" + status.version;
  elements.moduleCount.textContent = String(status.moduleCount);
  elements.storageStatus.textContent = "IndexedDB" in window ? "対応" : "非対応";
}

function renderTrackList(state = audioEngine?.getState()) {
  if (!state) return;
  elements.libraryCount.textContent = state.queueLength + " TRACKS";

  if (!state.queueLength) {
    elements.trackList.innerHTML = '<div class="empty-library"><span class="empty-icon">♫</span><strong>まだ音楽がありません</strong><p>「音楽ファイルを追加」から、端末内の音楽を読み込もう。</p></div>';
    return;
  }

  const files = state.track ? window.__musioQueueFiles : null;
  if (!files) return;

  elements.trackList.replaceChildren();
  files.forEach((file, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "track-row" + (index === state.index ? " active" : "");
    row.setAttribute("aria-label", "再生: " + file.name);
    const number = document.createElement("span");
    number.className = "track-number";
    number.textContent = index === state.index ? "♫" : String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.className = "track-name";
    name.textContent = file.name.replace(/\.[^.]+$/, "");
    const meta = document.createElement("span");
    meta.className = "track-meta";
    meta.textContent = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    row.append(number, name, meta);
    row.addEventListener("click", async () => {
      audioEngine.setQueue(files, index);
      await audioEngine.play();
    });
    elements.trackList.append(row);
  });
}

function renderPlayer(state = audioEngine?.getState()) {
  if (!state) return;
  elements.nowTitle.textContent = state.title;
  elements.nowSubtitle.textContent = state.fileName ? "LOCAL FILE • " + (state.index + 1) + " / " + state.queueLength : "MUSIO LOCAL PLAYER";
  elements.playPause.disabled = !state.track;
  elements.playPause.textContent = state.paused ? "▶" : "Ⅱ";
  elements.playPause.setAttribute("aria-label", state.paused ? "再生" : "一時停止");
  elements.seek.disabled = !state.track || !state.duration;
  elements.seek.max = String(Math.max(1, Math.floor(state.duration * 10)));
  if (!seekDragging) elements.seek.value = String(Math.floor(state.currentTime * 10));
  elements.currentTime.textContent = formatTime(state.currentTime);
  elements.totalTime.textContent = formatTime(state.duration);
  elements.volume.value = String(Math.round(state.volume * 100));
}

function setupEvents() {
  system.events.on("track:change", (state) => {
    renderPlayer(state);
    renderTrackList(state);
  });
  system.events.on("queue:change", (state) => {
    renderPlayer(state);
    renderTrackList(state);
  });
  system.events.on("audio:timeupdate", renderPlayer);
  system.events.on("audio:metadata", renderPlayer);
  system.events.on("audio:play", renderPlayer);
  system.events.on("audio:pause", renderPlayer);
  system.events.on("audio:volumechange", renderPlayer);
  system.events.on("audio:ended", renderPlayer);
  system.events.on("audio:error", (detail) => {
    renderPlayer(detail);
    if (detail.message) window.alert(detail.message);
  });
}

function setupControls() {
  elements.addMusic.addEventListener("click", () => elements.fileInput.click());

  elements.fileInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("audio/") || /\.(mp3|flac|wav|m4a|aac|ogg|opus)$/i.test(file.name));
    if (!files.length) return;
    window.__musioQueueFiles = files;
    audioEngine.setQueue(files, 0);
    renderTrackList();
    await audioEngine.play();
    event.target.value = "";
  });

  elements.playPause.addEventListener("click", () => audioEngine.toggle());
  elements.previous.addEventListener("click", () => audioEngine.previous());
  elements.next.addEventListener("click", () => audioEngine.next());

  elements.seek.addEventListener("input", () => {
    seekDragging = true;
    const seconds = Number(elements.seek.value) / 10;
    elements.currentTime.textContent = formatTime(seconds);
  });
  elements.seek.addEventListener("change", () => {
    audioEngine.seek(Number(elements.seek.value) / 10);
    seekDragging = false;
  });

  elements.volume.addEventListener("input", () => {
    audioEngine.setVolume(Number(elements.volume.value) / 100);
  });

  document.querySelector("#create-playlist")?.addEventListener("click", () => {
    window.alert("プレイリスト機能は次の開発段階で追加します。");
  });
}

function setupNavigation() {
  for (const item of elements.navItems) {
    item.addEventListener("click", () => {
      for (const navItem of elements.navItems) navItem.classList.toggle("active", navItem === item);
      system.events.emit("navigation:change", { page: item.dataset.page });
    });
  }
}

async function boot() {
  try {
    setupNavigation();
    setupEvents();
    setupControls();
    system.events.on("system:ready", renderSystemStatus);
    await system.start();
    renderSystemStatus();
    renderPlayer();
    document.documentElement.dataset.musioState = "ready";
    console.info("[MUSIO] System ready.", system.getStatus());
  } catch (error) {
    document.documentElement.dataset.musioState = "error";
    console.error("[MUSIO] Startup failed.", error);
  }
}

window.addEventListener("beforeunload", () => audioEngine?.destroy(), { once: true });
boot();
