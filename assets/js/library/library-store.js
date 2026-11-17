export class LibraryStore {
  #db = null;

  constructor(config = {}) {
    this.databaseName = config.databaseName || "musio-db";
    this.databaseVersion = config.databaseVersion || 2;
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
        if (!db.objectStoreNames.contains("playlists")) {
          db.createObjectStore("playlists", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
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
    const candidates = Array.from(files || []).map(item => {
      const wrapped = item && item.file instanceof File;
      const file = wrapped ? item.file : item;
      const sourcePath = wrapped ? item.relativePath || file.name : "";
      const sourceKey = wrapped
        ? [item.sourceId || "folder", sourcePath, file.size, file.lastModified].join("|")
        : null;
      return { file, sourcePath, sourceKey };
    }).filter(item => item.file instanceof File);

    return new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      const request = store.getAll();
      let result = { added: 0, skipped: 0, records: [] };

      request.onsuccess = () => {
        const existingKeys = new Set(
          request.result.map(record => record.sourceKey).filter(Boolean)
        );
        for (const candidate of candidates) {
          if (candidate.sourceKey && existingKeys.has(candidate.sourceKey)) {
            result.skipped += 1;
            continue;
          }
          const file = candidate.file;
          const record = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
            name: file.name,
            title: file.name.replace(/\.[^.]+$/, ""),
            artist: "不明なアーティスト",
            type: file.type || "application/octet-stream",
            size: file.size,
            lastModified: file.lastModified,
            addedAt: Date.now(),
            favorite: false,
            sourcePath: candidate.sourcePath || "",
            sourceKey: candidate.sourceKey,
            blob: file
          };
          store.put(record);
          existingKeys.add(candidate.sourceKey);
          result.records.push(record);
          result.added += 1;
        }
      };
      request.onerror = () => {
        try { tx.abort(); } catch {}
        reject(request.error || new Error("既存ライブラリを確認できませんでした。"));
      };
      tx.oncomplete = () => resolve({
        added: result.added,
        skipped: result.skipped,
        records: result.records.map(({ blob, ...record }) => record)
      });
      tx.onerror = () => reject(tx.error || new Error("音楽を保存できませんでした。"));
      tx.onabort = () => reject(tx.error || new Error("音楽の保存が中断されました。"));
    });
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
      name: cleanName,
      trackIds: [],
      createdAt: Date.now()
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

  async saveSetting(key, value) {
    await this.#request("settings", "readwrite", store => store.put({ key, value }));
  }

  async getSetting(key) {
    const result = await this.#request("settings", "readonly", store => store.get(key));
    return result ? result.value : null;
  }

  async removeSetting(key) {
    await this.#request("settings", "readwrite", store => store.delete(key));
  }

  close() {
    this.#db?.close();
    this.#db = null;
  }
}