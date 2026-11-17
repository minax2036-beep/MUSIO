import { MUSIO_CONFIG } from "./core/config.js";
import { MusioSystem } from "./core/system.js";
import { AudioEngine } from "./audio/engine.js";
import { LibraryStore } from "./library/library-store.js";
import { FolderAccess } from "./library/folder-access.js";
import { readAudioTags } from "./library/metadata-reader.js";

const system = new MusioSystem(MUSIO_CONFIG);
let audioEngine = null;
let library = null;
let tracks = [];
let seekDragging = false;
const folderAccess = new FolderAccess();
let musicDirectory = null;
let folderPermissionGranted = false;

system.register("environment", {
  async init() {
    system.events.emit("environment:checked", {
      audio: typeof window.Audio !== "undefined",
      indexedDB: "indexedDB" in window,
      fileApi: "File" in window
    });
  }
});
system.register("library", {
  async init() {
    library = new LibraryStore(MUSIO_CONFIG.storage);
    await library.open();
  },
  destroy() { library?.close(); }
});
system.register("audio-engine", {
  async init() { audioEngine = new AudioEngine(system.events); },
  destroy() { audioEngine?.destroy(); }
});

const $ = selector => document.querySelector(selector);
const ui = {
  version: $("#core-version"), modules: $("#module-count"), storage: $("#storage-status"),
  nav: document.querySelectorAll("[data-page]"), add: $("#add-music"), files: $("#music-files"),
  chooseFolder: $("#choose-folder"), rescanFolder: $("#rescan-folder"), folderStatus: $("#folder-status"),
  parseTags: $("#parse-tags"), coverArt: $("#player-cover"),
  list: $("#track-list"), count: $("#library-count"), title: $("#now-title"),
  subtitle: $("#now-subtitle"), play: $("#play-pause"), previous: $("#previous-track"),
  next: $("#next-track"), seek: $("#seek-bar"), current: $("#current-time"),
  total: $("#total-time"), volume: $("#volume-bar"), search: $("#library-search"),
  filter: $("#library-filter"), playlistLinks: $("#playlist-links")
};

function timeText(value) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  return Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0");
}

async function refreshLibrary() {
  const [records, files] = await Promise.all([library.getTracks(), library.getFiles()]);
  for (const item of tracks) {
    if (item.file.__musioCoverUrl) URL.revokeObjectURL(item.file.__musioCoverUrl);
  }
  const fileMap = new Map(files.map(item => [item.id, item.file]));
  tracks = records.map(record => {
    const file = fileMap.get(record.id);
    if (file) {
      file.__musioMetadata = { title: record.title, artist: record.artist, album: record.album };
      file.__musioCoverUrl = record.coverArt ? URL.createObjectURL(record.coverArt) : "";
    }
    return { record, file };
  }).filter(item => item.file);
  renderTracks();
  await renderPlaylists();
}

async function scanMusicFolder() {
  if (!musicDirectory) {
    ui.folderStatus.textContent = "フォルダ未選択";
    return;
  }
  ui.folderStatus.textContent = "フォルダをスキャン中…";
  ui.rescanFolder.disabled = true;
  try {
    const entries = await folderAccess.scan(musicDirectory);
    const result = await library.addFiles(entries.map(entry => ({
      file: entry.file,
      relativePath: entry.relativePath,
      sourceId: musicDirectory.name
    })));
    await refreshLibrary();
    ui.folderStatus.textContent = musicDirectory.name + " • " + entries.length +
      " ファイル検出 / " + result.added + " 件追加 / " + result.skipped + " 件重複";
  } catch (error) {
    console.error("[MUSIO] Folder scan failed.", error);
    ui.folderStatus.textContent = error?.message || "フォルダを読み込めませんでした。";
    if (/権限|許可/.test(error?.message || "")) {
      folderPermissionGranted = false;
    }
  } finally {
    ui.rescanFolder.disabled = !folderPermissionGranted;
  }
}

async function restoreMusicFolder() {
  if (!folderAccess.supported) {
    ui.chooseFolder.disabled = true;
    ui.chooseFolder.title = "このブラウザはフォルダアクセスに対応していません";
    ui.folderStatus.textContent = "フォルダアクセス非対応。通常のファイル選択を利用してください。";
    return;
  }
  try {
    musicDirectory = await library.getSetting("musicDirectory");
    if (!musicDirectory) return;
    const permission = await folderAccess.getPermission(musicDirectory);
    if (permission === "granted") {
      folderPermissionGranted = true;
      ui.rescanFolder.disabled = false;
      ui.folderStatus.textContent = musicDirectory.name + " • フォルダ接続済み";
    } else {
      folderPermissionGranted = false;
      ui.rescanFolder.disabled = true;
      ui.folderStatus.textContent = musicDirectory.name + " • 再アクセス許可が必要です";
    }
  } catch (error) {
    console.warn("[MUSIO] Could not restore folder handle.", error);
    ui.folderStatus.textContent = "保存したフォルダ情報を復元できませんでした。";
  }
}

function renderTracks() {
  const query = ui.search.value.trim().toLocaleLowerCase();
  const favoritesOnly = ui.filter.value === "favorites";
  const filtered = tracks.filter(item => {
    const matches = (item.record.title + " " + item.record.name).toLocaleLowerCase().includes(query);
    return matches && (!favoritesOnly || item.record.favorite);
  });
  ui.count.textContent = filtered.length + " / " + tracks.length + " TRACKS";
  ui.list.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-library";
    const strong = document.createElement("strong");
    strong.textContent = tracks.length ? "該当する曲がありません" : "まだ音楽がありません";
    const p = document.createElement("p");
    p.textContent = tracks.length ? "検索条件を変更してみてください。" : "「音楽ファイルを追加」から音楽を読み込もう。";
    empty.append(strong, p);
    ui.list.append(empty);
    return;
  }
  filtered.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "track-row";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "track-main";
    const number = document.createElement("span");
    number.className = "track-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const details = document.createElement("span");
    details.className = "track-details";
    const name = document.createElement("strong");
    name.className = "track-name";
    name.textContent = item.record.title;
    const meta = document.createElement("span");
    meta.className = "track-meta";
    meta.textContent = [item.record.artist, item.record.album, (item.record.size / 1048576).toFixed(1) + " MB"].filter(Boolean).join(" • ");
    details.append(name, meta);
    play.append(number, details);
    play.addEventListener("click", async () => {
      const queue = filtered.map(entry => {
        Object.defineProperty(entry.file, "__musioId", { value: entry.record.id, configurable: true });
        return entry.file;
      });
      audioEngine.setQueue(queue, index);
      await audioEngine.play();
    });
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "favorite-button" + (item.record.favorite ? " selected" : "");
    favorite.textContent = item.record.favorite ? "♥" : "♡";
    favorite.setAttribute("aria-label", "お気に入り切り替え");
    favorite.addEventListener("click", async () => {
      await library.toggleFavorite(item.record.id);
      await refreshLibrary();
    });
    const addToPlaylist = document.createElement("button");
    addToPlaylist.type = "button";
    addToPlaylist.className = "favorite-button";
    addToPlaylist.textContent = "+";
    addToPlaylist.setAttribute("aria-label", "プレイリストに追加");
    addToPlaylist.addEventListener("click", async () => {
      const playlists = await library.getPlaylists();
      if (!playlists.length) {
        window.alert("先にプレイリストを作成してください。");
        return;
      }
      const choices = playlists.map((playlist, i) => (i + 1) + ". " + playlist.name).join("\\n");
      const answer = window.prompt("追加先の番号を入力してください。\\n" + choices);
      const selected = playlists[Number(answer) - 1];
      if (!selected) return;
      await library.addToPlaylist(selected.id, item.record.id);
      await renderPlaylists();
      window.alert("「" + selected.name + "」に追加しました。");
    });
    row.append(play, favorite, addToPlaylist);
    ui.list.append(row);
  });
}

async function renderPlaylists() {
  const playlists = await library.getPlaylists();
  ui.playlistLinks.replaceChildren();
  playlists.forEach(playlist => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "playlist-link";
    button.textContent = "♫ " + playlist.name + " (" + playlist.trackIds.length + ")";
    button.addEventListener("click", () => {
      const chosen = tracks.filter(item => playlist.trackIds.includes(item.record.id));
      renderPlaylistTracks(chosen);
    });
    ui.playlistLinks.append(button);
  });
}

function renderPlaylistTracks(items) {
  ui.list.replaceChildren();
  ui.count.textContent = items.length + " PLAYLIST TRACKS";
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "track-row";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "track-main";
    play.textContent = String(index + 1).padStart(2, "0") + "　" + item.record.title;
    play.addEventListener("click", async () => {
      const queue = items.map(entry => entry.file);
      audioEngine.setQueue(queue, index);
      await audioEngine.play();
    });
    row.append(play);
    ui.list.append(row);
  });
}

function renderPlayer(state = audioEngine?.getState()) {
  if (!state) return;
  ui.title.textContent = state.title;
  ui.subtitle.textContent = state.track
    ? [state.artist || "不明なアーティスト", state.album, (state.index + 1) + " / " + state.queueLength].filter(Boolean).join(" • ")
    : "MUSIO LOCAL PLAYER";
  if (ui.coverArt) {
    ui.coverArt.style.backgroundImage = state.coverUrl ? "url(\"" + state.coverUrl + "\")" : "";
    ui.coverArt.textContent = state.coverUrl ? "" : "♫";
    ui.coverArt.classList.toggle("has-image", Boolean(state.coverUrl));
  }
  ui.play.disabled = !state.track;
  ui.play.textContent = state.paused ? "▶" : "Ⅱ";
  ui.play.setAttribute("aria-label", state.paused ? "再生" : "一時停止");
  ui.seek.disabled = !state.track || !state.duration;
  ui.seek.max = String(Math.max(1, Math.floor(state.duration * 10)));
  if (!seekDragging) ui.seek.value = String(Math.floor(state.currentTime * 10));
  ui.current.textContent = timeText(state.currentTime);
  ui.total.textContent = timeText(state.duration);
  ui.volume.value = String(Math.round(state.volume * 100));
}

function setupEvents() {
  ["track:change", "queue:change"].forEach(name => system.events.on(name, state => {
    renderPlayer(state);
    renderTracks();
  }));
  ["audio:timeupdate", "audio:metadata", "audio:play", "audio:pause", "audio:volumechange", "audio:ended"].forEach(name => {
    system.events.on(name, renderPlayer);
  });
  system.events.on("audio:error", detail => {
    renderPlayer(detail);
    if (detail.message) window.alert(detail.message);
  });
}

function setupControls() {
  ui.add.addEventListener("click", () => ui.files.click());
  ui.chooseFolder.addEventListener("click", async () => {
    try {
      musicDirectory = await folderAccess.chooseDirectory();
      await library.saveSetting("musicDirectory", musicDirectory);
      folderPermissionGranted = true;
      ui.rescanFolder.disabled = false;
      await scanMusicFolder();
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("[MUSIO] Folder selection failed.", error);
      ui.folderStatus.textContent = error?.message || "フォルダを選択できませんでした。";
    }
  });
  ui.rescanFolder.addEventListener("click", scanMusicFolder);
  ui.parseTags.addEventListener("click", async () => {
    ui.parseTags.disabled = true;
    const originalLabel = ui.parseTags.textContent;
    try {
      const current = await library.getTracks();
      let completed = 0;
      for (const record of current) {
        const fileRecord = (await library.getFiles()).find(item => item.id === record.id);
        if (fileRecord) {
          const metadata = await readAudioTags(fileRecord.file);
          await library.updateTrackMetadata(record.id, metadata);
        }
        completed += 1;
        ui.parseTags.textContent = "解析中 " + completed + "/" + current.length;
      }
      await refreshLibrary();
      ui.folderStatus.textContent = current.length + " 曲のタグ解析が完了しました。";
    } catch (error) {
      console.error("[MUSIO] Tag parsing failed.", error);
      ui.folderStatus.textContent = error?.message || "タグ解析に失敗しました。";
    } finally {
      ui.parseTags.disabled = false;
      ui.parseTags.textContent = originalLabel;
    }
  });
  ui.files.addEventListener("change", async event => {
    const selected = Array.from(event.target.files || []).filter(file =>
      file.type.startsWith("audio/") || /\.(mp3|flac|wav|m4a|aac|ogg|opus)$/i.test(file.name)
    );
    if (!selected.length) return;
    try {
      await library.addFiles(selected);
      await refreshLibrary();
      const firstRecord = tracks.find(item => item.record.name === selected[0].name && item.record.size === selected[0].size);
      const queue = tracks.map(item => {
        Object.defineProperty(item.file, "__musioId", { value: item.record.id, configurable: true });
        return item.file;
      });
      const startIndex = firstRecord ? queue.findIndex(file => file.__musioId === firstRecord.record.id) : 0;
      audioEngine.setQueue(queue, Math.max(0, startIndex));
      await audioEngine.play();
    } catch (error) {
      console.error("[MUSIO] Import failed.", error);
      window.alert("音楽を保存できませんでした。ブラウザの空き容量を確認してください。\n" + (error?.message || ""));
    } finally {
      event.target.value = "";
    }
  });
  ui.play.addEventListener("click", () => audioEngine.toggle());
  ui.previous.addEventListener("click", () => audioEngine.previous());
  ui.next.addEventListener("click", () => audioEngine.next());
  ui.seek.addEventListener("input", () => {
    seekDragging = true;
    ui.current.textContent = timeText(Number(ui.seek.value) / 10);
  });
  ui.seek.addEventListener("change", () => {
    audioEngine.seek(Number(ui.seek.value) / 10);
    seekDragging = false;
  });
  ui.volume.addEventListener("input", () => audioEngine.setVolume(Number(ui.volume.value) / 100));
  ui.search.addEventListener("input", renderTracks);
  ui.filter.addEventListener("change", renderTracks);
  $("#create-playlist").addEventListener("click", async () => {
    const name = window.prompt("プレイリスト名を入力してください");
    if (!name || !name.trim()) return;
    try {
      await library.createPlaylist(name);
      await renderPlaylists();
    } catch (error) {
      window.alert(error.message || "作成できませんでした。");
    }
  });
}

function setupNavigation() {
  ui.nav.forEach(item => item.addEventListener("click", () => {
    ui.nav.forEach(nav => nav.classList.toggle("active", nav === item));
    if (item.dataset.page === "liked") {
      ui.filter.value = "favorites";
      renderTracks();
      $("#library").scrollIntoView({ behavior: "smooth" });
    } else if (item.dataset.page === "search") {
      ui.search.focus();
      $("#library").scrollIntoView({ behavior: "smooth" });
    } else if (item.dataset.page === "library") {
      ui.filter.value = "all";
      renderTracks();
      $("#library").scrollIntoView({ behavior: "smooth" });
    } else {
      $("#home").scrollIntoView({ behavior: "smooth" });
    }
  }));
}

async function boot() {
  try {
    setupNavigation();
    setupEvents();
    setupControls();
    await system.start();
    const status = system.getStatus();
    ui.version.textContent = "v" + status.version;
    ui.modules.textContent = String(status.moduleCount);
    ui.storage.textContent = "indexedDB" in window ? "対応" : "非対応";
    await refreshLibrary();
    await restoreMusicFolder();
    renderPlayer();
    document.documentElement.dataset.musioState = "ready";
    console.info("[MUSIO] Ready.", status);
  } catch (error) {
    document.documentElement.dataset.musioState = "error";
    console.error("[MUSIO] Startup failed.", error);
    window.alert("MUSIOの起動に失敗しました。\n" + (error?.message || ""));
  }
}
window.addEventListener("beforeunload", () => {
  audioEngine?.destroy();
  library?.close();
}, { once: true });
boot();