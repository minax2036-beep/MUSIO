export class LibraryStore {
  #db = null;
  constructor(config = {}) {
    this.databaseName = config.databaseName || "musio-db";
    this.databaseVersion = config.databaseVersion || 1;
  }
  async open() {
    if (this.#db) return this.#db;
    this.#db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.databaseVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("tracks")) {
          const tracks = db.createObjectStore("tracks", { keyPath: "id" });
          tracks.createIndex("addedAt", "addedAt");
          tracks.createIndex("favorite", "favorite");
        }
        if (!db.objectStoreNames.contains("playlists")) db.createObjectStore("playlists", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("ライブラリDBを開けませんでした。"));
      request.onblocked = () => reject(new Error("別のタブがデータベース更新を妨げています。"));
    });
    return this.#db;
  }
  async #request(storeName, mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("データベース操作に失敗しました。"));
      tx.onabort = () => reject(tx.error || new Error("データベース操作が中断されました。"));
    });
  }
  async addFiles(files) {
    const db = await this.open();
    const records = Array.from(files || []).map(file => ({
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
      name: file.name,
      title: file.name.replace(/\.[^.]+$/, ""),
      artist: "不明なアーティスト",
      type: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified,
      addedAt: Date.now(),
      favorite: false,
      blob: file
    }));
    await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      records.forEach(record => store.put(record));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("音楽を保存できませんでした。"));
      tx.onabort = () => reject(tx.error || new Error("音楽の保存が中断されました。"));
    });
    return records.map(({ blob, ...record }) => record);
  }
  async getTracks() {
    const records = await this.#request("tracks", "readonly", store => store.getAll());
    return records.sort((a, b) => a.title.localeCompare(b.title, "ja"));
  }
  async getFiles() {
    const records = await this.#request("tracks", "readonly", store => store.getAll());
    return records.map(record => ({
      ...record,
      file: new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified })
    }));
  }
  async toggleFavorite(id) {
    const record = await this.#request("tracks", "readonly", store => store.get(id));
    if (!record) return null;
    record.favorite = !record.favorite;
    await this.#request("tracks", "readwrite", store => store.put(record));
    return record.favorite;
  }
  async createPlaylist(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("プレイリスト名を入力してください。");
    const playlist = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
      name: cleanName, trackIds: [], createdAt: Date.now()
    };
    await this.#request("playlists", "readwrite", store => store.put(playlist));
    return playlist;
  }
  async getPlaylists() {
    const items = await this.#request("playlists", "readonly", store => store.getAll());
    return items.sort((a, b) => a.createdAt - b.createdAt);
  }
  async addToPlaylist(playlistId, trackId) {
    const playlist = await this.#request("playlists", "readonly", store => store.get(playlistId));
    if (!playlist) return false;
    if (!playlist.trackIds.includes(trackId)) playlist.trackIds.push(trackId);
    await this.#request("playlists", "readwrite", store => store.put(playlist));
    return true;
  }
  close() { this.#db?.close(); this.#db = null; }
}