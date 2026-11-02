import { wrapAngle } from '@weasel-js/geom';

/**
 * One hold on each of any number of a store's rows, its values and weights kept as rows of flat
 * arrays: `values` laid out as the rows' committed values, `weights` one a row. A row's holds
 * are its layers that hold it, and they are alternatives mixed by weight.
 */
export interface HoldLayer {
  /** Row `r`'s held value at `r * axes`. A new array once the store grows. */
  readonly values: Float64Array;
  /** Row `r`'s weight, read as 0 to 1. A new array once the store grows. */
  readonly weights: Float64Array;
  /** Nonzero at each row the layer holds. */
  readonly has: Uint8Array;
}

/** Where a row's hold in a layer gets its value and weight, when the layer is not written. */
export interface HoldSources {
  /** Writes the value to hold into `out` from `at`. */
  value?(out: Float64Array, at: number): void;
  weight?(): number;
  /** The axes it holds, nonzero at each; null for all of them. */
  covers?: Uint8Array | null;
  /** True where `value` and `weight` answer the same until the row is touched: they are then
   *  asked as it is held and touched, and on no frame of their own. */
  fixed?: boolean;
}

/** Holds folded per row into what they add to its committed value. */
export interface HoldStore {
  readonly axes: number;
  /** What the holds on row `r` add to its committed value, at `r * axes`: 0 where none hold it. */
  readonly delta: Float64Array;
  /** The share of each of row `r`'s axes its holds cover, 0 to 1, laid out as `delta`. */
  readonly cover: Float64Array;
  /** Row `r`'s committed value as its holds were last folded against, laid out as `delta`. */
  readonly at: Float64Array;
  /** How many holds stand on row `r`. */
  readonly count: Int32Array;
  /** The rows held, the first `size` of them, in no order. */
  readonly held: Int32Array;
  readonly size: number;
  /** Makes room for `rows` rows. */
  grow(rows: number): void;
  /** A layer of its own, holding no row yet. */
  layer(): HoldLayer;
  /** A layer that does not hold `row`, made where every one does. */
  free(row: number): HoldLayer;
  /** Takes `row` into `layer`, asking `sources` for its value and weight from here. */
  join(layer: HoldLayer, row: number, sources?: HoldSources): void;
  /** Takes `row` out of `layer`. */
  part(layer: HoldLayer, row: number): void;
  /** Drops `layer`, which holds no row. */
  drop(layer: HoldLayer): void;
  /** Asks the sources of every row held by a hold that is not fixed, and folds those rows. */
  frame(): void;
  /** Asks `row`'s sources and folds it against its committed value now. */
  refold(row: number): void;
  /** Folds `row`'s holds against `committed` from `at`, leaving out `skip`: what they add to
   *  each axis into `delta` and the weight holding it into `total`. Asks nothing. */
  fold(row: number, committed: ArrayLike<number>, at: number, skip: HoldLayer | null, delta: number[], total: number[]): void;
  /** `row`'s value in `layer`, as it was last asked or written. */
  valueOf(layer: HoldLayer, row: number): number[];
}

interface Layer extends HoldLayer {
  values: Float64Array;
  weights: Float64Array;
  has: Uint8Array;
  /** Row `r`'s held axes at `r * axes`, nonzero at each; null while every row holds all. */
  covers: Uint8Array | null;
  sources: (HoldSources | undefined)[];
  /** Made by `free`, to hold rows one at a time for whoever asks. */
  pooled: boolean;
  /** The rows whose sources are asked every frame. */
  asked: Set<number>;
}

const share = (w: number): number => (w > 0 ? Math.min(w, 1) : 0);

function wider<A extends Float64Array | Uint8Array | Int32Array>(a: A, length: number, fill = 0): A {
  const b = new (a.constructor as new (l: number) => A)(length);
  if (fill !== 0) b.fill(fill);
  b.set(a);
  return b;
}

function makeLayer(rows: number, n: number, pooled: boolean): Layer {
  return {
    values: new Float64Array(rows * n), weights: new Float64Array(rows), has: new Uint8Array(rows),
    covers: null, sources: [], pooled, asked: new Set(),
  };
}

function widenLayer(l: Layer, rows: number, n: number): void {
  l.values = wider(l.values, rows * n);
  l.weights = wider(l.weights, rows);
  l.has = wider(l.has, rows);
  if (l.covers) l.covers = wider(l.covers, rows * n);
}

/** Asks `row`'s sources in `l`: the weight first, and the value only where it weighs something. */
function ask(l: Layer, row: number, n: number): void {
  const src = l.sources[row];
  if (!src) return;
  if (src.weight) l.weights[row] = src.weight();
  if (src.value && share(l.weights[row]!) > 0) src.value(l.values, row * n);
}

/**
 * Row `row`'s holds in `layers`, without `skip`, as one distance from `committed` per axis. On
 * each axis the holds over it are alternatives: one weighs `w / max(1, total)`, and what their
 * weights leave short of 1 is the committed value's. An angle goes by way of the direction the
 * holds average to, so two holds turn the short way toward each other.
 */
function foldRow(
  layers: readonly Layer[], angle: Uint8Array, n: number, row: number,
  committed: ArrayLike<number>, at: number, skip: HoldLayer | null, delta: number[], total: number[],
): void {
  const base = row * n;
  const holds = (l: Layer, a: number): number =>
    (l === skip || !l.has[row] || (l.covers && !l.covers[base + a]) ? 0 : share(l.weights[row]!));
  for (let a = 0; a < n; a++) {
    const c = committed[at + a]!;
    let weight = 0;
    let sum = 0;
    let sin = 0;
    let cos = 0;
    for (let h = 0; h < layers.length; h++) {
      const l = layers[h]!;
      const w = holds(l, a);
      if (!(w > 0)) continue;
      const v = l.values[base + a]!;
      weight += w;
      if (!angle[a]) sum += w * (v - c);
      else {
        sin += w * Math.sin(v);
        cos += w * Math.cos(v);
      }
    }
    if (weight > 0 && angle[a]) {
      // Where the directions cancel out there is no way round between them: each from committed.
      const mean = Math.hypot(sin, cos) < 1e-9 ? null : Math.atan2(sin, cos);
      for (let h = 0; h < layers.length; h++) {
        const l = layers[h]!;
        const w = holds(l, a);
        if (!(w > 0)) continue;
        const v = l.values[base + a]!;
        sum += w * (mean === null ? wrapAngle(v - c) : wrapAngle(mean - c) + wrapAngle(v - mean));
      }
    }
    total[a] = weight;
    delta[a] = weight > 0 ? sum / Math.max(1, weight) : 0;
  }
}

/** `read` writes row `row`'s committed value into `out` from `at`. `angles` are the axes that
 *  are angles, where holds meet at the direction they average to. */
export function createHoldStore(
  axes: number, rows: number, read: (row: number, out: Float64Array, at: number) => void,
  angles?: readonly number[],
): HoldStore {
  const n = axes;
  const angle = new Uint8Array(n);
  for (const a of angles ?? []) angle[a] = 1;
  let cap = Math.max(rows, 1);
  const layers: Layer[] = [];
  let size = 0;
  const store = {
    delta: new Float64Array(cap * n),
    cover: new Float64Array(cap * n),
    at: new Float64Array(cap * n),
    count: new Int32Array(cap),
    held: new Int32Array(cap),
    /** Each row's place in `held`; -1 for one not held. */
    place: new Int32Array(cap).fill(-1),
    /** The frame each row was last folded on. */
    folded: new Int32Array(cap),
  };
  let pass = 0;

  const fold: HoldStore['fold'] = (row, committed, at, skip, delta, total) =>
    foldRow(layers, angle, n, row, committed, at, skip, delta, total);

  const scratchDelta = new Array<number>(n);
  const scratchTotal = new Array<number>(n);
  /** Folds `row` against its committed value now, into the store's own arrays. */
  const settle = (row: number): void => {
    const base = row * n;
    read(row, store.at, base);
    fold(row, store.at, base, null, scratchDelta, scratchTotal);
    for (let a = 0; a < n; a++) {
      store.delta[base + a] = scratchDelta[a]!;
      store.cover[base + a] = Math.min(scratchTotal[a]!, 1);
    }
  };
  const made = (pooled: boolean): Layer => {
    const l = makeLayer(cap, n, pooled);
    layers.push(l);
    return l;
  };

  return {
    axes: n,
    get delta() { return store.delta; },
    get cover() { return store.cover; },
    get at() { return store.at; },
    get count() { return store.count; },
    get held() { return store.held; },
    get size() { return size; },
    grow(want) {
      if (want <= cap) return;
      cap = Math.max(want, cap * 2);
      for (const k of ['delta', 'cover', 'at'] as const) store[k] = wider(store[k], cap * n);
      for (const k of ['count', 'held', 'folded'] as const) store[k] = wider(store[k], cap);
      store.place = wider(store.place, cap, -1);
      for (const l of layers) widenLayer(l, cap, n);
    },
    layer: () => made(false),
    free(row) {
      for (const l of layers) if (l.pooled && !l.has[row]) return l;
      return made(true);
    },
    join(layer, row, sources) {
      const l = layer as Layer;
      if (l.has[row]) throw new Error(`holds: row ${row} is held by this layer already`);
      l.has[row] = 1;
      if (sources) {
        l.sources[row] = sources;
        if (!sources.fixed) l.asked.add(row);
        if (sources.covers) (l.covers ??= new Uint8Array(cap * n).fill(1)).set(sources.covers, row * n);
      }
      if (store.count[row]++ > 0) return;
      store.place[row] = size;
      store.held[size++] = row;
    },
    part(layer, row) {
      const l = layer as Layer;
      if (!l.has[row]) return;
      l.has[row] = 0;
      l.sources[row] = undefined;
      l.asked.delete(row);
      l.covers?.fill(1, row * n, (row + 1) * n);
      if (--store.count[row]! > 0) return;
      const at = store.place[row]!;
      const last = store.held[--size]!;
      store.held[at] = last;
      store.place[last] = at;
      store.place[row] = -1;
      store.delta.fill(0, row * n, (row + 1) * n);
      store.cover.fill(0, row * n, (row + 1) * n);
    },
    drop(layer) {
      const i = layers.indexOf(layer as Layer);
      if (i >= 0) layers.splice(i, 1);
    },
    frame() {
      for (const l of layers) for (const row of l.asked) ask(l, row, n);
      // A row asked in two layers is folded once.
      pass += 1;
      for (const l of layers) {
        for (const row of l.asked) {
          if (store.folded[row] === pass) continue;
          store.folded[row] = pass;
          settle(row);
        }
      }
    },
    refold(row) {
      for (const l of layers) if (l.has[row]) ask(l, row, n);
      settle(row);
    },
    fold,
    valueOf: (layer, row) => Array.from(layer.values.subarray(row * n, (row + 1) * n)),
  };
}
