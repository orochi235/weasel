import { kit, mix, sum, vec, type Mix } from '@msb235/blits';

export type Out = { v: number[] };

/** One subject's value, kept current in place. Valid until the subject's last voice stops. */
export interface Reader {
  /** The array holding the subject's axes as the last `frame` read them, from `at` on. It is
   *  shared with other subjects and valid until the next `frame`. */
  readonly cols: Float64Array;
  /** Where the subject's axes start in `cols`. */
  readonly at: number;
  /** How many voices reach it: 0 once the last has left, and it reads what it showed then. */
  readonly refs: number;
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
  /** A number its owner gave it, kept beside it in the lane's `tags`; -1 where it gave none. */
  tag: number;
}

/** Where a subject's voices run, for one kept apart from the rest with as many axes. */
export interface LanePlace {
  /** Subjects naming one group share a lane no other subject is in. */
  group: object;
  /** Kept in the lane's `tags` at the subject's place. */
  tag: number;
}

/** A group's lane as the last frame read it: `count` subjects, subject `j`'s axes in `cols`
 *  from `j * axes` and its tag at `tags[j]`. Valid until a subject joins or leaves. */
export interface LaneColumns {
  cols: Float64Array;
  tags: Int32Array;
  count: number;
}

/** One mix per axis count, since a kit's channel width is fixed, and one more per group. */
export interface Lane {
  /** What the lane is kept under: its group, or its axis count. */
  key: unknown;
  axes: number;
  mix: Mix<unknown, Out>;
  /** The subjects `pull` reads, by place. Joins wait in `pending` until the next `frame`. */
  keys: unknown[];
  /** Each place's slot, beside `keys`. */
  slots: Slot[];
  /** Each place's tag, beside `keys`. */
  tags: Int32Array;
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
  /** The lane of `group` as the last frame read it; null where it has none. */
  columns(group: object): LaneColumns | null;
  /** Counts one voice fewer reaching `slot`. At none it leaves its lane, and the mix forgets
   *  the subject. */
  leave(slot: Slot): void;
  /** Syncs every lane to `time` and reads its subjects. */
  frame(time: number): void;
}

/** Takes `s` out of its lane's places, moving the last one into the gap. */
function depart(s: Slot): void {
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
  l.tags[s.index] = moved.tag;
  moved.index = s.index;
  moved.at = s.index * n;
}

/** Gives the lane's waiting subjects their places. */
function rebuild(l: Lane): void {
  const keys = l.keys.slice();
  const had = keys.length;
  for (const s of l.pending) {
    s.index = keys.length;
    s.at = s.index * l.axes;
    s.cols = l.cols.v;
    keys.push(s.key);
    l.slots.push(s);
  }
  l.pending.clear();
  l.keys = keys;
  if (l.tags.length < keys.length) {
    const tags = new Int32Array(Math.max(keys.length, l.tags.length * 2));
    tags.set(l.tags);
    l.tags = tags;
  }
  for (let i = had; i < keys.length; i++) l.tags[i] = l.slots[i]!.tag;
  if (l.cols.v.length !== keys.length * l.axes) {
    l.cols = { v: new Float64Array(keys.length * l.axes) };
    for (const s of l.slots) s.cols = l.cols.v;
  }
  l.dirty = false;
}

/** `placeOf` answers the lane a subject is kept in, for one kept apart from the rest. */
export function createLanes(placeOf?: (key: object) => LanePlace | undefined): Lanes {
  const lanes = new Map<unknown, Lane>();
  const slots = new Map<unknown, Slot>();
  let now = 0;

  const laneOf = (axes: number, group: object | undefined): Lane => {
    const key = group ?? axes;
    let l = lanes.get(key);
    if (!l) {
      const m = mix<unknown, Out>(kit<Out>({ v: vec(axes, sum()) }));
      m.sync(now);
      l = {
        key, axes, mix: m, keys: [], slots: [], tags: new Int32Array(0), pending: new Set(),
        dirty: false, idle: 0, cols: { v: new Float64Array(0) },
      };
      lanes.set(key, l);
    }
    return l;
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
      const place = typeof key === 'object' && key !== null ? placeOf?.(key) : undefined;
      const lane = laneOf(axes, place?.group);
      if (lane.axes !== axes) throw new Error(`codec: a group on ${lane.axes} axes was given a subject on ${axes}`);
      const own = Float64Array.from(held);
      const s: Slot = { key, lane, refs: 1, index: -1, held: own, cols: own, at: 0, tag: place?.tag ?? -1 };
      slots.set(key, s);
      lane.pending.add(s);
      lane.dirty = true;
      return s;
    },
    leave(s) {
      s.refs -= 1;
      if (s.refs > 0) return;
      // Read once more by whoever held it, for what it showed as its last voice left.
      const n = s.lane.axes;
      s.held.set(s.cols.subarray(s.at, s.at + n));
      s.lane.mix.drop(s.key);
      depart(s);
      s.cols = s.held;
      s.at = 0;
      slots.delete(s.key);
    },
    frame(time) {
      now = time;
      for (const l of lanes.values()) {
        if (l.dirty) rebuild(l);
        if (l.keys.length === 0 && ++l.idle >= 2) {
          lanes.delete(l.key);
          continue;
        }
        l.mix.sync(time);
        if (l.keys.length === 0) continue;
        l.idle = 0;
        l.mix.pull(l.keys, l.cols);
      }
    },
    columns(group) {
      const l = lanes.get(group);
      return l ? { cols: l.cols.v, tags: l.tags, count: l.keys.length } : null;
    },
  };
}
