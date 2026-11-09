import { endlessAllows, endlessAt, endlessTrack, type Endless } from './endless';
import { roundWhole } from './number';
import { decimalPlaces } from './places';

/** The bounds a spin key moves a value within. */
export interface SpinBounds {
  step: number;
  min?: number;
  max?: number;
  /** The ends that stand for infinity: a step past one reaches it, as an endless slider's stop does. */
  endless?: Endless;
}

/** `n` held within the bounds, except an infinity an endless end stands for. */
export function clampToBounds(n: number, { min, max, endless }: SpinBounds): number {
  if (endlessAllows(endless, n)) return n;
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
}

/** The most decimal places a value can be scaled by and still be a whole number a double holds exactly. */
const EXACT_PLACES = 15;

/**
 * `n` moved to the nearest multiple of `step` counted from `origin`, written
 * with the decimals `step` and `origin` carry, so three steps of `0.1` land on
 * `0.3`. A value halfway between two goes to the one farther from `origin`,
 * reckoned in the decimals they are written with: `0.35` at a step of `0.1` is
 * `0.4`, where binary division puts it just short of halfway. No step, no snap.
 */
export function snapToStep(n: number, step: number | undefined, origin = 0): number {
  if (step === undefined || !(step > 0)) return n;
  const places = Math.max(decimalPlaces(step), decimalPlaces(origin));
  return Number((stepsFrom(origin, n, step, places) * step + origin).toFixed(places));
}

/** How many whole steps `n` is from `origin`, a half rounded away from it, counted in whole units of the
 *  smallest place any of the three is written with so a decimal half is exactly one. */
function stepsFrom(origin: number, n: number, step: number, places: number): number {
  const all = Math.max(places, decimalPlaces(n));
  if (places > EXACT_PLACES) return roundWhole((n - origin) / step);
  const scale = 10 ** (all <= EXACT_PLACES ? all : places);
  const at = all <= EXACT_PLACES ? Math.round(n * scale) : n * scale;
  return roundWhole((at - Math.round(origin * scale)) / Math.round(step * scale));
}

/**
 * The value a spin-button key moves `from` to, or `null` for a key that does
 * not spin: the arrows by a step, Page Up and Page Down by ten, and Home and
 * End to a bound, where there is one. A sum of steps is rounded to the places
 * its operands carry, so `0.1 + 0.2` lands on `0.3`.
 */
export function spinKey(key: string, from: number, bounds: SpinBounds): number | null {
  const { endless, step, min, max } = bounds;
  if (endless === undefined) return finiteSpin(key, from, bounds);
  const track = endlessTrack(min ?? -Infinity, max ?? Infinity, step, endless);
  const at = finiteSpin(key, track.toTrack(from), {
    step,
    ...(min === undefined && !endlessAt(endless, -1) ? {} : { min: track.min }),
    ...(max === undefined && !endlessAt(endless, 1) ? {} : { max: track.max }),
  });
  if (at === null) return null;
  // A step that would carry a value past an endless bound lands on the bound first.
  if (key !== 'End' && max !== undefined && from < max && at > max) return max;
  if (key !== 'Home' && min !== undefined && from > min && at < min) return min;
  return track.fromTrack(at);
}

/** Whether `key` spins `from` anywhere: false for a key that does not spin, and at the bound it heads for. */
export function canSpin(key: string, from: number, bounds: SpinBounds): boolean {
  const next = spinKey(key, from, bounds);
  return next !== null && next !== from;
}

/** How many steps a coarse key press takes: an arrow with Shift held, or Page Up and Page Down. */
export const COARSE_STEPS = 10;

function finiteSpin(key: string, from: number, bounds: SpinBounds): number | null {
  const by = (n: number) => {
    const places = Math.max(decimalPlaces(from), decimalPlaces(bounds.step));
    return clampToBounds(Number((from + n * bounds.step).toFixed(places)), bounds);
  };
  switch (key) {
    case 'ArrowUp':
      return by(1);
    case 'ArrowDown':
      return by(-1);
    case 'PageUp':
      return by(COARSE_STEPS);
    case 'PageDown':
      return by(-COARSE_STEPS);
    case 'Home':
      return bounds.min ?? null;
    case 'End':
      return bounds.max ?? null;
    default:
      return null;
  }
}
