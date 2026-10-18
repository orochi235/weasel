import type { TargetState } from '../target';
import type { ActiveAnimation } from './context';
import { createSchedule, type Schedule } from './schedule';

/** The animations on the table, and the ways a frame and the API find them. */
export interface Roster {
  readonly animations: Map<number, ActiveAnimation>;
  readonly schedule: Schedule;
  /** The animations holding `key`, in the order they registered. */
  under(key: string): Iterable<ActiveAnimation>;
  /** The animations moving `target`, in the order they registered. */
  on(target: TargetState): Iterable<ActiveAnimation>;
  /** Puts `a` on the table, in place of one still there under its id: a revived timeline
   *  registers again under the id it holds. */
  add(a: ActiveAnimation): void;
  /** Takes `a` off the table, with no report. */
  remove(a: ActiveAnimation): void;
  clear(): void;
}

const NONE: Iterable<ActiveAnimation> = [];

/** Files `a` under `key` in `index`, or takes it out. */
function file<K>(index: Map<K, Set<ActiveAnimation>>, key: K, a: ActiveAnimation, on: boolean): void {
  let set = index.get(key);
  if (on) {
    if (!set) index.set(key, set = new Set());
    set.add(a);
  } else if (set?.delete(a) && set.size === 0) index.delete(key);
}

/** `elapsed` and `direction` answer the animator's clock, as {@link createSchedule} takes them. */
export function createRoster(elapsed: () => number, direction?: () => number): Roster {
  const animations = new Map<number, ActiveAnimation>();
  const schedule = createSchedule(elapsed, direction);
  // A start interrupts its key and a stop empties its target, and a search of the table for
  // either costs more the more is running.
  const byKey = new Map<string, Set<ActiveAnimation>>();
  const byTarget = new Map<TargetState, Set<ActiveAnimation>>();
  const index = (a: ActiveAnimation, on: boolean): void => {
    if (a.cancelKey != null) file(byKey, a.cancelKey, a, on);
    if (a.target) file(byTarget, a.target, a, on);
  };
  const remove = (a: ActiveAnimation): void => {
    animations.delete(a.id);
    schedule.remove(a);
    index(a, false);
  };
  return {
    animations,
    schedule,
    under: (key) => byKey.get(key) ?? NONE,
    on: (target) => byTarget.get(target) ?? NONE,
    add(a) {
      const had = animations.get(a.id);
      if (had) remove(had);
      animations.set(a.id, a);
      schedule.add(a);
      index(a, true);
    },
    remove,
    clear() {
      animations.clear();
      schedule.clear();
      byKey.clear();
      byTarget.clear();
    },
  };
}
