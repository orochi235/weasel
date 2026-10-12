import { axesOf } from './engine/axes';
import type { LaneColumns, Reader } from './engine/lanes';

/** How a target's value maps to the flat numbers an animation moves, and back. */
export interface TargetAxes<T> {
  count: number;
  to(value: T): number[];
  from(axes: ArrayLike<number>): T;
  /** Indexes of axes that are angles in radians. An animation starting from one takes the short
   *  way round to its destination. */
  angles?: readonly number[];
  /** Optional. `value` with `delta` added axis by axis: what `from` answers for `to(value)`
   *  plus `delta`, built with no array between. A read of a moving target goes through it. */
  add?(value: T, delta: ArrayLike<number>): T;
  /** Optional. Puts `value`'s axes into `out` from `at`: what `to` answers, with no array
   *  built. `readInto` goes through it. */
  write?(value: T, out: AxisBuffer, at: number): void;
}

/** Somewhere a target's axes are written as numbers. */
export type AxisBuffer = Float64Array | Float32Array | number[];

/** What {@link createTarget} takes. */
export interface TargetOptions<T> {
  /** The committed value: what shows when nothing is animating. */
  get(): T;
  /** Commits a value: an animation's destination as it starts, and where a canceled one stopped. */
  set(value: T): void;
  /** How `T` maps to numbers. Default: a number, an array of numbers, or a plain object whose
   *  fields are all numbers, read from `get()` when the target is made. */
  axes?: TargetAxes<T>;
  /** Called once a frame, after the frame's animations, with the value to show: on every frame
   *  the target is moving, as an animation starts on it or is redirected, and once more as it
   *  comes to rest. Omit for a target whose reader
   *  calls `read()` itself. */
  show?(value: T): void;
  /** Called once a frame, after every target that was shown that frame: for a table that
   *  publishes many targets at once. Targets passing the same function share one call. */
  publish?(): void;
}

/**
 * One value an animator can move. Pass it as `target` to `tween`, `spring`, `physics` or `decay`.
 *
 * An animation on a target commits its destination when it starts and contributes only what is
 * left to travel, so several on one target add: a second started mid-flight bends the motion
 * toward its own destination and neither cancels the other.
 */
export interface Target<T> {
  /** The value to show: the committed value plus what every running animation has left to travel. */
  read(): T;
  /**
   * As `read`, as numbers: writes the value's `axisCount` axes into `out` from `at` (default 0),
   * in the order the target's `axes.to` answers them. For a reader of many targets that wants
   * the numbers and no value built for each.
   */
  readInto(out: AxisBuffer, at?: number): void;
  /** How many axes `readInto` writes. */
  readonly axisCount: number;
  /** How its value maps to numbers. */
  readonly axes: TargetAxes<T>;
  /** The committed value: what shows once nothing is moving it. */
  committed(): T;
  /** Writes the committed value. Animations moving the target go on adding to the new one. */
  commit(value: T): void;
  /** Whether any animation is moving it. */
  readonly active: boolean;
  /**
   * Stops every animation moving it. Each commits where it was, so the value on screen stays,
   * unless `commit` is false: then the committed value is left as it stands and the target
   * shows it. Pass false after something else has written the committed value mid-flight.
   */
  stop(opts?: { commit?: boolean }): void;
}

/** The animator moving a target, as the target reaches it. */
export interface TargetOwner {
  /** Cancels every animation on `s`. */
  stop(s: TargetState): void;
  /** Reads `s`'s voices again now, where what they read from outside has changed. */
  reread(s: TargetState): void;
  /** The voices of `table`'s rows as the last frame read them; null where none is moving. */
  columns(table: RowTable): LaneColumns | null;
  /** Says `s.adjust` holds something, for the next frame's reading to clear. */
  adjusted(s: TargetState): void;
}

/** What an animator needs of a table of targets, to show its rows in one pass. */
export interface RowTable {
  /** Says row `index` shows something the pass over the table's columns will not give: an
   *  animation started, stopped, or was redirected since the last frame, or it has a hold. */
  mark(index: number): void;
  /** Called once a frame's voices are read: a mark that reading took in is dropped. */
  settle(): void;
  /** Fills every moving row's value on screen from `columns`. */
  fill(columns: LaneColumns | null): void;
}

/** An animation's share in moving a target's committed value, which its holds stand in front of. */
export interface Behind {
  /** What is left of the move its destination made in the committed value. */
  left(): readonly number[];
  /** The share of that still to show, per axis, once a hold released over it has committed what
   *  showed; null for all of it. */
  kept: number[] | null;
}

/** What an animator keeps on a target it is moving. */
export interface TargetState<T = unknown> {
  readonly get: () => T;
  readonly set: (value: T) => void;
  readonly show: ((value: T) => void) | undefined;
  readonly publish: (() => void) | undefined;
  readonly axes: TargetAxes<T>;
  /** Writes the committed value's axes into `out` from `at` with no value built, for a target
   *  that keeps them as numbers already; null where `get` and `axes` are the way. */
  write: ((out: AxisBuffer, at: number) => void) | null;
  /** The animator moving it, by its own token; null while none is. */
  owner: TargetOwner | null;
  /** True while its animations are being stopped without committing where they were. */
  discard: boolean;
  /** The committed value's axes as its holds last read them; null while it has none. A hold
   *  answers how far its value is from the committed one, so it is stale once that moves. */
  heldAt: number[] | null;
  /** How many holds stand in for its committed value. */
  held: number;
  /** The share of each axis those holds cover, 0 to 1, as they last read; null beside `heldAt`. */
  cover: number[] | null;
  /** The animations with a destination on it. A destination moves the committed value at once
   *  and the animation shows what is left of that move, so a hold covers it as it covers the
   *  committed value. */
  behind: Set<Behind>;
  /** Whether any of `behind` has a `kept`. */
  dimmed: boolean;
  /** What animations stopped under those holds were showing on top of them: how far a coast
   *  had gone, or what was left of a `from` away from the committed value. It waits here, on
   *  screen, until the holds go or an animation with a destination takes it up. */
  beside: number[] | null;
  /** Its place in a table of targets, for a row of one. */
  row: { readonly table: RowTable; readonly index: number } | null;
  /** How many animations are moving it. */
  live: number;
  /** The sum of their offsets as the last frame read it. */
  slot: Reader | null;
  /** What that sum has changed by since: animations started, stopped or redirected. */
  adjust: number[];
  /** Whether its owner has been told `adjust` holds something. */
  stale: boolean;
}

const states = new WeakMap<object, TargetState>();

/** Where a read gathers what a target's animations add, on the way to `axes.add`. */
let scratch = new Float64Array(16);

/** What `s`'s holds, and holds released over it, hide of its animations; null where none. */
function hidden<T>(s: TargetState<T>): number[] | null {
  const { cover } = s;
  if (s.behind.size === 0 || (!cover && !s.dimmed)) return null;
  const out = new Array<number>(s.axes.count).fill(0);
  for (const b of s.behind) {
    const left = b.left();
    for (let i = 0; i < out.length; i++) {
      const shows = (cover ? 1 - cover[i]! : 1) * (b.kept ? b.kept[i]! : 1);
      out[i] = out[i]! + left[i]! * (1 - shows);
    }
  }
  return out;
}

/** Puts `s`'s committed value's axes into `out` from `at`. */
export function committedInto<T>(s: TargetState<T>, out: AxisBuffer, at: number): void {
  if (s.write) s.write(out, at);
  else if (s.axes.write) s.axes.write(s.get(), out, at);
  else {
    const a = s.axes.to(s.get());
    for (let i = 0; i < a.length; i++) out[at + i] = a[i]!;
  }
}

/** `committed`'s axes, with `s`'s holds read again where it has moved under them. */
function heldAxes<T>(s: TargetState<T>, committed: T): number[] {
  const a = s.axes.to(committed);
  if (s.heldAt && a.some((x, i) => x !== s.heldAt![i])) s.owner?.reread(s as unknown as TargetState);
  return a;
}

// Each read below keeps a loop of its own over one kind of array: one loop shared between a
// plain array and a typed one measured slower than building the array it was there to save.

/** The value `s` shows now. */
export function readTarget<T>(s: TargetState<T>): T {
  const committed = s.get();
  if (s.live === 0) return committed;
  const { axes, slot, beside, adjust } = s;
  // A hold answers how far it is from the committed value, which takes that value's axes to check.
  if (!axes.add || s.heldAt || s.dimmed) {
    const a = heldAxes(s, committed);
    const hid = hidden(s);
    for (let i = 0; i < a.length; i++) {
      a[i] = a[i]! + (slot ? slot.cols[slot.at + i]! : 0) + adjust[i]! + (beside ? beside[i]! : 0)
        - (hid ? hid[i]! : 0);
    }
    return axes.from(a);
  }
  const n = axes.count;
  if (scratch.length < n) scratch = new Float64Array(n);
  const d = scratch;
  for (let i = 0; i < n; i++) {
    d[i] = (slot ? slot.cols[slot.at + i]! : 0) + adjust[i]! + (beside ? beside[i]! : 0);
  }
  return axes.add(committed, d);
}

/** The value `s` shows now, as its axes, in `out` from `at`. */
export function readTargetInto<T>(s: TargetState<T>, out: AxisBuffer, at: number): void {
  const committed = s.get();
  const { axes, slot, beside, adjust } = s;
  const moving = s.live > 0;
  if (axes.write && !(moving && s.heldAt)) axes.write(committed, out, at);
  else {
    const a = moving ? heldAxes(s, committed) : axes.to(committed);
    for (let i = 0; i < a.length; i++) out[at + i] = a[i]!;
  }
  if (!moving) return;
  const hid = hidden(s);
  for (let i = 0; i < axes.count; i++) {
    out[at + i] = out[at + i]! + (slot ? slot.cols[slot.at + i]! : 0) + adjust[i]! + (beside ? beside[i]! : 0)
      - (hid ? hid[i]! : 0);
  }
}

/** The state behind a target `createTarget` made. */
export function stateOf<T>(target: Target<T>): TargetState<T> {
  const s = states.get(target);
  if (!s) throw new Error('animator: `target` was not made by createTarget');
  return s as unknown as TargetState<T>;
}

/** Make a {@link Target} over a value the caller owns. */
export function createTarget<T>(opts: TargetOptions<T>): Target<T> {
  const axes = opts.axes ?? (axesOf(opts.get()) as TargetAxes<T> | null);
  if (!axes) {
    throw new Error('createTarget: `axes` is required for a value that is not a number, an array of numbers, or an object of numeric fields');
  }
  const s: TargetState<T> = {
    get: opts.get,
    set: opts.set,
    show: opts.show,
    publish: opts.publish,
    axes,
    write: null,
    owner: null,
    discard: false,
    heldAt: null,
    held: 0,
    cover: null,
    behind: new Set(),
    dimmed: false,
    beside: null,
    row: null,
    live: 0,
    slot: null,
    adjust: new Array<number>(axes.count).fill(0),
    stale: false,
  };
  const target: Target<T> = {
    read: () => readTarget(s),
    readInto: (out, at = 0) => readTargetInto(s, out, at),
    axisCount: axes.count,
    axes,
    committed: opts.get,
    commit: opts.set,
    get active() { return s.live > 0; },
    stop(o) {
      const owner = s.owner;
      if (!owner) return;
      s.discard = o?.commit === false;
      try { owner.stop(s as unknown as TargetState); } finally { s.discard = false; }
    },
  };
  states.set(target, s as unknown as TargetState);
  return target;
}
