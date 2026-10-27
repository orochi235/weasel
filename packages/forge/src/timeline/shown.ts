import type { Clock } from '@weasel-js/clock';

/**
 * The time a story's playhead shows: the clock's origin plus how far it is into the current pass, so a looping clock
 * stays inside its span. A clock standing exactly on a pass boundary past the start shows the end of the pass before.
 */
export function shownTime(clock: Clock): number {
  const { duration, elapsed, origin } = clock;
  if (!Number.isFinite(duration)) return origin + elapsed;
  const into = elapsed % duration;
  return origin + (into === 0 && elapsed > 0 ? duration : into);
}

/**
 * Where the clock stands counted across passes, as `holdAt` and `declare` count it. Past the first pass of a looping
 * clock it runs beyond the span, and holding at it comes back to the same pass.
 */
export function clockTime(clock: Clock): number {
  return clock.origin + clock.elapsed;
}

/** Moves the playhead to shown time `t`, clamped to the span; the span's end stands as the end of the first pass. */
export function seekShown(clock: Clock, t: number): void {
  const within = Number.isNaN(t) ? 0 : Math.min(Math.max(t - clock.origin, 0), clock.duration);
  clock.seek(within, within >= clock.duration ? 'end' : 'start');
}
