import type { ActiveAnimation } from './context';
import { createSchedule, type Schedule } from './schedule';

/** The animations on the table, and the ways a frame and the API find them. */
export interface Roster {
  readonly animations: Map<number, ActiveAnimation>;
  readonly schedule: Schedule;
  /** Puts `a` on the table, in place of one still there under its id: a revived timeline
   *  registers again under the id it holds. */
  add(a: ActiveAnimation): void;
  /** Takes `a` off the table, with no report. */
  remove(a: ActiveAnimation): void;
  clear(): void;
}

/** `elapsed` answers the animator's clock, as {@link createSchedule} takes it. */
export function createRoster(elapsed: () => number): Roster {
  const animations = new Map<number, ActiveAnimation>();
  const schedule = createSchedule(elapsed);
  const remove = (a: ActiveAnimation): void => {
    animations.delete(a.id);
    schedule.remove(a);
  };
  return {
    animations,
    schedule,
    add(a) {
      const had = animations.get(a.id);
      if (had) remove(had);
      animations.set(a.id, a);
      schedule.add(a);
    },
    remove,
    clear() {
      animations.clear();
      schedule.clear();
    },
  };
}
