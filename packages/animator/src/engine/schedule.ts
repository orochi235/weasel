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
  /** The animations to tick this frame, in the order they registered: those ticked every
   *  frame, and those whose clock has just reached their `due`. */
  ticks(): ActiveAnimation[];
  /** Whether any animation changes from one frame to the next. */
  readonly awake: boolean;
  /** How many animations no frame ticks until they are due. */
  readonly waiting: number;
  clear(): void;
}

/** `elapsed` answers the animator's clock: its time scale and pauses are already in it. */
export function createSchedule(elapsed: () => number): Schedule {
  /** Ticked every frame, in the order they joined. */
  const every = new Set<ActiveAnimation>();
  /** Waiting for the animator's clock to reach the time their own reaches `due`. */
  const wakes = createWakes<ActiveAnimation>();
  let seq = 0;
  let awake = 0;
  /** With a `due` and not yet woken, whether or not a rate above 0 has it in `wakes`. */
  let waiting = 0;

  const rateOf = (a: ActiveAnimation): number => (a.paused ? 0 : a.timeScale);
  const clockOf = (a: ActiveAnimation): number => a.base + (elapsed() - a.anchor) * rateOf(a);

  const wait = (a: ActiveAnimation): void => {
    const rate = rateOf(a);
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
      a.base = clockOf(a);
      a.anchor = elapsed();
      a.paused = paused;
      a.timeScale = timeScale;
      if (!every.has(a)) wait(a);
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
