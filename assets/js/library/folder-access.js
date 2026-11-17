const AUDIO_EXTENSIONS = /\.(mp3|flac|wav|m4a|aac|ogg|opus|aiff|aif|wma)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|mkv|avi)$/i;

export class FolderAccess {
  get supported() {
    return typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof window.showDirectoryPicker === "function";
  }

  async chooseDirectory() {
    if (!this.supported) {
      throw new Error("このブラウザではフォルダアクセスに対応していません。HTTPS対応のChromium系ブラウザを利用してください。");
    }
    const handle = await window.showDirectoryPicker({ mode: "read" });
    const permission = await handle.requestPermission({ mode: "read" });
    if (permission !== "granted") {
      throw new Error("フォルダへのアクセスが許可されませんでした。");
    }
    return handle;
  }

  async getPermission(handle, request = false) {
    if (!handle) return "missing";
    const options = { mode: "read" };
    if (request && typeof handle.requestPermission === "function") {
      return handle.requestPermission(options);
    }
    if (typeof handle.queryPermission === "function") {
      return handle.queryPermission(options);
    }
    return "prompt";
  }

  async scan(handle, kind = "audio") {
    const extensions = kind === "video" ? VIDEO_EXTENSIONS : AUDIO_EXTENSIONS;
    const permission = await this.getPermission(handle);
    if (permission !== "granted") {
      throw new Error("フォルダへのアクセス権限がありません。「フォルダを選択」から再許可してください。");
    }

    const results = [];
    const walk = async (directory, prefix = "") => {
      for await (const entry of directory.values()) {
        const relativePath = prefix ? prefix + "/" + entry.name : entry.name;
        if (entry.kind === "directory") {
          await walk(entry, relativePath);
        } else if (entry.kind === "file" && extensions.test(entry.name)) {
          const file = await entry.getFile();
          results.push({ file, relativePath });
        }
      }
    };
    await walk(handle);
    return results;
  }
}
