import type { ClockHandle } from './types';

/** A clock held at a time its span may not reach yet. */
export interface PlayheadHold {
  /** The held time while the clock stands elsewhere (clamped), else null. */
  pending(): number | null;
  /** Stop holding. Idempotent. */
  release(): void;
}

/**
 * Pauses `handle`'s clock at the shown time `shown` (`null`: the span's start)
 * and keeps seeking there as `declare` or a `duration` write moves the span.
 * Any other change (a rate, a seek of someone else's) releases the hold. A
 * clock that is not seekable is never held.
 */
export function holdAt(handle: ClockHandle, shown: number | null): PlayheadHold {
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
      const within = shown === null ? 0 : shown - clock.origin;
      const { duration } = clock;
      // A time on a pass boundary is held as the end of the pass before, not the start of the next.
      const boundary = within > 0 && Number.isFinite(duration) && within % duration === 0;
      clock.seek(within, boundary ? 'end' : 'start');
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
    pending: () => {
      if (released || shown === null) return null;
      return clock.origin + clock.elapsed === shown ? null : shown;
    },
    release,
  };
}
