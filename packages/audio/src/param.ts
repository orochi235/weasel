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
  // Before the cancel: an AudioParam refuses either, and would throw with the ramp in flight gone.
  checkParam(value, rampMs);
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  if (rampMs && rampMs > 0) {
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + rampMs / 1000);
  } else {
    param.setValueAtTime(value, now);
  }
}

/** Throws on a value or ramp an AudioParam refuses, as {@link writeParam} does: for a write kept
 *  until a node exists to take it, which would otherwise throw from that later start. */
export function checkParam(value: number, rampMs?: number): void {
  if (!Number.isFinite(value) || (rampMs !== undefined && !Number.isFinite(rampMs))) {
    throw new RangeError(`@weasel-js/audio: a param is set to a finite value over a finite time, not ${value} over ${rampMs} ms`);
  }
}

/** Throws on a gain or ramp a caller would keep and an AudioParam refuses: kept, a NaN never
 *  equals what was written, so every later write that recomputes it throws there. */
export function checkGain(what: string, value: number, rampMs?: number): void {
  if (!Number.isFinite(value) || (rampMs !== undefined && !Number.isFinite(rampMs))) {
    throw new RangeError(`@weasel-js/audio: a ${what} gain is finite and ramps over a finite time, not ${value} over ${rampMs} ms`);
  }
}

/** Throws on a voice's rate, detune, pan or position coordinate that is not finite: an
 *  AudioParam refuses one, and the voice processor would mix it into its whole bus as NaN. */
export function checkFinite(what: string, value: number | undefined): void {
  if (value !== undefined && !Number.isFinite(value)) {
    throw new RangeError(`@weasel-js/audio: a ${what} is finite, not ${value}`);
  }
}

/** {@link checkFinite} on each of a point's coordinates. */
export function checkPoint(what: string, p: { x: number; y: number; z?: number } | undefined): void {
  if (!p) return;
  checkFinite(`${what}'s x`, p.x);
  checkFinite(`${what}'s y`, p.y);
  checkFinite(`${what}'s z`, p.z);
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
