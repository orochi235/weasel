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
}

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
  /** How many animations are moving it. */
  live: number;
  /** The sum of their offsets as the last frame read it. */
  slot: Reader | null;
  /** What that sum has changed by since: animations started, stopped or redirected. */
  adjust: number[];
}

const states = new WeakMap<object, TargetState>();

/** The value `s` shows now. */
export function readTarget<T>(s: TargetState<T>): T {
  const committed = s.get();
  if (s.live === 0) return committed;
  const a = s.axes.to(committed);
  if (s.heldAt && a.some((x, i) => x !== s.heldAt![i])) s.owner?.reread(s as unknown as TargetState);
  const slot = s.slot;
  for (let i = 0; i < a.length; i++) a[i] = a[i]! + (slot ? slot.cols[slot.at + i]! : 0) + s.adjust[i]!;
  return s.axes.from(a);
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
    live: 0,
    slot: null,
    adjust: new Array<number>(axes.count).fill(0),
  };
  const target: Target<T> = {
    read: () => readTarget(s),
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
