/** A one-shot timer pair, as `AudioEngineOptions.setTimer` takes it. */
export interface Timers {
  setTimer(cb: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export const defaultTimers: Timers = {
  setTimer: (cb, ms) => setTimeout(cb, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** The longest delay a timer takes: past it, a browser or Node fires at once, which would
 *  recheck a far time every millisecond. */
const MOST_TIMER_MS = 2 ** 31 - 1;

/**
 * Run `cb` once the audio clock reaches `at` (seconds), or at once when the
 * context is not running — a stopped clock never arrives, and nothing is heard
 * meanwhile. The timer alone is not enough: it runs on wall time, and a ramp
 * cut short by an early timer is the click it was scheduled to avoid.
 * Returns a cancel function.
 */
export function atAudioTime(
  ctx: BaseAudioContext,
  timers: Timers,
  at: number,
  cb: () => void,
): () => void {
  let handle: unknown = null;
  let live = true;
  const check = (): void => {
    handle = null;
    if (!live) return;
    const left = at - ctx.currentTime;
    if (ctx.state === 'running' && left > 1e-6) {
      handle = timers.setTimer(check, Math.min(MOST_TIMER_MS, Math.max(1, left * 1000)));
      return;
    }
    live = false;
    cb();
  };
  check();
  return () => {
    live = false;
    if (handle !== null) timers.clearTimer(handle);
    handle = null;
  };
}

/** {@link atAudioTime} for the end of a ramp, except that a stopped clock (suspended, or interrupted by the OS) waits for
 *  it to run again rather than ending it: cut mid-ramp, what the ramp leads into carries on from halfway once the clock
 *  runs again, the click it avoids. Only a close ends the wait early. */
export function afterRamp(ctx: BaseAudioContext, timers: Timers, at: number, cb: () => void): () => void {
  const stopped = (): boolean => ctx.state !== 'running' && ctx.state !== 'closed';
  let stopTimer: () => void = () => {};
  const onState = (): void => {
    if (stopped()) return;
    ctx.removeEventListener('statechange', onState);
    arm();
  };
  const arm = (): void => {
    stopTimer = atAudioTime(ctx, timers, at, () => {
      if (!stopped() || ctx.currentTime >= at) {
        cb();
        return;
      }
      ctx.addEventListener('statechange', onState);
    });
  };
  arm();
  return () => {
    stopTimer();
    ctx.removeEventListener('statechange', onState);
  };
}
