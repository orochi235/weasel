import { axesOf } from './engine/axes';
import type { Reader } from './engine/lanes';

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
}

/** What an animator keeps on a target it is moving. */
export interface TargetState<T = unknown> {
  readonly get: () => T;
  readonly set: (value: T) => void;
  readonly show: ((value: T) => void) | undefined;
  readonly publish: (() => void) | undefined;
  readonly axes: TargetAxes<T>;
  /** The animator moving it, by its own token; null while none is. */
  owner: TargetOwner | null;
  /** True while its animations are being stopped without committing where they were. */
  discard: boolean;
  /** The committed value's axes as its holds last read them; null while it has none. A hold
   *  answers how far its value is from the committed one, so it is stale once that moves. */
  heldAt: number[] | null;
  /** How many holds stand in for its committed value. */
  held: number;
  /** What animations canceled under those holds had left to travel. A hold stands in front of
   *  the committed value, so it waits here, on screen, until the holds go or an animation with
   *  a destination takes it up. */
  beside: number[] | null;
  /** How many animations are moving it. */
  live: number;
  /** The sum of their offsets as the last frame read it. */
  slot: Reader | null;
  /** What that sum has changed by since: animations started, stopped or redirected. */
  adjust: number[];
}

const states = new WeakMap<object, TargetState>();

/** Where a read gathers what a target's animations add, on the way to `axes.add`. */
let scratch = new Float64Array(16);

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
  if (!axes.add || s.heldAt) {
    const a = heldAxes(s, committed);
    for (let i = 0; i < a.length; i++) {
      a[i] = a[i]! + (slot ? slot.cols[slot.at + i]! : 0) + adjust[i]! + (beside ? beside[i]! : 0);
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
  for (let i = 0; i < axes.count; i++) {
    out[at + i] = out[at + i]! + (slot ? slot.cols[slot.at + i]! : 0) + adjust[i]! + (beside ? beside[i]! : 0);
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
    owner: null,
    discard: false,
    heldAt: null,
    held: 0,
    beside: null,
    live: 0,
    slot: null,
    adjust: new Array<number>(axes.count).fill(0),
  };
  const target: Target<T> = {
    read: () => readTarget(s),
    readInto: (out, at = 0) => readTargetInto(s, out, at),
    axisCount: axes.count,
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
