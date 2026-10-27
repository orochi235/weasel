import { type Clock, shownInPass } from '@weasel-js/clock';

/** The time a story's playhead shows: the clock's origin plus how far it is into the current pass; see `shownInPass`. */
export function shownTime(clock: Clock): number {
  return shownInPass(clock.origin, clock.elapsed, clock.duration, clock.loop);
}

/** Moves the playhead to shown time `t`, clamped to the span; the span's end stands as the end of the first pass. */
export function seekShown(clock: Clock, t: number): void {
  const within = Number.isNaN(t) ? 0 : Math.min(Math.max(t - clock.origin, 0), clock.duration);
  clock.seek(within, within >= clock.duration ? 'end' : 'start');
}
