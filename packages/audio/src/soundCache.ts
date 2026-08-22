/** Opaque reference to a decoded sound. Mirrors `TextureHandle` in core. */
export interface SoundHandle { readonly id: string }

export interface SoundCache {
  load(url: string): Promise<SoundHandle>;
  loadAll(urls: Record<string, string>): Promise<Record<string, SoundHandle>>;
  decode(bytes: ArrayBuffer): Promise<SoundHandle>;
  /** Take ownership of a buffer the caller already has — a procedural synth,
   *  an OfflineAudioContext render, a recording. Synchronous; nothing to decode. */
  register(buffer: AudioBuffer): SoundHandle;
  buffer(handle: SoundHandle): AudioBuffer | null;
}

export function createSoundCache(
  ctx: AudioContext,
  fetchFn: typeof fetch = fetch,
): SoundCache {
  let counter = 0;
  const buffers = new Map<string, AudioBuffer>();
  const byUrl = new Map<string, SoundHandle>();
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
      return Object.fromEntries(names.map((n, i) => [n, handles[i]]));
    },
    async decode(bytes) {
      return store(await ctx.decodeAudioData(bytes));
    },
    register: (buffer) => store(buffer),
    buffer: (handle) => buffers.get(handle.id) ?? null,
  };
  return cache;
}
