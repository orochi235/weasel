import { kit, mix, sum, vec, type Mix } from '@msb235/blits';

export type Out = { v: number[] };

/** One subject's value, kept current in place. Valid until the subject's last voice stops. */
export interface Reader {
  /** The array holding the subject's axes as the last `frame` read them, from `at` on. It is
   *  shared with other subjects and valid until the next `frame`. */
  readonly cols: Float64Array;
  /** Where the subject's axes start in `cols`. */
  readonly at: number;
}

/** One subject of a lane: what `pull` reads for it, summed over every voice reaching it. */
export interface Slot extends Reader {
  cols: Float64Array;
  at: number;
  key: unknown;
  lane: Lane;
  /** How many voices reach it. */
  refs: number;
  /** Its place in the lane's `keys`; -1 while no frame has read it. */
  index: number;
  /** What `cols` points at while `index` is -1. */
  held: Float64Array;
}

/** One mix per axis count, since a kit's channel width is fixed. */
export interface Lane {
  axes: number;
  mix: Mix<unknown, Out>;
  /** The subjects `pull` reads, by place. Joins wait in `pending` until the next `frame`. */
  keys: unknown[];
  /** Each place's slot, beside `keys`. */
  slots: Slot[];
  pending: Set<Slot>;
  dirty: boolean;
  /** Frames in a row it has had no subjects at; it retires at the second. */
  idle: number;
  cols: { v: Float64Array };
}

export interface Lanes {
  /** The slot for `key`, made if absent and showing `held` until a frame reads it. Counts one
   *  more voice reaching it. */
  join(axes: number, key: unknown, held: ArrayLike<number>): Slot;
  /** Counts one voice fewer reaching `slot`. At none it leaves its lane, and the mix forgets
   *  the subject. */
  leave(slot: Slot): void;
  /** Syncs every lane to `time` and reads its subjects. */
  frame(time: number): void;
  /** Says what a voice on `key` reads from outside has changed since the last `frame`. */
  touch(key: unknown): void;
  /** Reads each touched subject again where the clock stands, then hands it to `each`. */
  refresh(each: (slot: Slot) => void): void;
}

export function createLanes(): Lanes {
  const lanes = new Map<number, Lane>();
  const slots = new Map<unknown, Slot>();
  const touched = new Set<Slot>();
  let now = 0;

  const laneOf = (axes: number): Lane => {
    let l = lanes.get(axes);
    if (!l) {
      const m = mix<unknown, Out>(kit<Out>({ v: vec(axes, sum()) }));
      m.sync(now);
      l = { axes, mix: m, keys: [], slots: [], pending: new Set(), dirty: false, idle: 0, cols: { v: new Float64Array(0) } };
      lanes.set(axes, l);
    }
    return l;
  };

  const depart = (s: Slot): void => {
    const l = s.lane;
    l.dirty = true;
    if (s.index < 0) { l.pending.delete(s); return; }
    const lastKey = l.keys.pop()!;
    const moved = l.slots.pop()!;
    if (moved === s) return;
    const n = l.axes;
    const from = l.keys.length * n;
    l.cols.v.copyWithin(s.index * n, from, from + n);
    l.keys[s.index] = lastKey;
    l.slots[s.index] = moved;
    moved.index = s.index;
    moved.at = s.index * n;
  };

  const rebuild = (l: Lane): void => {
    const keys = l.keys.slice();
    for (const s of l.pending) {
      s.index = keys.length;
      s.at = s.index * l.axes;
      s.cols = l.cols.v;
      keys.push(s.key);
      l.slots.push(s);
    }
    l.pending.clear();
    l.keys = keys;
    if (l.cols.v.length !== keys.length * l.axes) {
      l.cols = { v: new Float64Array(keys.length * l.axes) };
      for (const s of l.slots) s.cols = l.cols.v;
    }
    l.dirty = false;
  };

  return {
    join(axes, key, held) {
      const had = slots.get(key);
      if (had) {
        if (had.lane.axes !== axes) {
          throw new Error(`codec: a subject on ${had.lane.axes} axes was given a voice on ${axes}`);
        }
        had.refs += 1;
        return had;
      }
      const lane = laneOf(axes);
      const own = Float64Array.from(held);
      const s: Slot = { key, lane, refs: 1, index: -1, held: own, cols: own, at: 0 };
      slots.set(key, s);
      lane.pending.add(s);
      lane.dirty = true;
      return s;
    },
    leave(s) {
      s.refs -= 1;
      if (s.refs > 0) return;
      s.lane.mix.drop(s.key);
      depart(s);
      slots.delete(s.key);
    },
    frame(time) {
      now = time;
      for (const l of lanes.values()) {
        if (l.dirty) rebuild(l);
        if (l.keys.length === 0 && ++l.idle >= 2) {
          lanes.delete(l.axes);
          continue;
        }
        l.mix.sync(time);
        if (l.keys.length === 0) continue;
        l.idle = 0;
        l.mix.pull(l.keys, l.cols);
      }
      touched.clear();
    },
    touch(key) {
      const s = slots.get(key);
      if (!s) return;
      s.lane.mix.touch(key);
      touched.add(s);
    },
    refresh(each) {
      for (const s of touched) {
        touched.delete(s);
        if (slots.get(s.key) !== s) continue;
        const out = s.lane.mix.probe(s.key, { v: new Array<number>(s.lane.axes).fill(0) });
        s.cols.set(out.v, s.at);
        each(s);
      }
    },
  };
}
