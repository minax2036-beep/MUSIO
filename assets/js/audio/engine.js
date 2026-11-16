export class AudioEngine {
  #audio;
  #events;
  #queue = [];
  #index = -1;
  #objectUrl = null;
  #destroyed = false;

  constructor(eventBus) {
    this.#events = eventBus;
    this.#audio = new Audio();
    this.#audio.preload = "metadata";
    this.#audio.volume = 0.8;

    this.#audio.addEventListener("loadedmetadata", () => {
      this.#emit("audio:metadata", this.getState());
      this.#emit("audio:loaded", this.getState());
    });
    this.#audio.addEventListener("timeupdate", () => {
      this.#emit("audio:timeupdate", this.getState());
    });
    this.#audio.addEventListener("play", () => this.#emit("audio:play", this.getState()));
    this.#audio.addEventListener("pause", () => this.#emit("audio:pause", this.getState()));
    this.#audio.addEventListener("ended", () => {
      this.#emit("audio:ended", this.getState());
      if (this.#index < this.#queue.length - 1) this.next();
      else this.#emit("queue:ended", this.getState());
    });
    this.#audio.addEventListener("volumechange", () => {
      this.#emit("audio:volumechange", this.getState());
    });
    this.#audio.addEventListener("error", () => {
      const error = this.#audio.error;
      this.#emit("audio:error", {
        ...this.getState(),
        message: error ? "このファイルを再生できません。形式やコーデックを確認してください。" : "音声の読み込みに失敗しました。"
      });
    });
  }

  #emit(name, payload) {
    this.#events?.emit(name, payload);
  }

  #releaseObjectUrl() {
    if (this.#objectUrl) {
      URL.revokeObjectURL(this.#objectUrl);
      this.#objectUrl = null;
    }
  }

  setQueue(files, startIndex = 0) {
    if (this.#destroyed) throw new Error("AudioEngine has been destroyed.");
    const validFiles = Array.from(files || []).filter((file) => file instanceof File);
    if (!validFiles.length) {
      this.clear();
      return;
    }

    this.#queue = validFiles;
    this.#index = Math.max(0, Math.min(Number(startIndex) || 0, this.#queue.length - 1));
    this.#loadCurrent();
    this.#emit("queue:change", this.getState());
  }

  #loadCurrent() {
    const file = this.#queue[this.#index];
    if (!file) return;

    this.#audio.pause();
    this.#releaseObjectUrl();
    this.#objectUrl = URL.createObjectURL(file);
    this.#audio.src = this.#objectUrl;
    this.#audio.load();
    this.#emit("track:change", this.getState());
  }

  async play() {
    if (!this.#audio.src && this.#queue.length) this.#loadCurrent();
    if (!this.#audio.src) return false;

    try {
      await this.#audio.play();
      return true;
    } catch (error) {
      this.#emit("audio:error", {
        ...this.getState(),
        message: error?.message || "再生を開始できませんでした。"
      });
      return false;
    }
  }

  pause() {
    this.#audio.pause();
  }

  async toggle() {
    if (this.#audio.paused) return this.play();
    this.pause();
    return true;
  }

  async next() {
    if (this.#index >= this.#queue.length - 1) return false;
    this.#index += 1;
    this.#loadCurrent();
    await this.play();
    this.#emit("queue:change", this.getState());
    return true;
  }

  async previous() {
    if (this.#audio.currentTime > 3) {
      this.seek(0);
      return true;
    }
    if (this.#index <= 0) {
      this.seek(0);
      return false;
    }
    this.#index -= 1;
    this.#loadCurrent();
    await this.play();
    this.#emit("queue:change", this.getState());
    return true;
  }

  seek(seconds) {
    if (!Number.isFinite(this.#audio.duration)) return;
    const target = Math.max(0, Math.min(Number(seconds) || 0, this.#audio.duration));
    this.#audio.currentTime = target;
  }

  setVolume(value) {
    this.#audio.volume = Math.max(0, Math.min(1, Number(value) || 0));
  }

  setMuted(muted) {
    this.#audio.muted = Boolean(muted);
  }

  clear() {
    this.#audio.pause();
    this.#audio.removeAttribute("src");
    this.#audio.load();
    this.#releaseObjectUrl();
    this.#queue = [];
    this.#index = -1;
    this.#emit("track:change", this.getState());
    this.#emit("queue:change", this.getState());
  }

  getState() {
    const file = this.#queue[this.#index] || null;
    return {
      track: file,
      title: file ? file.name.replace(/\.[^.]+$/, "") : "再生していません",
      fileName: file?.name || "",
      index: this.#index,
      queueLength: this.#queue.length,
      currentTime: Number.isFinite(this.#audio.currentTime) ? this.#audio.currentTime : 0,
      duration: Number.isFinite(this.#audio.duration) ? this.#audio.duration : 0,
      paused: this.#audio.paused,
      volume: this.#audio.volume,
      muted: this.#audio.muted
    };
  }

  destroy() {
    if (this.#destroyed) return;
    this.clear();
    this.#destroyed = true;
  }
}
