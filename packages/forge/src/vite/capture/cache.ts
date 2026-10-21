/** Captured PNGs by payload key, least recently used out first. */
export interface CaptureCache {
  get(key: string): Buffer | undefined;
  set(key: string, png: Buffer): void;
  clear(): void;
  readonly size: number;
  /** The PNG bytes held, in all. */
  readonly bytes: number;
}

/** A cache bounded both by entry count and by bytes; an image larger than the byte budget is not kept at all. */
export function createCaptureCache(limits: { entries: number; bytes: number } = { entries: 64, bytes: 64 * 1024 * 1024 }): CaptureCache {
  // A Map iterates in insertion order, so re-inserting on every read keeps the least recently used first.
  const held = new Map<string, Buffer>();
  let bytes = 0;
  const drop = (key: string) => {
    const png = held.get(key);
    if (!png) return;
    held.delete(key);
    bytes -= png.length;
  };
  return {
    get(key) {
      const png = held.get(key);
      if (!png) return undefined;
      held.delete(key);
      held.set(key, png);
      return png;
    },
    set(key, png) {
      drop(key);
      if (png.length > limits.bytes) return;
      held.set(key, png);
      bytes += png.length;
      for (const oldest of held.keys()) {
        if (held.size <= limits.entries && bytes <= limits.bytes) break;
        drop(oldest);
      }
    },
    clear() {
      held.clear();
      bytes = 0;
    },
    get size() {
      return held.size;
    },
    get bytes() {
      return bytes;
    },
  };
}
