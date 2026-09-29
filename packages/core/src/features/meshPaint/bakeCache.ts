/**
 * How large a mesh bake is, and the bounded cache the bakes live in.
 *
 * A gradient's ramp is one-dimensional, so 256 texels cover it at any size. A
 * mesh's bake is two-dimensional and is stretched over whatever the paint
 * covers, so a fixed size shows its texels once the paint draws large. The
 * bake is sized from the device pixels it covers instead, in power-of-two
 * buckets so a zoom inside one bucket reuses the bake it already has.
 */

import { MESH_BAKE_SIZE } from './bake';

/** The smallest bake: below this a texture costs more in bookkeeping than in
 *  bytes. */
export const MESH_BAKE_MIN = 32;

/** The largest bake, whatever the context allows: 16 MiB of RGBA, and a bake
 *  that already takes a noticeable moment on the CPU. */
export const MESH_BAKE_MAX = 2048;

/** Bytes of baked texture one renderer keeps before evicting the least
 *  recently drawn. */
export const MESH_BAKE_CACHE_BYTES = 64 * 1024 * 1024;

/** Bakes one renderer keeps, however small, so a scene of many tiny meshes
 *  cannot hold thousands of GL textures. */
export const MESH_BAKE_CACHE_ENTRIES = 256;

/**
 * The bake side for a paint drawn `devicePx` device pixels across, on a
 * context accepting `maxTextureSize`: the next power of two at or above it,
 * clamped to `[MESH_BAKE_MIN, MESH_BAKE_MAX]` and to the context. A size that
 * cannot be measured gets `MESH_BAKE_SIZE`.
 */
export function meshBakeSize(devicePx: number, maxTextureSize: number): number {
  const ceiling = Math.min(MESH_BAKE_MAX, floorPow2(maxTextureSize));
  if (Number.isNaN(devicePx)) return Math.min(MESH_BAKE_SIZE, ceiling);
  if (devicePx <= MESH_BAKE_MIN) return Math.min(MESH_BAKE_MIN, ceiling);
  if (devicePx >= ceiling) return ceiling;
  return Math.min(ceiling, 2 ** Math.ceil(Math.log2(devicePx)));
}

function floorPow2(n: number): number {
  if (!(n >= 1)) return MESH_BAKE_MIN;
  if (!Number.isFinite(n)) return MESH_BAKE_MAX;
  return 2 ** Math.floor(Math.log2(n));
}

interface Entry<T> {
  value: T;
  size: number;
  /** The paint's own bucket map, which is what eviction removes it from. */
  bySize: Map<number, Entry<T>>;
}

/**
 * Bakes keyed by paint and bake size, least recently used first out.
 *
 * The paint is held weakly, so a paint nobody draws any more does not pin its
 * key; its texture stays until eviction reaches it, which the bounds keep
 * finite. `free` runs for every value that leaves, by eviction, replacement or
 * `clear`.
 */
export class MeshBakeCache<T> {
  private readonly byPaint = new WeakMap<object, Map<number, Entry<T>>>();
  /** Insertion order is recency: a hit is deleted and re-added. */
  private readonly order = new Set<Entry<T>>();
  private held = 0;

  constructor(
    private readonly free: (value: T) => void,
    private readonly budgetBytes: number = MESH_BAKE_CACHE_BYTES,
    private readonly maxEntries: number = MESH_BAKE_CACHE_ENTRIES,
  ) {}

  /** Bytes the held bakes occupy, as RGBA8. */
  get bytes(): number { return this.held; }

  /** Bakes held. */
  get size(): number { return this.order.size; }

  get(paint: object, size: number): T | undefined {
    const entry = this.byPaint.get(paint)?.get(size);
    if (!entry) return undefined;
    this.order.delete(entry);
    this.order.add(entry);
    return entry.value;
  }

  set(paint: object, size: number, value: T): void {
    let bySize = this.byPaint.get(paint);
    if (!bySize) {
      bySize = new Map();
      this.byPaint.set(paint, bySize);
    }
    const old = bySize.get(size);
    if (old) this.drop(old);
    const entry: Entry<T> = { value, size, bySize };
    bySize.set(size, entry);
    this.order.add(entry);
    this.held += size * size * 4;
    this.evict(entry);
  }

  /** Free every bake. The cache stays usable. */
  clear(): void {
    for (const entry of [...this.order]) this.drop(entry);
  }

  /** Oldest first until both bounds hold, never evicting `keep` — the bake
   *  the caller is about to draw. */
  private evict(keep: Entry<T>): void {
    for (const entry of this.order) {
      if (this.held <= this.budgetBytes && this.order.size <= this.maxEntries) return;
      if (entry !== keep) this.drop(entry);
    }
  }

  private drop(entry: Entry<T>): void {
    if (!this.order.delete(entry)) return;
    entry.bySize.delete(entry.size);
    this.held -= entry.size * entry.size * 4;
    this.free(entry.value);
  }
}
