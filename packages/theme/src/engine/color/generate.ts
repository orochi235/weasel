import { lerp } from '@weasel-js/geom';
import { hueName, uniqueNames } from './hueNames.ts';
import { searchHues } from './hueSearch.ts';
import { chromaCap, contrast, hueGap, toHex, toLch, type Lch } from './oklch.ts';
import { summarize } from './paletteStats.ts';
import { peakAt, place, toHexPreview } from './placement.ts';

export { hueName } from './hueNames.ts';
export { floorDegrees } from './hueSearch.ts';
export { toHexPreview } from './placement.ts';


/**
 * A hue pinned into the palette with its own lightness.
 *
 * Anchors exist because the lightness law excludes some colors entirely. Yellow
 * is the case that forces it: its chroma peaks at L 0.95 — higher than any other
 * hue — so a law that picks lightness for legibility silently yields gold, then
 * olive, and never reports that yellow was dropped.
 */
export interface Anchor {
  readonly name: string;
  readonly hue: number;
  readonly lightness: number;
  /**
   * Absolute chroma. Omitted means "as much as the gamut allows here", which is
   * what a bright color wants. A muted color has to say so: hue and lightness
   * alone can only describe vivid colors, so a tan asked for at max chroma
   * comes back as an amber.
   */
  readonly chroma?: number;
}

/** Every constraint the generator honors. A zero disables the ones that gate. */
export interface Constraints {
  readonly count: number;
  /**
   * Minimum hue separation, as a share of the even `360 / count` spacing an
   * ideal set would have. 0 disables the check.
   *
   * A share rather than degrees, because absolute degrees mean different things
   * at different cardinalities: 30 degrees is generous for 8 colors and
   * impossible for 16, so a floor in degrees silently becomes unsatisfiable as
   * the set grows.
   */
  readonly hueFloor: number;
  /** Minimum WCAG contrast every swatch must clear against `surface`. 0 disables. */
  readonly minContrast: number;
  /**
   * Minimum perceptual distance from `surface`. 0 disables.
   *
   * The gate WCAG contrast cannot express. Contrast reads only lightness, so it
   * scores a vivid yellow on white at 1.2:1 and calls it illegible, when what
   * separates them is chroma. Gate on this instead of on lightness and a yellow
   * can be a yellow; gate on contrast alone and the search quietly returns gold.
   */
  readonly minSurfaceDistance: number;
  /** Minimum perceptual distance between any two swatches. 0 disables. */
  readonly minDistance: number;
  readonly surface: string;
  /** Where `lightnessPull` drags each hue, away from its own chroma peak. */
  readonly lightnessTarget: number;
  /** 0 leaves every hue at its chroma peak; 1 puts them all at the target. */
  readonly lightnessPull: number;
  /** Fraction of the in-gamut chroma ceiling to take. */
  readonly chromaFraction: number;
  /** 0 leaves chroma alone; 1 pulls every hue to the set mean. */
  readonly equalize: number;
  readonly anchors: readonly Anchor[];
  readonly order: 'hue' | 'farthest';
}

/** One color of a generated {@link Palette}. */
export interface Swatch {
  readonly name: string;
  readonly hex: string;
  readonly lch: Lch;
  /** Came from one of the constraints' anchors. */
  readonly anchored: boolean;
  /** WCAG contrast against the constraints' `surface`. */
  readonly contrast: number;
}

/** Measurements of a generated palette as a whole: the minimums are over every swatch, or every pair. */
export interface Stats {
  readonly meanChroma: number;
  readonly chromaSpread: number;
  readonly lightnessSpread: number;
  readonly minHueGap: number;
  /** The realized floor as a share of even spacing, comparable across sizes. */
  readonly hueFloorShare: number;
  readonly minContrast: number;
  readonly minSurfaceDistance: number;
  readonly minDistance: number;
}

/** What {@link generate} returns. */
export interface Palette {
  readonly swatches: readonly Swatch[];
  readonly stats: Stats;
  /** False when no hue arrangement satisfied the gates; `swatches` is then the
   *  best unconstrained attempt, so the lab still has something to draw. */
  readonly feasible: boolean;
}

/**
 * Pull each chroma toward the set mean.
 *
 * Raising a chroma is not always possible in place — the weak hues sit on the
 * gamut ceiling already — so this walks lightness to where the target chroma
 * exists, choosing the nearest such lightness. Anchors keep theirs and are
 * only ever desaturated. That asymmetry is why equalizing moves the lightness
 * spread as well.
 */
function equalizeChroma(hexes: string[], k: number, anchored: boolean[]): string[] {
  if (k <= 0) return hexes;
  const lch = hexes.map(toLch);
  const target = lch.reduce((sum, x) => sum + x.C, 0) / lch.length;

  return lch.map((x, i) => {
    const wanted = lerp(x.C, target, k);
    if (anchored[i]) return toHex(x.L, Math.min(wanted, chromaCap(x.L, x.H)), x.H);
    if (chromaCap(x.L, x.H) >= wanted) return toHex(x.L, wanted, x.H);

    let bestL = x.L;
    let bestDistance = Infinity;
    for (let L = 0.30; L <= 0.96; L += 0.005) {
      if (chromaCap(L, x.H) >= wanted) {
        const d = Math.abs(L - x.L);
        if (d < bestDistance) {
          bestDistance = d;
          bestL = L;
        }
      }
    }
    if (bestDistance === Infinity) {
      const pk = peakAt(x.H);
      return toHex(pk, chromaCap(pk, x.H), x.H);
    }
    return toHex(bestL, wanted, x.H);
  });
}

/**
 * Reorder so every prefix stays as separated as a set that size can be.
 * A consumer taking the first three of ten should get three colors 87° apart,
 * not three neighbors.
 */
function farthestFirst(hues: number[]): number[] {
  const order = hues.length === 0 ? [] : [0];
  while (order.length < hues.length) {
    let best = -1;
    let bestGap = -1;
    for (let i = 0; i < hues.length; i += 1) {
      if (order.includes(i)) continue;
      const gap = Math.min(...order.map((j) => hueGap(hues[i], hues[j])));
      if (gap > bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    order.push(best);
  }
  return order;
}

/**
 * A categorical palette of `count` swatches, anchors included, satisfying the gates. When no hue arrangement
 * satisfies them the result is still a full palette, with `feasible` false.
 */
export function generate(c: Constraints): Palette {
  const found = searchHues(c);
  const feasible = found !== null;
  // An infeasible gate still has to draw something, so fall back to an even ring.
  const free =
    found ??
    Array.from({ length: Math.max(0, c.count - c.anchors.length) }, (_, i) =>
      Math.round((i * 360) / Math.max(1, c.count - c.anchors.length)),
    );

  const hues = [...c.anchors.map((a) => a.hue), ...free];
  const anchoredFlags = [...c.anchors.map(() => true), ...free.map(() => false)];
  const raw = [
    ...c.anchors.map(toHexPreview),
    ...free.map((h) => place(h, c)),
  ];
  const hexes = equalizeChroma(raw, c.equalize, anchoredFlags);

  const order =
    c.order === 'farthest'
      ? farthestFirst(hues)
      : [...hues.keys()].sort((a, b) => hues[a] - hues[b]);

  const names = uniqueNames(order.map((i) => toLch(hexes[i]).H));
  const swatches: Swatch[] = order.map((i, position) => ({
    name: c.anchors[i]?.name ?? names[position],
    hex: hexes[i],
    lch: toLch(hexes[i]),
    anchored: anchoredFlags[i],
    contrast: contrast(hexes[i], c.surface),
  }));

  return { swatches, stats: summarize(swatches, c.surface), feasible };
}

/** What the lab opens with: the set this palette work landed on. */
export const DEFAULT_CONSTRAINTS: Constraints = {
  count: 10,
  hueFloor: 0.9,
  minContrast: 4,
  surface: '#181a1e',
  lightnessTarget: 0.72,
  lightnessPull: 0.4,
  chromaFraction: 0.95,
  equalize: 0,
  minSurfaceDistance: 0.25,
  minDistance: 0.22,
  anchors: [],
  order: 'farthest',
};

/**
 * An anchor taken from an existing color — a brand hex, or a color lifted from
 * somewhere else in the theme. Lightness comes along with the hue, which is the
 * point: the reason to pin a color is usually that the lightness law would not
 * have chosen its lightness. `name` defaults to the hue's {@link hueName}.
 */
export function anchorFromHex(hex: string, name?: string): Anchor {
  const { L, C, H } = toLch(hex);
  return {
    name: name ?? hueName(H),
    hue: Math.round(H),
    lightness: Number(L.toFixed(3)),
    chroma: Number(C.toFixed(4)),
  };
}
