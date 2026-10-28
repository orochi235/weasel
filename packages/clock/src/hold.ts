import { passesOf } from './place';
import type { Clock, ClockHandle, ClockPosition } from './types';

/** The time a clock standing `elapsed` into a run of `loop` passes shows
 *  within its pass: a time on a pass boundary past the start shows as the end
 *  of the pass before, and one past the run's end runs on in its last pass. */
export function shownInPass(
  origin: number,
  elapsed: number,
  duration: number,
  loop: boolean | number = true,
): number {
  if (!Number.isFinite(duration)) return origin + elapsed;
  const last = (passesOf(loop) - 1) * duration;
  if (elapsed > last + duration) return origin + elapsed - last;
  const into = elapsed % duration;
  return origin + (into === 0 && elapsed > 0 ? duration : into);
}

/** A clock held at a time its span may not reach yet. */
export interface PlayheadHold {
  /** The held time while the clock stands elsewhere (clamped), else null. */
  pending(): number | null;
  /** Stop holding. Idempotent. */
  release(): void;
}

/**
 * Pauses `handle`'s clock at `shown`, a time shown within a pass (`null`: the
 * span's start), placed in the first pass, and keeps seeking there as `declare`
 * or a `duration` write moves the span. A time past the pass's end waits at it.
 * Any other change (a rate, a seek of someone else's) releases the hold. A
 * clock that is not seekable is never held.
 */
export function holdAt(handle: ClockHandle, shown: number | null): PlayheadHold {
  return holdWhere(
    handle,
    (clock) => {
      const within = Math.min(shown === null ? 0 : shown - clock.origin, clock.duration);
      return [within, within > 0 && within === clock.duration ? 'end' : 'start'];
    },
    (clock) => (shown === null || clock.origin + clock.elapsed === shown ? null : shown),
  );
}

/** A recorded position `holdElapsed` holds at. */
export type HeldPosition = Pick<ClockPosition, 'elapsed' | 'passEnd' | 'duration' | 'origin'>;

/**
 * As {@link holdAt}, but at a recorded position across the whole run, so a
 * clock of several passes comes back in the pass it stood in. A position
 * recorded under another `duration` or `origin` keeps its pass and the time it
 * showed within it. `pending` reports the held `elapsed`.
 */
export function holdElapsed(handle: ClockHandle, at: HeldPosition): PlayheadHold {
  return holdWhere(
    handle,
    (clock) => elapsedOn(clock, at),
    (clock) => (clock.elapsed === elapsedOn(clock, at)[0] ? null : at.elapsed),
  );
}

/** Where `at` stands on `clock`'s span: the same pass, and the same time shown in it. */
function elapsedOn(clock: Clock, at: HeldPosition): [elapsed: number, line: Line] {
  const line: Line = at.passEnd ? 'end' : 'start';
  const from = at.duration ?? clock.duration;
  const origin = at.origin ?? clock.origin;
  if (from === clock.duration && origin === clock.origin) return [at.elapsed, line];
  if (!Number.isFinite(from) || !Number.isFinite(clock.duration))
    return [at.elapsed + origin - clock.origin, line];
  let pass = Math.floor(at.elapsed / from);
  let into = at.elapsed - pass * from;
  if (at.passEnd && into === 0 && pass > 0) {
    pass -= 1;
    into = from;
  }
  const within = Math.min(Math.max(0, origin + into - clock.origin), clock.duration);
  const end = within > 0 && within === clock.duration;
  return [pass * clock.duration + within, end ? 'end' : 'start'];
}

type Line = 'start' | 'end';

function holdWhere(
  handle: ClockHandle,
  where: (clock: Clock) => [elapsed: number, line: Line],
  wanted: (clock: Clock) => number | null,
): PlayheadHold {
  const { clock } = handle;
  let released = false;
  let busy = false;
  let unsub: (() => void) | null = null;
  let duration = clock.duration;
  let origin = clock.origin;
  let loop = clock.loop;
  let set = clock.elapsed;

  const release = (): void => {
    released = true;
    unsub?.();
    unsub = null;
  };

  const place = (): void => {
    busy = true;
    try {
      clock.seek(...where(clock));
    } finally {
      busy = false;
    }
    duration = clock.duration;
    origin = clock.origin;
    loop = clock.loop;
    set = clock.elapsed;
  };

  if (!clock.seekable) {
    released = true;
  } else {
    clock.rate = 0;
    place();
    unsub = clock.subscribe(() => {
      if (busy || released) return;
      if (clock.rate !== 0) release();
      else if (clock.duration !== duration || clock.origin !== origin || clock.loop !== loop) place();
      else if (clock.elapsed !== set) release();
    });
  }

  return {
    pending: () => (released ? null : wanted(clock)),
    release,
  };
}
