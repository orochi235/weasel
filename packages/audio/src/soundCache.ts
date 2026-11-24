/** Opaque reference to a decoded sound. Mirrors `TextureHandle` in core. */
export interface SoundHandle { readonly id: string }

/** Decoded buffers behind opaque `SoundHandle`s, each held until `free` or `clear`. */
export interface SoundCache {
  load(url: string): Promise<SoundHandle>;
  /** One handle per key of `urls`, in a record with no prototype. */
  loadAll(urls: Record<string, string>): Promise<Record<string, SoundHandle>>;
  decode(bytes: ArrayBuffer): Promise<SoundHandle>;
  /** Take ownership of a buffer the caller already has — a procedural synth,
   *  an OfflineAudioContext render, a recording. Synchronous; nothing to decode. */
  register(buffer: AudioBuffer): SoundHandle;
  buffer(handle: SoundHandle): AudioBuffer | null;
  /** Let go of a handle's buffer. A voice already playing it plays on; one that
   *  comes due later drops as `unready`, and a later `load` of its url fetches it again. */
  free(handle: SoundHandle): void;
  /** `free` every handle. */
  clear(): void;
}

// Shared by every cache, so a handle names one buffer on the page and another engine's cache never answers it.
let counter = 0;

/** Create a cache that decodes through `ctx`. `load` fetches with `fetchFn`,
 *  returns the existing handle for a url already loaded, and shares one fetch
 *  between concurrent loads of it; a failed load is not cached. */
export function createSoundCache(
  ctx: AudioContext,
  fetchFn: typeof fetch = fetch,
): SoundCache {
  const buffers = new Map<string, AudioBuffer>();
  const byUrl = new Map<string, SoundHandle>();
  const urlById = new Map<string, string>();
  // In-flight loads, so two concurrent `load` calls for one url share a fetch.
  const inflight = new Map<string, Promise<SoundHandle>>();

  const store = (buffer: AudioBuffer): SoundHandle => {
    const id = `snd_${++counter}`;
    buffers.set(id, buffer);
    return { id };
  };

  const cache: SoundCache = {
    async load(url) {
      const existing = byUrl.get(url);
      if (existing) return existing;
      const pending = inflight.get(url);
      if (pending) return pending;

      const task = (async () => {
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`@weasel-js/audio: failed to load ${url} (${res.status})`);
        const bytes = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(bytes);
        const handle = store(buffer);
        byUrl.set(url, handle);
        urlById.set(handle.id, url);
        return handle;
      })();

      inflight.set(url, task);
      try {
        return await task;
      } finally {
        // Always clear: a failed load must not be cached, or a retry can never
        // succeed for the lifetime of the page.
        inflight.delete(url);
      }
    },
    async loadAll(urls) {
      const names = Object.keys(urls);
      const handles = await Promise.all(names.map((n) => cache.load(urls[n])));
      // Null-prototype: a misspelled key reads undefined, never an `Object.prototype` member.
      return Object.assign(Object.create(null) as Record<string, SoundHandle>, Object.fromEntries(names.map((n, i) => [n, handles[i]])));
    },
    async decode(bytes) {
      return store(await ctx.decodeAudioData(bytes));
    },
    register: (buffer) => store(buffer),
    buffer: (handle) => buffers.get(handle.id) ?? null,
    free(handle) {
      buffers.delete(handle.id);
      const url = urlById.get(handle.id);
      if (url === undefined) return;
      urlById.delete(handle.id);
      byUrl.delete(url);
    },
    clear() {
      buffers.clear();
      byUrl.clear();
      urlById.clear();
    },
  };
  return cache;
}
