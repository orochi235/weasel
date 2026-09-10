import { chromaCap, contrast, hueGap, toHex, toLch, type Lch } from './oklch';

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
}

/** Every constraint the generator honors. A zero disables the ones that gate. */
export interface Constraints {
  readonly count: number;
  /** Minimum degrees between any two hues. 0 disables the check. */
  readonly minHueGap: number;
  /** Minimum contrast every swatch must clear against `surface`. 0 disables. */
  readonly minContrast: number;
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

export interface Swatch {
  readonly name: string;
  readonly hex: string;
  readonly lch: Lch;
  readonly anchored: boolean;
  readonly contrast: number;
}

export interface Stats {
  readonly meanChroma: number;
  readonly chromaSpread: number;
  readonly lightnessSpread: number;
  readonly minHueGap: number;
  readonly minContrast: number;
}

export interface Palette {
  readonly swatches: readonly Swatch[];
  readonly stats: Stats;
  /** False when no hue arrangement satisfied the gates; `swatches` is then the
   *  best unconstrained attempt, so the lab still has something to draw. */
  readonly feasible: boolean;
}

/** Lightness at which a hue reaches its highest chroma. */
function peakLightness(H: number): number {
  let bestL = 0.5;
  let bestC = -1;
  for (let L = 0.32; L <= 0.96; L += 0.01) {
    const c = chromaCap(L, H);
    if (c > bestC) {
      bestC = c;
      bestL = L;
    }
  }
  return bestL;
}

const PEAK: number[] = [];
for (let H = 0; H < 360; H += 1) PEAK.push(peakLightness(H));
const peakAt = (H: number) => PEAK[((Math.round(H) % 360) + 360) % 360];

/** The default law: sit near this hue's chroma peak, pulled toward the target. */
function place(H: number, c: Constraints): string {
  const L = peakAt(H) + (c.lightnessTarget - peakAt(H)) * c.lightnessPull;
  return toHex(L, chromaCap(L, H) * c.chromaFraction, H);
}

const HUE_NAMES: readonly (readonly [number, string])[] = [
  [15, 'rose'], [45, 'red'], [62, 'orange'], [85, 'amber'], [100, 'gold'],
  [122, 'yellow'], [138, 'lime'], [165, 'green'], [195, 'teal'], [218, 'cyan'],
  [245, 'sky'], [275, 'blue'], [310, 'violet'], [345, 'fuchsia'],
];
export function hueName(H: number): string {
  for (const [ceil, name] of HUE_NAMES) if (H < ceil) return name;
  return 'rose';
}

/** Disambiguate repeats: two hues can land in one name's band. */
function uniqueNames(hues: number[]): string[] {
  const seen = new Map<string, number>();
  return hues.map((h) => {
    const base = hueName(h);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
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
    const wanted = x.C + (target - x.C) * k;
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
  const order = [0];
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
 * Search hue positions that maximize mean chroma subject to the gates.
 *
 * Seeds matter: a uniform 360/n ring can never open a `2 * minHueGap` hole
 * around a pinned hue, so with anchors the seeds spread across the arc the
 * anchors leave free instead.
 */
function searchHues(c: Constraints): number[] | null {
  const anchorHues = c.anchors.map((a) => a.hue);
  const anchorHexes = c.anchors.map((a) => toHex(a.lightness, chromaCap(a.lightness, a.hue), a.hue));
  const freeCount = c.count - c.anchors.length;
  if (freeCount < 0) return null;
  if (freeCount === 0) return [];

  // Hue is an integer 0-359 and the constraints are fixed for one call, so the
  // placed color, its realized hue and its contrast are each computed once.
  const placed = new Map<number, { hex: string; hue: number; contrast: number; chroma: number }>();
  const at = (H: number) => {
    const key = ((Math.round(H) % 360) + 360) % 360;
    let v = placed.get(key);
    if (!v) {
      const hex = place(key, c);
      const lch = toLch(hex);
      v = { hex, hue: lch.H, contrast: contrast(hex, c.surface), chroma: lch.C };
      placed.set(key, v);
    }
    return v;
  };
  const anchorMeta = anchorHexes.map((hex) => {
    const lch = toLch(hex);
    return { hex, hue: lch.H, contrast: contrast(hex, c.surface), chroma: lch.C };
  });
  const metaFor = (free: number[]) => [...anchorMeta, ...free.map(at)];

  /**
   * How far a set is from legal, in one number: degrees of hue crowding plus
   * contrast shortfall. Zero means feasible. The search descends this first and
   * only then maximizes chroma, because a seed ring is often illegal and the
   * legal region may not be reachable by chroma-improving moves alone.
   */
  const penalty = (free: number[]): number => {
    const m = metaFor(free);
    let p = 0;
    if (c.minHueGap > 0) {
      for (let i = 0; i < m.length; i += 1) {
        for (let j = i + 1; j < m.length; j += 1) {
          const short = c.minHueGap - hueGap(m[i].hue, m[j].hue);
          if (short > 0) p += short;
        }
      }
    }
    if (c.minContrast > 0) {
      for (const x of m) {
        const short = c.minContrast - x.contrast;
        if (short > 0) p += short * 40;
      }
    }
    return p;
  };
  const score = (free: number[]) => {
    const m = metaFor(free);
    return m.reduce((sum, x) => sum + x.chroma, 0) / m.length;
  };

  const seeds: number[][] = [];
  for (let start = 0; start < 360; start += 6) {
    seeds.push(Array.from({ length: freeCount }, (_, i) => Math.round((start + (i * 360) / freeCount) % 360)));
  }
  if (anchorHues.length > 0) {
    // A uniform ring can never open a 2 * minHueGap hole around a pinned hue,
    // so also seed across the arc the anchors leave free.
    const base = anchorHues[0];
    const span = 360 - 2 * Math.max(c.minHueGap, 1);
    for (let jitter = -8; jitter <= 8; jitter += 2) {
      for (const divisor of [Math.max(1, freeCount - 1), freeCount]) {
        seeds.push(
          Array.from({ length: freeCount }, (_, i) =>
            Math.round((((base + c.minHueGap + jitter + (i * span) / divisor) % 360) + 360) % 360),
          ),
        );
      }
    }
  }

  const STEPS = [-16, -8, -4, -2, -1, 1, 2, 4, 8, 16];
  const descend = (hues: number[], cost: (h: number[]) => number, gate?: (h: number[]) => boolean) => {
    let current = [...hues];
    let currentCost = cost(current);
    for (let iteration = 0; iteration < 120; iteration += 1) {
      let improved = false;
      for (let i = 0; i < freeCount; i += 1) {
        for (const delta of STEPS) {
          const trial = [...current];
          trial[i] = (((trial[i] + delta) % 360) + 360) % 360;
          if (gate && !gate(trial)) continue;
          const trialCost = cost(trial);
          if (trialCost < currentCost) {
            current = trial;
            currentCost = trialCost;
            improved = true;
          }
        }
      }
      if (!improved) break;
    }
    return current;
  };

  let best: number[] | null = null;
  let bestScore = -1;
  for (const seed of seeds) {
    const repaired = penalty(seed) > 0 ? descend(seed, penalty) : seed;
    if (penalty(repaired) > 0) continue;
    const tuned = descend(repaired, (h) => -score(h), (h) => penalty(h) === 0);
    const s = score(tuned);
    if (s > bestScore) {
      bestScore = s;
      best = tuned;
    }
  }
  return best;
}

function summarize(swatches: Swatch[], surface: string): Stats {
  const cs = swatches.map((s) => s.lch.C);
  const ls = swatches.map((s) => s.lch.L);
  let gap = 360;
  for (let i = 0; i < swatches.length; i += 1) {
    for (let j = i + 1; j < swatches.length; j += 1) {
      gap = Math.min(gap, hueGap(swatches[i].lch.H, swatches[j].lch.H));
    }
  }
  return {
    meanChroma: cs.reduce((a, b) => a + b, 0) / (cs.length || 1),
    chromaSpread: Math.max(...cs) - Math.min(...cs),
    lightnessSpread: Math.max(...ls) - Math.min(...ls),
    minHueGap: swatches.length > 1 ? gap : 360,
    minContrast: Math.min(...swatches.map((s) => contrast(s.hex, surface))),
  };
}

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
    ...c.anchors.map((a) => toHex(a.lightness, chromaCap(a.lightness, a.hue), a.hue)),
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
  minHueGap: 32,
  minContrast: 4,
  surface: '#181a1e',
  lightnessTarget: 0.72,
  lightnessPull: 0.4,
  chromaFraction: 0.95,
  equalize: 0,
  anchors: [],
  order: 'farthest',
};

/**
 * An anchor taken from an existing color — a brand hex, or a color lifted from
 * somewhere else in the theme. Lightness comes along with the hue, which is the
 * point: the reason to pin a color is usually that the lightness law would not
 * have chosen its lightness.
 */
/** The color an anchor will actually contribute, for a swatch beside its controls. */
export function toHexPreview(a: Pick<Anchor, 'hue' | 'lightness'>): string {
  return toHex(a.lightness, chromaCap(a.lightness, a.hue), a.hue);
}

export function anchorFromHex(hex: string, name?: string): Anchor {
  const { L, H } = toLch(hex);
  return { name: name ?? hueName(H), hue: Math.round(H), lightness: Number(L.toFixed(3)) };
}

/**
 * Anchors worth reaching for, and why each one needs pinning.
 *
 * Yellow is the sharpest case — its chroma peaks at L 0.95, higher than any
 * other hue, so a lightness law chosen for legibility yields gold and reports
 * nothing. The others are hues whose peak sits far enough from a mid-range
 * target that the law meaningfully changes what you get.
 */
export const SUGGESTED_ANCHORS: readonly (Anchor & { note: string })[] = [
  { name: 'yellow', hue: 110, lightness: 0.88, note: 'Only reads as yellow above L 0.86.' },
  { name: 'lime', hue: 128, lightness: 0.86, note: 'Peaks at L 0.91; a mid-range law gives olive.' },
  { name: 'red', hue: 25, lightness: 0.63, note: 'Peaks low, at L 0.64.' },
  { name: 'violet', hue: 292, lightness: 0.53, note: 'Peaks lowest of all, at L 0.51.' },
  { name: 'cyan', hue: 205, lightness: 0.83, note: 'Thin gamut; wants its peak or it goes gray.' },
];

export const YELLOW_ANCHOR: Anchor = SUGGESTED_ANCHORS[0];
