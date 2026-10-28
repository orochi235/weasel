import type { ClockHandle } from '@weasel-js/clock';

/** Options for `useAnimator`. Apart from `clock`, everything here is an injection seam for
 *  tests; the defaults are the real clock and rAF. */
export interface UseAnimatorOptions {
  /** Runs the animator on this clock rather than a frame loop of its own: it advances when the
   *  clock moves, so the clock's pause, rate, seeking and visibility gating govern it, and a host's
   *  `useClockLoop` syncs it. A move back plays the running animations backward to the time; one
   *  that ends meanwhile, at its end or back at its start, does not come back. `now` is unused. */
  clock?: ClockHandle;
  /** Optional clock injection for tests. Returns ms since some epoch. */
  now?: () => number;
  /** Optional rAF / cAF injection for tests. Defaults to window.requestAnimationFrame. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}
