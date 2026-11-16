import { MUSIO_CONFIG } from "./config.js";
import { EventBus } from "./event-bus.js";

export class MusioSystem {
  #modules = new Map();
  #state = "created";

  constructor(config = MUSIO_CONFIG) {
    this.config = config;
    this.events = new EventBus();
    this.startedAt = null;
  }

  get state() {
    return this.#state;
  }

  get moduleCount() {
    return this.#modules.size;
  }

  register(name, module) {
    if (this.#state !== "created" && this.#state !== "initializing") {
      throw new Error("Modules can only be registered before the system starts.");
    }

    if (!name || typeof name !== "string") {
      throw new TypeError("A module name is required.");
    }

    if (!module || typeof module !== "object") {
      throw new TypeError(`Module "${name}" must be an object.`);
    }

    if (this.#modules.has(name)) {
      throw new Error(`Module "${name}" is already registered.`);
    }

    this.#modules.set(name, module);
    this.events.emit("system:module-registered", { name });
    return this;
  }

  getModule(name) {
    return this.#modules.get(name) ?? null;
  }

  getModuleNames() {
    return [...this.#modules.keys()];
  }

  async start() {
    if (this.#state === "running") return this;
    if (this.#state !== "created") {
      throw new Error(`Cannot start system from state: ${this.#state}`);
    }

    this.#state = "initializing";
    this.events.emit("system:initializing", { config: this.config });

    try {
      for (const [name, module] of this.#modules) {
        if (typeof module.init === "function") {
          await module.init(this);
        }
        this.events.emit("system:module-ready", { name });
      }

      this.startedAt = Date.now();
      this.#state = "running";
      this.events.emit("system:ready", {
        name: this.config.name,
        version: this.config.version,
        modules: this.getModuleNames()
      });

      return this;
    } catch (error) {
      this.#state = "failed";
      this.events.emit("system:error", { error });
      throw error;
    }
  }

  async stop() {
    if (this.#state !== "running") return;

    const modules = [...this.#modules.entries()].reverse();

    for (const [name, module] of modules) {
      if (typeof module.destroy === "function") {
        try {
          await module.destroy(this);
        } catch (error) {
          console.error(`[MUSIO] Failed to stop module "${name}".`, error);
        }
      }
    }

    this.#state = "stopped";
    this.events.emit("system:stopped");
  }

  getStatus() {
    return Object.freeze({
      name: this.config.name,
      version: this.config.version,
      state: this.#state,
      moduleCount: this.#modules.size,
      moduleNames: this.getModuleNames(),
      startedAt: this.startedAt
    });
  }
}