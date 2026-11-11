import { mixRgbaWeighted, parseColor, rgbaToHex } from '@weasel-js/paint';
import { fullSelection, type Selection } from './axes.ts';
import { readCssNumber } from './cssNumber.ts';
import { resolveTheme, themeAxes, type ResolvedTheme } from './resolveTheme.ts';
import type { Theme } from './theme.ts';

/** A weight for each value of each axis a blend is made along. A value left out weighs nothing; an infinite weight takes the whole axis, shared equally with any other infinite one. */
export type AxisWeights = Readonly<Record<string, Readonly<Record<string, number>>>>;

interface Weighted {
  readonly css: string;
  readonly weight: number;
}

const heaviest = (members: readonly Weighted[]): string => members.reduce((most, m) => (m.weight > most.weight ? m : most)).css;

function blendNumbers(members: readonly Weighted[]): string | undefined {
  const reads: { value: number; weight: number }[] = [];
  let unit: string | undefined;
  for (const { css, weight } of members) {
    const read = readCssNumber(css);
    if (!read || (unit !== undefined && read.unit !== unit)) return undefined;
    unit = read.unit;
    reads.push({ value: read.value, weight });
  }
  const total = reads.reduce((t, r) => t + r.weight, 0);
  // Shares, not raw weights: a weighted sum of two lengths near the double range's end overflows.
  const mean = reads.reduce((sum, r) => sum + r.value * (r.weight / total), 0);
  const values = reads.map((r) => r.value);
  return `${Number(Math.min(Math.max(...values), Math.max(Math.min(...values), mean)).toFixed(4))}${unit}`;
}

function blendColors(members: readonly Weighted[]): string | undefined {
  try {
    return rgbaToHex(mixRgbaWeighted(members.map(({ css, weight }) => ({ color: parseColor(css), weight }))));
  } catch {
    return undefined;
  }
}

function blend(members: readonly Weighted[]): string {
  if (members.every((m) => m.css === members[0]!.css)) return members[0]!.css;
  return blendNumbers(members) ?? blendColors(members) ?? heaviest(members);
}

/**
 * `theme` partway between values of its axes: resolved at every selection
 * `weights` gives a share to, and each token folded from what it resolved to
 * there. A color mixes in OKLCH, premultiplied by alpha as `color-mix()` mixes, and a number with one unit throughout mixes
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
    const positive = Object.entries(shares).filter(([value, share]) => share > 0 && Object.hasOwn(axes[axis]!.values, value));
    if (positive.length === 0) continue;
    // An infinite share takes the whole axis, as a split pref's infinite weight does (prefs' `blend.ts`).
    const infinite = positive.filter(([, share]) => share === Infinity);
    const given = infinite.length > 0 ? infinite.map(([value]) => [value, 1] as const) : positive;
    // Normalized per axis, so shares near the double range's ends neither overflow their sum nor underflow their product.
    const most = Math.max(...given.map(([, share]) => share));
    const total = given.reduce((t, [, share]) => t + share / most, 0);
    at = at.flatMap((one) => given.map(([value, share]) => ({ selection: { ...one.selection, [axis]: value }, weight: one.weight * (share / most / total) })));
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
