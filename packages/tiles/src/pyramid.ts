/**
 * One frame of a tile pyramid: which level the view wants, what to draw for each tile on screen
 * (the tile, or a coarser one held above it and any finer ones held below), and which tiles to bake
 * in what order under a budget. The payload and how it is baked are the caller's.
 */
import { TileCache, type HeldTile, type TileCacheOptions } from './cache';
import type { TileBox, TileScheme } from './scheme';

/** One quad of a frame: draw `tile`'s payload over `at`'s bounds, sampling `source` of it, at `alpha`. */
export interface TileDraw<K, P> {
  /** The spot on screen it fills. */
  readonly at: K;
  readonly tile: HeldTile<K, P>;
  /** The part of the payload to sample, `[min…, max…]` as fractions of the tile's own extent. */
  readonly source: Float64Array;
  readonly alpha: number;
}

/** What a frame of the pyramid came to. */
export interface TileFrame<K, P> {
  readonly level: number;
  /** Coarse to fine: draw in order, each over the last. */
  readonly draws: readonly TileDraw<K, P>[];
  /** The view is past `maxLevel`: draw the content live instead. */
  readonly live: boolean;
  readonly baked: number;
  /** Tiles still wanted after this frame's budget: the caller asks for another frame while any are. */
  readonly pending: number;
  /** A tile is still fading in: the caller asks for another frame. */
  readonly fading: boolean;
  /** Stale tiles drawn on screen this frame. */
  readonly stale: readonly K[];
}

/** How much a frame may bake: at least one tile whenever any is wanted. */
export interface TileBudget {
  /** Milliseconds of `clock` to spend. */
  readonly ms: number;
  /** The most tiles, which caps the GPU work the clock cannot see. */
  readonly tiles: number;
  readonly clock: () => number;
}

/** A pyramid's scheme and cache bounds, its deepest level, fade time and floor. */
export interface TilePyramidOptions<K, V, P> extends TileCacheOptions<P> {
  scheme: TileScheme<K, V>;
  /** The tiles always held, never evicted, so something can always stand in: the content at a level
   *  where it fits a few tiles a side. */
  floor(): readonly K[];
  /** Past this level the content draws live. */
  maxLevel?: number;
  /** Fade a tile in over its stand-in for this long. Default 160. */
  fadeMs?: number;
  /** Levels searched above a missing tile for a stand-in. Default 8. */
  standInLevels?: number;
  /** Levels searched below it. Default 2. */
  finerLevels?: number;
  /** Bytes one tile takes, which decides when the screen alone would break the byte bound. */
  bytesPerTile?: number;
}

/** A tile pyramid: a {@link TileCache} and the frames planned over it. */
export class TilePyramid<K, V, P> {
  readonly cache: TileCache<K, P>;
  private frameNo = 0;
  private level: number | undefined;

  constructor(private readonly opts: TilePyramidOptions<K, V, P>) {
    this.cache = new TileCache(opts.scheme as TileScheme<K, unknown>, opts);
  }

  get frame(): number {
    return this.frameNo;
  }

  /** Mark held tiles meeting `box` stale. */
  dirty(box: TileBox, padTexels = 1): number {
    return this.cache.dirty(box, this.frameNo, padTexels);
  }

  dirtyAll(): void {
    this.cache.dirtyAll(this.frameNo);
  }

  /** Plan and run one frame under `view`: bake what the budget allows with `bake`, and answer what to draw. */
  run(view: V, now: number, bake: (key: K) => P | null, budget: TileBudget): TileFrame<K, P> {
    const { scheme } = this.opts;
    const frame = ++this.frameNo;
    let level = scheme.levelFor(view, this.level);
    const maxLevel = this.opts.maxLevel ?? Infinity;
    if (level > maxLevel) {
      this.level = level;
      return { level, draws: [], live: true, baked: 0, pending: 0, fading: false, stale: [] };
    }
    const floor = this.opts.floor();
    let wanted = scheme.wanted(view, level);
    // The screen and the floor alone would break the byte bound: a coarser level needs a quarter of
    // the tiles, at half the sharpness. Its tiles and their stand-ins all fit.
    const per = this.opts.bytesPerTile;
    const fits = () => per === undefined || (2 * wanted.filter((w) => !w.ring).length + floor.length) * per <= this.cache.maxBytes;
    while (!fits() && level > -64) {
      level--;
      wanted = scheme.wanted(view, level);
    }
    this.level = level;
    const onScreen = wanted.filter((w) => !w.ring).map((w) => w.key);
    const ring = wanted.filter((w) => w.ring).map((w) => w.key);
    this.cache.pinFloor(floor.map((k) => scheme.idOf(k)));

    const { order, waiting } = this.bakeOrder(floor, onScreen, ring, level, view, frame);
    let baked = 0;
    const start = budget.clock();
    for (const key of order) {
      if (baked > 0 && (baked >= budget.tiles || budget.clock() - start >= budget.ms)) break;
      const payload = bake(key);
      baked++;
      if (payload !== null) this.cache.put(key, payload, frame, now);
    }
    const pending = order.length - baked + waiting;

    const floorLevel = Math.min(...floor.map((k) => scheme.levelOf(k)));
    const { draws, fading, stale } = this.drawsFor(onScreen, frame, now, floorLevel);
    this.cache.trim(frame, onScreen.length + ring.length + floor.length);
    return { level, draws, live: false, baked, pending, fading, stale };
  }

  /** Free every tile. */
  clear(): void {
    this.cache.clear();
    this.level = undefined;
  }

  private needs(key: K, frame: number): 'missing' | 'stale' | 'waiting' | null {
    const t = this.cache.get(this.opts.scheme.idOf(key));
    if (t === undefined) return 'missing';
    if (!t.stale) return null;
    // A stale tile rebakes once its damage has held still for a frame.
    return t.dirtiedAt < frame - 1 ? 'stale' : 'waiting';
  }

  /** Floor, then what is missing on screen, then what is stale there, then the level above and the ring;
   *  and how many stale tiles wait out their hold before they can join it. */
  private bakeOrder(floor: readonly K[], onScreen: readonly K[], ring: readonly K[], level: number, view: V, frame: number): { order: K[]; waiting: number } {
    const { scheme } = this.opts;
    const seen = new Set<string>();
    const out: K[] = [];
    let waiting = 0;
    const take = (k: K, want: 'missing' | 'stale' | 'either') => {
      const id = scheme.idOf(k);
      if (seen.has(id)) return;
      const need = this.needs(k, frame);
      if (need === null || (want !== 'either' && (need === 'missing') !== (want === 'missing'))) return;
      seen.add(id);
      if (need === 'waiting') waiting++;
      else out.push(k);
    };
    for (const k of floor) take(k, 'either');
    for (const k of onScreen) take(k, 'missing');
    for (const k of onScreen) take(k, 'stale');
    for (const w of scheme.wanted(view, level - 1)) if (!w.ring) take(w.key, 'either');
    for (const k of ring) take(k, 'either');
    return { order: out, waiting };
  }

  private drawsFor(onScreen: readonly K[], frame: number, now: number, floorLevel: number) {
    const { scheme } = this.opts;
    const fadeMs = this.opts.fadeMs ?? 160;
    const up = this.opts.standInLevels ?? 8;
    const down = this.opts.finerLevels ?? 2;
    const coarse: TileDraw<K, P>[] = [];
    const fine: TileDraw<K, P>[][] = [];
    const own: TileDraw<K, P>[] = [];
    const stale: K[] = [];
    let fading = false;
    const unit = new Float64Array(2 * scheme.dim).fill(1, scheme.dim);
    const whole = (_k: K): Float64Array => unit;
    const mark = (t: HeldTile<K, P>) => {
      if (t.stale && t.drawnAt !== frame) stale.push(t.key);
      t.drawnAt = frame;
    };
    for (const at of onScreen) {
      const t = this.cache.get(scheme.idOf(at));
      const alpha = t === undefined ? 0 : fadeMs > 0 ? Math.min(1, Math.max(0, (now - t.bornAt) / fadeMs)) : 1;
      if (t !== undefined && alpha >= 1) {
        mark(t);
        own.push({ at, tile: t, source: whole(at), alpha: 1 });
        continue;
      }
      // Missing, or fading in: something coarser underneath, and what is finer over that.
      const anc = this.ancestorHeld(at, up, floorLevel);
      if (anc !== null) {
        mark(anc);
        coarse.push({ at, tile: anc, source: subRect(scheme, anc.key, at), alpha: 1 });
      }
      if (t === undefined) this.finerHeld(at, down, 1, (child, depth) => {
        mark(child);
        (fine[depth] ??= []).push({ at: child.key, tile: child, source: whole(child.key), alpha: 1 });
      });
      if (t !== undefined) {
        mark(t);
        fading = true;
        own.push({ at, tile: t, source: whole(at), alpha });
      }
    }
    return { draws: [...coarse, ...fine.flat(), ...own], fading, stale };
  }

  /** The nearest held tile within `levels` above `key`, or past them the floor tile holding it. */
  private ancestorHeld(key: K, levels: number, floorLevel: number): HeldTile<K, P> | null {
    const { scheme } = this.opts;
    let k: K | null = key;
    for (let i = 0; ; i++) {
      k = scheme.parentOf(k);
      if (k === null || (i >= levels && !(scheme.levelOf(k) >= floorLevel))) return null;
      const t = this.cache.get(scheme.idOf(k));
      if (t !== undefined && (i < levels || this.cache.isFloor(t.id))) return t;
    }
  }

  private finerHeld(key: K, levels: number, depth: number, visit: (t: HeldTile<K, P>, depth: number) => void): void {
    if (levels <= 0) return;
    const { scheme } = this.opts;
    for (const c of scheme.childrenOf(key)) {
      const t = this.cache.get(scheme.idOf(c));
      if (t !== undefined) visit(t, depth);
      else this.finerHeld(c, levels - 1, depth + 1, visit);
    }
  }
}

/** Where `inner`'s extent lies in `outer`'s, as fractions of `outer`'s: `[min…, max…]`. */
export function subRect<K>(scheme: TileScheme<K, unknown>, outer: K, inner: K): Float64Array {
  const a = scheme.boundsOf(outer), b = scheme.boundsOf(inner);
  const d = scheme.dim, out = new Float64Array(2 * d);
  for (let i = 0; i < d; i++) {
    const span = a[d + i]! - a[i]!;
    out[i] = (b[i]! - a[i]!) / span;
    out[d + i] = (b[d + i]! - a[i]!) / span;
  }
  return out;
}
