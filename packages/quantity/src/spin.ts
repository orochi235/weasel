import { endlessAllows, endlessAt, endlessTrack, type Endless } from './endless';

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

/** Decimal places `n` is written with, up to ten. */
function placesOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(n);
  const e = text.indexOf('e-');
  if (e >= 0) return Math.min(10, Number(text.slice(e + 2)));
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : Math.min(10, text.length - dot - 1);
}

/**
 * `n` moved to the nearest multiple of `step` counted from `origin`, written
 * with the decimals `step` and `origin` carry, so three steps of `0.1` land on
 * `0.3`. No step, no snap.
 */
export function snapToStep(n: number, step: number | undefined, origin = 0): number {
  if (step === undefined || !(step > 0)) return n;
  const places = Math.max(placesOf(step), placesOf(origin));
  return Number((Math.round((n - origin) / step) * step + origin).toFixed(places));
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
  return at === null ? null : track.fromTrack(at);
}

function finiteSpin(key: string, from: number, bounds: SpinBounds): number | null {
  const by = (n: number) => {
    const places = Math.max(placesOf(from), placesOf(bounds.step));
    return clampToBounds(Number((from + n * bounds.step).toFixed(places)), bounds);
  };
  switch (key) {
    case 'ArrowUp':
      return by(1);
    case 'ArrowDown':
      return by(-1);
    case 'PageUp':
      return by(10);
    case 'PageDown':
      return by(-10);
    case 'Home':
      return bounds.min ?? null;
    case 'End':
      return bounds.max ?? null;
    default:
      return null;
  }
}
