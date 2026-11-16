export class EventBus {
  #listeners = new Map();

  on(eventName, callback) {
    if (typeof callback !== "function") {
      throw new TypeError("EventBus.on expects a function.");
    }

    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, new Set());
    }

    this.#listeners.get(eventName).add(callback);

    return () => this.off(eventName, callback);
  }

  once(eventName, callback) {
    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      callback(payload);
    });

    return unsubscribe;
  }

  off(eventName, callback) {
    const listeners = this.#listeners.get(eventName);
    if (!listeners) return false;

    const removed = listeners.delete(callback);
    if (listeners.size === 0) this.#listeners.delete(eventName);
    return removed;
  }

  emit(eventName, payload = undefined) {
    const listeners = this.#listeners.get(eventName);
    if (!listeners) return 0;

    for (const callback of [...listeners]) {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[MUSIO EventBus] Listener failed: ${eventName}`, error);
      }
    }

    return listeners.size;
  }

  clear(eventName = undefined) {
    if (eventName) {
      this.#listeners.delete(eventName);
      return;
    }

    this.#listeners.clear();
  }
}

export const musioEvents = new EventBus();