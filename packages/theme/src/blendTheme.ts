import { interpolateSrgb, parseColor, rgbaToHex } from '@weasel-js/paint';
import { fullSelection, type Selection } from './axes.ts';
import { readCssNumber } from './cssNumber.ts';
import { resolveTheme, themeAxes, type ResolvedTheme } from './resolveTheme.ts';
import type { Theme } from './theme.ts';

/** A weight for each value of each axis a blend is made along. A value left out weighs nothing. */
export type AxisWeights = Readonly<Record<string, Readonly<Record<string, number>>>>;

interface Weighted {
  readonly css: string;
  readonly weight: number;
}

const heaviest = (members: readonly Weighted[]): string => members.reduce((most, m) => (m.weight > most.weight ? m : most)).css;

function blendNumbers(members: readonly Weighted[]): string | undefined {
  let sum = 0;
  let total = 0;
  let unit: string | undefined;
  for (const { css, weight } of members) {
    const read = readCssNumber(css);
    if (!read || (unit !== undefined && read.unit !== unit)) return undefined;
    unit = read.unit;
    sum += read.value * weight;
    total += weight;
  }
  return `${Number((sum / total).toFixed(4))}${unit}`;
}

function blendColors(members: readonly Weighted[]): string | undefined {
  let mixed: [number, number, number, number] | undefined;
  let total = 0;
  for (const { css, weight } of members) {
    let next: readonly [number, number, number, number];
    try {
      next = parseColor(css);
    } catch {
      return undefined;
    }
    total += weight;
    if (!mixed) {
      mixed = [...next];
      continue;
    }
    const t = weight / total;
    const [r, g, b] = interpolateSrgb([mixed[0], mixed[1], mixed[2]], [next[0], next[1], next[2]], t, 'oklch');
    mixed = [r, g, b, mixed[3] + (next[3] - mixed[3]) * t];
  }
  return rgbaToHex(mixed!);
}

function blend(members: readonly Weighted[]): string {
  if (members.every((m) => m.css === members[0]!.css)) return members[0]!.css;
  return blendNumbers(members) ?? blendColors(members) ?? heaviest(members);
}

/**
 * `theme` partway between values of its axes: resolved at every selection
 * `weights` gives a share to, and each token folded from what it resolved to
 * there. A color mixes in OKLCH and a number with one unit throughout mixes
 * linearly; any other value is the heaviest selection's, the first on a tie.
 * It is the resolved values that mix, never the rules behind them, so a token
 * that is an alias in one mode and a literal in the other blends like any
 * other. An axis `weights` leaves out stays at `selection`.
 */
export function blendTheme(theme: Theme, weights: AxisWeights, selection: Selection = {}): ResolvedTheme {
  const axes = themeAxes(theme);
  let at: { selection: Selection; weight: number }[] = [{ selection: fullSelection(axes, selection), weight: 1 }];
  for (const [axis, shares] of Object.entries(weights)) {
    if (!Object.hasOwn(axes, axis)) continue;
    const given = Object.entries(shares).filter(([value, share]) => share > 0 && Object.hasOwn(axes[axis]!.values, value));
    if (given.length === 0) continue;
    at = at.flatMap((one) => given.map(([value, share]) => ({ selection: { ...one.selection, [axis]: value }, weight: one.weight * share })));
  }
  const resolved = at.map((one) => ({ tokens: resolveTheme(theme, one.selection) as Record<string, string>, weight: one.weight }));
  if (resolved.length === 1) return resolved[0]!.tokens as ResolvedTheme;

  const out: Record<string, string> = {};
  const names = new Set(resolved.flatMap((one) => Object.keys(one.tokens)));
  for (const name of names) {
    out[name] = blend(resolved.filter((one) => one.tokens[name] !== undefined).map((one) => ({ css: one.tokens[name]!, weight: one.weight })));
  }
  return out as ResolvedTheme;
}
