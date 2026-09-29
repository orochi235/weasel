/** A one-shot timer pair, as `AudioEngineOptions.setTimer` takes it. */
export interface Timers {
  setTimer(cb: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export const defaultTimers: Timers = {
  setTimer: (cb, ms) => setTimeout(cb, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

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
      handle = timers.setTimer(check, Math.max(1, left * 1000));
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
