export class VideoEngine {
  constructor(videoElement) {
    if (!(videoElement instanceof HTMLVideoElement)) throw new TypeError("A video element is required.");
    this.video = videoElement;
    this.objectUrl = null;
  }
  load(file) {
    if (!(file instanceof File)) throw new TypeError("A video File is required.");
    this.clear();
    this.objectUrl = URL.createObjectURL(file);
    this.video.src = this.objectUrl;
    this.video.load();
  }
  clear() {
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
  destroy() { this.clear(); }
}
