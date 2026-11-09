/**
 * Every gain write in the package goes through here.
 *
 * Two traps, both silent: a bare `param.value = x` sits *behind* any scheduled
 * ramp, which keeps running and wins; and a ramp with no anchor interpolates
 * from the previous scheduled endpoint rather than from the value the param
 * holds now, so a second ramp jumps before it moves.
 */
export function writeParam(
  ctx: BaseAudioContext,
  param: AudioParam,
  value: number,
  rampMs?: number,
): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  if (rampMs && rampMs > 0) {
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + rampMs / 1000);
  } else {
    param.setValueAtTime(value, now);
  }
}

/** Throws on a gain or ramp a caller would keep and an AudioParam refuses: kept, a NaN never
 *  equals what was written, so every later write that recomputes it throws there. */
export function checkGain(what: string, value: number, rampMs?: number): void {
  if (!Number.isFinite(value) || (rampMs !== undefined && !Number.isFinite(rampMs))) {
    throw new RangeError(`@weasel-js/audio: a ${what} gain is finite and ramps over a finite time, not ${value} over ${rampMs} ms`);
  }
}

/**
 * Give a param nothing has scheduled yet its starting value. `.value` is
 * written as well, so a ramp `writeParam` anchors before the first render
 * starts there rather than at the param's default.
 */
export function initParam(ctx: BaseAudioContext, param: AudioParam, value: number): void {
  param.value = value;
  writeParam(ctx, param, value);
}
