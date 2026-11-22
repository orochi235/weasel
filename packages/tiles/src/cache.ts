/**
 * The tiles a pyramid holds: each key's payload, whether an edit has made it stale, when it was
 * last drawn, and when it arrived. Bounded by count and by bytes together, least recently drawn
 * evicted first, never a floor tile and never one drawn this frame.
 */
import { boxesMeet, type TileBox, type TileScheme } from './scheme';

/** One held tile. A stale one still stands in until a fresh bake replaces it. */
export interface HeldTile<K, P> {
  readonly key: K;
  readonly id: string;
  payload: P;
  bytes: number;
  stale: boolean;
  /** The frame it was last drawn in. */
  drawnAt: number;
  /** When it arrived, on the frame clock, for its fade; `-Infinity` for one that replaced a stale one. */
  bornAt: number;
  /** The last frame an edit marked it stale in. */
  dirtiedAt: number;
}

/** How a cache sizes and frees payloads, and how far it may grow. */
export interface TileCacheOptions<P> {
  bytesOf(payload: P): number;
  /** Free a payload the cache dropped. */
  release(payload: P): void;
  /** The most bytes held at once. Default `Infinity`. */
  maxBytes?: number;
  /** The count bound never falls below this. Default 128. */
  minCount?: number;
}

export const DEFAULT_MIN_TILE_COUNT = 128;

export class TileCache<K, P> {
  private readonly held = new Map<string, HeldTile<K, P>>();
  private readonly floor = new Set<string>();
  private total = 0;

  constructor(readonly scheme: TileScheme<K, unknown>, private readonly opts: TileCacheOptions<P>) {}

  get(id: string): HeldTile<K, P> | undefined {
    return this.held.get(id);
  }

  get count(): number {
    return this.held.size;
  }

  get bytes(): number {
    return this.total;
  }

  get maxBytes(): number {
    return this.opts.maxBytes ?? Infinity;
  }

  /** Every tile held. */
  tiles(): IterableIterator<HeldTile<K, P>> {
    return this.held.values();
  }

  /** Keep `payload` as `key`'s, freeing what it replaces. A tile arriving where nothing was fades
   *  in from `now`; one replacing a stale tile does not. */
  put(key: K, payload: P, frame: number, now: number): HeldTile<K, P> {
    const id = this.scheme.idOf(key);
    const was = this.held.get(id);
    if (was) this.drop(was);
    const tile: HeldTile<K, P> = {
      key, id, payload, bytes: this.opts.bytesOf(payload), stale: false, drawnAt: frame, bornAt: was ? -Infinity : now, dirtiedAt: -1,
    };
    this.held.set(id, tile);
    this.total += tile.bytes;
    return tile;
  }

  /** Mark `ids` the floor: never evicted. Replaces the previous floor. */
  pinFloor(ids: Iterable<string>): void {
    this.floor.clear();
    for (const id of ids) this.floor.add(id);
  }

  isFloor(id: string): boolean {
    return this.floor.has(id);
  }

  /** Mark every held tile meeting `box` stale in `frame`, `box` grown by `padTexels` at each tile's
   *  own level. Answers how many it marked. */
  dirty(box: TileBox, frame: number, padTexels = 1): number {
    const dim = this.scheme.dim;
    let n = 0;
    const grown = new Float64Array(2 * dim);
    for (const tile of this.held.values()) {
      const pad = padTexels / this.scheme.texelsPerUnit(tile.key);
      for (let i = 0; i < dim; i++) {
        grown[i] = box[i]! - pad;
        grown[dim + i] = box[dim + i]! + pad;
      }
      if (boxesMeet(grown, this.scheme.boundsOf(tile.key), dim)) {
        tile.stale = true;
        tile.dirtiedAt = frame;
        n++;
      }
    }
    return n;
  }

  /** Mark every held tile stale in `frame`. */
  dirtyAll(frame: number): void {
    for (const tile of this.held.values()) {
      tile.stale = true;
      tile.dirtiedAt = frame;
    }
  }

  /**
   * Evict least recently drawn first until the count is at most twice `workingSet` (and never below
   * the minimum) and the bytes within the bound. A floor tile and one drawn in `frame` stay.
   */
  trim(frame: number, workingSet: number): void {
    const maxCount = Math.max(2 * workingSet, this.opts.minCount ?? DEFAULT_MIN_TILE_COUNT);
    const maxBytes = this.maxBytes;
    if (this.held.size <= maxCount && this.total <= maxBytes) return;
    const order = [...this.held.values()]
      .filter((t) => t.drawnAt !== frame && !this.floor.has(t.id))
      .sort((a, b) => a.drawnAt - b.drawnAt);
    for (const tile of order) {
      if (this.held.size <= maxCount && this.total <= maxBytes) break;
      this.drop(tile);
    }
  }

  /** Free every tile. */
  clear(): void {
    for (const tile of [...this.held.values()]) this.drop(tile);
    this.floor.clear();
  }

  private drop(tile: HeldTile<K, P>): void {
    this.held.delete(tile.id);
    this.total -= tile.bytes;
    this.opts.release(tile.payload);
  }
}
