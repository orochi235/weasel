import { passesOf, placeOf } from './place';
import type { Clock, ClockHandle, ClockPosition } from './types';

/** The time `clock` shows within its pass: its origin plus how far it stands into
 *  the pass it reads as, so a time on a pass boundary shows as the end of the pass
 *  before only when the clock stands at that end, as its `phase` says. */
export function shownInPass(clock: Pick<Clock, 'origin' | 'elapsed' | 'duration' | 'pass'>): number {
  if (!Number.isFinite(clock.duration)) return clock.origin + clock.elapsed;
  return clock.origin + clock.elapsed - clock.pass * clock.duration;
}

/** A clock held at a time its span may not reach yet. */
export interface PlayheadHold {
  /** The time the hold waits for while the clock stands elsewhere, else null:
   *  `holdAt`'s shown time as asked, unclamped, and `holdPosition`'s elapsed on
   *  the clock's current span. */
  pending(): number | null;
  /** Stop holding. Idempotent. */
  release(): void;
}

/**
 * Pauses `handle`'s clock at `shown`, a time shown within a pass (`null`: the
 * span's start), placed in the first pass, and keeps seeking there as `declare`
 * or a `duration` write moves the span. A time past the pass's end waits at it.
 * Any other change (a rate, a ramp, a seek of someone else's) releases the hold. A
 * clock that is not seekable is never held.
 */
export function holdAt(handle: ClockHandle, shown: number | null): PlayheadHold {
  return holdWhere(
    handle,
    (clock) => {
      const within = Math.min(shown === null ? 0 : shown - clock.origin, clock.duration);
      return [within, within > 0 && within === clock.duration ? 'end' : 'start'];
    },
    // Against the elapsed it seeks, not `origin + elapsed`, which can round an ulp off `shown`.
    (clock) => (shown === null || clock.elapsed === shown - clock.origin ? null : shown),
  );
}

/** A recorded position `holdPosition` holds at. */
export type HeldPosition = Pick<ClockPosition, 'elapsed' | 'passEnd' | 'duration' | 'origin'>;

/**
 * As {@link holdAt}, but at a recorded position across the whole run, so a
 * clock of several passes comes back in the pass it stood in. A position
 * recorded under another `duration` or `origin` keeps its pass and the time it
 * showed within it. `pending` reports the `elapsed` it holds for, on the
 * clock's current span, unclamped: a time past its pass's end waits there, as
 * {@link holdAt}'s does.
 */
export function holdPosition(handle: ClockHandle, at: HeldPosition): PlayheadHold {
  return holdWhere(
    handle,
    (clock) => {
      const [elapsed, line] = elapsedOn(clock, at);
      return [elapsed, line];
    },
    (clock) => {
      const [target, , wanted] = elapsedOn(clock, at);
      return clock.elapsed === target && target === wanted ? null : wanted;
    },
  );
}

/** Where `at` stands on `clock`'s span: the same pass, and the same time shown in it, clamped to the pass; and
 *  where it would stand unclamped, which a pass too short or starting too late does not reach yet. */
function elapsedOn(clock: Clock, at: HeldPosition): [elapsed: number, line: Line, wanted: number] {
  const line: Line = at.passEnd ? 'end' : 'start';
  const from = at.duration ?? clock.duration;
  const origin = at.origin ?? clock.origin;
  if (from === clock.duration && origin === clock.origin) return [at.elapsed, line, at.elapsed];
  if (!Number.isFinite(from) || !Number.isFinite(clock.duration)) {
    const elapsed = at.elapsed + origin - clock.origin;
    return [elapsed, line, elapsed];
  }
  const passes = passesOf(clock.loop);
  // A position at the end of the clock's run is that run ended, the end of its last pass as `placeOf` reads it, not
  // the start of a pass past it; one beyond came from a run of more passes, and keeps its pass.
  const ended = at.elapsed === from * passes;
  // Split as the clock splits its own elapsed, so a quotient that rounds up a pass does not land a pass off.
  let pass = ended ? Math.ceil(passes) - 1 : placeOf(at.elapsed, from, Number.POSITIVE_INFINITY, false).pass;
  let into = at.elapsed - pass * from;
  if (!ended && at.passEnd && into === 0 && pass > 0) {
    pass -= 1;
    into = from;
  }
  const shown = origin + into - clock.origin;
  const within = Math.min(Math.max(0, shown), clock.duration);
  const end = within > 0 && within === clock.duration;
  const elapsed = pass * clock.duration + within;
  return [elapsed, end ? 'end' : 'start', within === shown ? elapsed : pass * clock.duration + shown];
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
      if (clock.rate !== 0 || clock.ramping) release();
      else if (clock.duration !== duration || clock.origin !== origin || clock.loop !== loop) place();
      else if (clock.elapsed !== set) release();
    });
  }

  return {
    pending: () => (released ? null : wanted(clock)),
    release,
  };
}
