/**
 * Tiles baked into textures of their own: each drawn into a multisampled scratch buffer the size
 * of a tile, resolved into a pooled single-sampled texture sampled bilinearly, and kept until the
 * owner releases it. A `TileDrawCommand` draws one.
 */
import type { GpuDevice, GpuTarget, GpuTexture } from '../gpu/types';

/** A baked tile, as a `TileDrawCommand` names it. Opaque: the renderer that baked it holds its texture. */
export interface TileTexture {
  readonly kind: 'tile-texture';
  /** Texels a side. */
  readonly size: number;
}

/** Freed textures kept for the next bake, of every size together: a fresh texture costs several reused ones. */
const POOL_KEPT = 16;

export class TileTextures {
  private readonly live = new Map<TileTexture, GpuTarget>();
  /** Freed textures by size, the size freed into least recently first. */
  private readonly pool = new Map<number, GpuTarget[]>();
  private pooled = 0;
  private scratch: GpuTarget | null = null;
  /** Scratch buffers of bakes spanning several calls, each held by one until it finishes. */
  private readonly owned = new Set<GpuTarget>();
  private readonly samples: number;
  /** Bumped when every texture is lost at once, as on context loss: a holder starts over. */
  generation = 0;

  constructor(private readonly gpu: GpuDevice) {
    const samples = gpu.limits.samples;
    this.samples = samples !== undefined && samples > 1 ? samples : 0;
  }

  /** GPU memory the tiles hold, the pool and the scratch buffer included. */
  get bytes(): number {
    let n = 0;
    for (const t of this.live.values()) n += t.bytes;
    for (const list of this.pool.values()) for (const t of list) n += t.bytes;
    for (const t of this.owned) n += t.bytes;
    return n + (this.scratch?.bytes ?? 0);
  }

  /** How many tiles are held. */
  get count(): number {
    return this.live.size;
  }

  /** The texture behind `tile`, or null once it was released or lost. */
  textureOf(tile: TileTexture): GpuTexture | null {
    return this.live.get(tile)?.color ?? null;
  }

  /** The scratch buffer a `size` tile draws into, multisampled as the canvas is. */
  scratchFor(size: number): GpuTarget {
    const held = this.scratch;
    if (held && held.width === size && held.height === size) return held;
    if (held) this.gpu.deleteTarget(held);
    this.scratch = this.gpu.createTarget({ width: size, height: size, samples: this.samples, stencil: true });
    return this.scratch;
  }

  /** A scratch buffer of a bake's own, kept until `keep` or `free` hands it back. */
  ownScratch(size: number): GpuTarget {
    const t = this.gpu.createTarget({ width: size, height: size, samples: this.samples, stencil: true });
    this.owned.add(t);
    return t;
  }

  /** Free a scratch buffer `ownScratch` made. Idempotent. */
  free(scratch: GpuTarget): void {
    if (this.owned.delete(scratch)) this.gpu.deleteTarget(scratch);
  }

  /** Keep what a scratch buffer holds, the shared one by default, as a new tile. */
  keep(size: number, scratch: GpuTarget = this.scratch!): TileTexture {
    const target = this.takePooled(size) ?? this.gpu.createTarget({ width: size, height: size, filter: 'linear' });
    this.gpu.resolve(scratch, target, size, size, 0, 0);
    const tile: TileTexture = { kind: 'tile-texture', size };
    this.live.set(tile, target);
    return tile;
  }

  private takePooled(size: number): GpuTarget | undefined {
    const list = this.pool.get(size);
    const target = list?.pop();
    if (list?.length === 0) this.pool.delete(size);
    if (target) this.pooled--;
    return target;
  }

  /** Give `tile`'s texture back to the pool, making room by freeing one of the size freed into longest
   *  ago. Idempotent. */
  release(tile: TileTexture): void {
    const target = this.live.get(tile);
    if (!target) return;
    this.live.delete(tile);
    const list = this.pool.get(tile.size) ?? [];
    this.pool.delete(tile.size);
    if (this.pooled >= POOL_KEPT) {
      const oldest = this.pool.entries().next().value;
      if (!oldest) {
        // Every pooled texture is this size already.
        this.gpu.deleteTarget(target);
        this.pool.set(tile.size, list);
        return;
      }
      const [size, from] = oldest;
      this.gpu.deleteTarget(from.shift()!);
      if (from.length === 0) this.pool.delete(size);
      this.pooled--;
    }
    list.push(target);
    this.pool.set(tile.size, list);
    this.pooled++;
  }

  /** Free the scratch buffer, which only a frame that bakes needs. */
  dropScratch(): void {
    if (this.scratch) this.gpu.deleteTarget(this.scratch);
    this.scratch = null;
  }

  /** Drop everything: on dispose, and on context loss, where the handles are already gone. */
  releaseAll(): void {
    for (const t of this.live.values()) this.gpu.deleteTarget(t);
    this.live.clear();
    for (const list of this.pool.values()) for (const t of list) this.gpu.deleteTarget(t);
    this.pool.clear();
    this.pooled = 0;
    for (const t of this.owned) this.gpu.deleteTarget(t);
    this.owned.clear();
    this.dropScratch();
    this.generation++;
  }
}
