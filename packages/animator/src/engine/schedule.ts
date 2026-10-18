import type { ActiveAnimation } from './context';
import { createWakes } from './wakes';

/** Which animations a frame ticks, and each one's own clock. */
export interface Schedule {
  /** `a`'s own clock now, in virtual ms. */
  clockOf(a: ActiveAnimation): number;
  /** Takes `a` on, its clock at 0. */
  add(a: ActiveAnimation): void;
  remove(a: ActiveAnimation): void;
  /** Sets `a`'s pause and time scale, leaving its clock where it stands. */
  pace(a: ActiveAnimation, paused: boolean, timeScale: number): void;
  /** `a`'s rate now: its own time scale, 0 while paused, and below 0 while it plays backward. */
  rateOf(a: ActiveAnimation): number;
  /** Runs `flip`, which turns the direction the animations play in, leaving every one of `all`
   *  with its clock where it stands. */
  turn(all: Iterable<ActiveAnimation>, flip: () => void): void;
  /** Leaves `a` unticked until its clock has run `ms` more, whether it was waiting already or
   *  ticked every frame. Nothing for an `a` that has left. */
  defer(a: ActiveAnimation | undefined, ms: number): void;
  /** The animations to tick this frame, in the order they registered: those ticked every
   *  frame, and those whose clock has just reached their `due`. */
  ticks(): ActiveAnimation[];
  /** Whether any animation changes from one frame to the next. */
  readonly awake: boolean;
  /** How many animations no frame ticks until they are due. */
  readonly waiting: number;
  clear(): void;
}

/** `elapsed` answers the animator's clock, which only goes forward: its time scale and pauses
 *  are already in it. `direction` is -1 while the animator plays backward. */
export function createSchedule(elapsed: () => number, direction: () => number = () => 1): Schedule {
  /** Ticked every frame, in the order they joined. */
  const every = new Set<ActiveAnimation>();
  /** Waiting for the animator's clock to reach the time their own reaches `due`. */
  const wakes = createWakes<ActiveAnimation>();
  let seq = 0;
  let awake = 0;
  /** With a `due` and not yet woken, whether or not a rate above 0 has it in `wakes`. */
  let waiting = 0;

  const rateOf = (a: ActiveAnimation): number => (a.paused ? 0 : a.timeScale * direction());
  const clockOf = (a: ActiveAnimation): number => a.base + (elapsed() - a.anchor) * rateOf(a);
  const rebase = (a: ActiveAnimation): void => {
    a.base = clockOf(a);
    a.anchor = elapsed();
  };

  /** Has `a` wait for its `due`. One playing backward is ticked every frame instead: it ends
   *  where its clock gets back to 0, which no `due` ahead of it marks. */
  const wait = (a: ActiveAnimation): void => {
    const rate = rateOf(a);
    if (rate < 0 && a.due! < Infinity) {
      if (every.has(a)) return;
      wakes.remove(a);
      waiting -= 1;
      every.add(a);
      a.rewinding = true;
      return;
    }
    if (a.rewinding) {
      a.rewinding = false;
      every.delete(a);
      waiting += 1;
    }
    if (rate > 0 && a.due! < Infinity) wakes.set(a, a.anchor + (a.due! - a.base) / rate);
    else wakes.remove(a);
  };

  return {
    clockOf,
    add(a) {
      a.base = 0;
      a.anchor = elapsed();
      a.seq = seq++;
      a.heapAt = -1;
      a.wakeAt = Infinity;
      a.rewinding = false;
      if (!a.idle) awake += 1;
      if (a.due === undefined) {
        every.add(a);
        return;
      }
      waiting += 1;
      wait(a);
    },
    remove(a) {
      if (!a.idle) awake -= 1;
      if (every.delete(a)) return;
      waiting -= 1;
      wakes.remove(a);
    },
    pace(a, paused, timeScale) {
      rebase(a);
      a.paused = paused;
      a.timeScale = timeScale;
      if (!every.has(a) || a.rewinding) wait(a);
    },
    rateOf,
    turn(all, flip) {
      const each = [...all];
      for (const a of each) rebase(a);
      flip();
      for (const a of each) if (!every.has(a) || a.rewinding) wait(a);
    },
    defer(a, ms) {
      if (!a) return;
      a.due = clockOf(a) + ms;
      if (every.delete(a)) waiting += 1;
      a.rewinding = false;
      wait(a);
    },
    ticks() {
      const steady = [...every];
      const woke = wakes.due(elapsed());
      if (woke.length === 0) return steady;
      waiting -= woke.length;
      const out: ActiveAnimation[] = [];
      let i = 0;
      for (const a of woke) {
        // Rounding may leave its clock a hair short of the time it was woken for.
        a.base = Math.max(clockOf(a), a.due!);
        a.anchor = elapsed();
        every.add(a);
        while (i < steady.length && steady[i]!.seq < a.seq) out.push(steady[i++]!);
        out.push(a);
      }
      while (i < steady.length) out.push(steady[i++]!);
      return out;
    },
    get awake() { return awake > 0; },
    get waiting() { return waiting; },
    clear() {
      every.clear();
      wakes.clear();
      awake = 0;
      waiting = 0;
    },
  };
}
