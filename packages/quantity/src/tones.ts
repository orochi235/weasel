import { mixOklab, rgbaToHex, tryParseColor } from '@weasel-js/paint';
import { createWarnOnce } from '@weasel-js/registry';
import { bandBounds, bandIndexAt, type Band } from './bands';
import { amount, displayOf, type Display, type Quantity } from './quantity';

/** One stop of a {@link Tones} ramp: a CSS color, and a name spoken beside the value. */
export interface Tone {
  readonly color: string;
  readonly name?: string;
}

/**
 * Colors a value by the band it falls in, as plain data on a display: a band list whose every band carries a
 * {@link Tone}. A value takes the color of the last stop starting at or below it, clamped to the end colors
 * past either end; NaN has no tone.
 */
export interface Tones {
  readonly stops: readonly Band<Tone>[];
  /** Set, each stop's `from` is a fraction of `[min, max]` rather than a value. */
  readonly over?: readonly [min: number, max: number];
  /** Blend between neighboring stops' colors, in OKLab, rather than stepping. A pair whose colors don't parse
   *  (a `var(--…)`) steps instead, and warns once. */
  readonly blend?: boolean;
  /** `false` keeps the tone's name out of the spoken text. */
  readonly speak?: boolean;
}

/** The tone a value takes: its color, and the name and index of the stop at or below it. */
export interface ValueTone {
  color: string;
  name?: string;
  index: number;
}

/** `display` colored by `tones`: `withTones(percent(), rarityTones())`. */
export function withTones<D extends Display>(display: D, tones: Tones): D {
  return { ...display, tones };
}

const warn = createWarnOnce();

/** The tone `value` takes under `tones`; `undefined` for NaN or an empty ramp. */
export function toneAt(tones: Tones, value: number): ValueTone | undefined {
  const { stops } = tones;
  if (stops.length === 0) return undefined;
  const at = placeOf(tones, value);
  const min = stops[0]!.from;
  const index = bandIndexAt(stops, at, min, Infinity);
  if (index < 0) return undefined;
  const stop = stops[index]!.data;
  const tone: ValueTone = { color: stop.color, index };
  if (stop.name !== undefined) tone.name = stop.name;
  if (!tones.blend || index === stops.length - 1) return tone;
  const [lo, hi] = bandBounds(stops, index, min, Infinity);
  const t = hi > lo ? Math.min(1, Math.max(0, (at - lo) / (hi - lo))) : 0;
  if (t === 0) return tone;
  const next = stops[index + 1]!.data.color;
  const a = tryParseColor(stop.color);
  const b = tryParseColor(next);
  if (a === null || b === null) {
    const bad = a === null ? stop.color : next;
    warn(`@weasel-js/quantity: tones can't blend "${bad}", which doesn't parse as a color; stepping instead`, bad);
    return tone;
  }
  return { ...tone, color: rgbaToHex(mixOklab(a, b, 1 - t)) };
}

/** The tone `q` takes under its own display, else `fallback`. */
export function toneOf(q: Quantity, fallback?: Display): ValueTone | undefined {
  const tones = displayOf(q, fallback)?.tones;
  return tones === undefined ? undefined : toneAt(tones, amount(q));
}

/** `spoken` with the tone's name after it, unless the ramp says not to. */
export function spokenTone(spoken: string, tone: ValueTone | undefined, tones: Tones | undefined): string {
  return tone?.name === undefined || tones?.speak === false ? spoken : `${spoken}, ${tone.name}`;
}

/** `value` where the stops are placed: itself, or its fraction of `over`. */
function placeOf(tones: Tones, value: number): number {
  if (tones.over === undefined) return value;
  const [min, max] = tones.over;
  if (max === min) return value < min ? -Infinity : Infinity;
  return (value - min) / (max - min);
}

/**
 * A rarity ramp over `over`, default `[0, 1]`: common, uncommon, rare, epic, and legendary for the top tenth,
 * in gray, green, blue, purple, and orange.
 */
export function rarityTones(over: readonly [min: number, max: number] = [0, 1]): Tones {
  return {
    over,
    stops: [
      { from: 0, data: { color: '#8a8a8a', name: 'common' } },
      { from: 0.25, data: { color: '#2e9e44', name: 'uncommon' } },
      { from: 0.5, data: { color: '#2f6fd6', name: 'rare' } },
      { from: 0.75, data: { color: '#8e44c9', name: 'epic' } },
      { from: 0.9, data: { color: '#e8820c', name: 'legendary' } },
    ],
  };
}
