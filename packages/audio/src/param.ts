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
