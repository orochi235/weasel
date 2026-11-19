import { contrast, CHROMA_WEIGHT, deltaE, hueGap, toLab, toLch } from './oklch.ts';
import { place, toHexPreview } from './placement.ts';
import type { Constraints } from './generate.ts';
import { wrapPositive } from '@weasel-js/geom';

type Lab = readonly [number, number, number];

/** A color in the search, measured once against the gates. */
interface Placed {
  hex: string;
  hue: number;
  contrast: number;
  chroma: number;
  surfaceDistance: number;
  /** OKLab coordinates, chroma pre-weighted, so a pairwise distance in the
   *  search is three subtractions rather than two color conversions. */
  lab: Lab;
}

/** The gates a search holds every set to; a zero disables one. */
interface Gates {
  minGapDeg: number;
  minContrast: number;
  minSurfaceDistance: number;
  minDistance: number;
}

const STEPS = [-16, -8, -4, -2, -1, 1, 2, 4, 8, 16];

/** The share-of-even floor, in degrees, for a set of this size. */
export function floorDegrees(c: Pick<Constraints, 'hueFloor' | 'count'>): number {
  return c.hueFloor <= 0 ? 0 : (c.hueFloor * 360) / Math.max(1, c.count);
}

const weighted = (hex: string): Lab => {
  const [L, a, b] = toLab(hex);
  return [L, CHROMA_WEIGHT * a, CHROMA_WEIGHT * b];
};

const between = (p: Lab, q: Lab) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

function measure(hex: string, surface: string): Placed {
  const lch = toLch(hex);
  return {
    hex,
    hue: lch.H,
    contrast: contrast(hex, surface),
    chroma: lch.C,
    surfaceDistance: deltaE(hex, surface),
    lab: weighted(hex),
  };
}

/**
 * The placed color at hue `H`, measured. Hue is an integer 0-359 and the
 * constraints are fixed for one call, so each is computed once.
 */
function createPlacer(c: Constraints): (H: number) => Placed {
  const placed = new Map<number, Placed>();
  return (H) => {
    const key = wrapPositive(Math.round(H), 360);
    let v = placed.get(key);
    if (!v) {
      v = measure(place(key, c), c.surface);
      placed.set(key, v);
    }
    return v;
  };
}

/**
 * How far a set is from legal, in one number: degrees of hue crowding plus
 * contrast shortfall. Zero means feasible. The search descends this first and
 * only then maximizes chroma, because a seed ring is often illegal and the
 * legal region may not be reachable by chroma-improving moves alone.
 */
function penalty(m: readonly Placed[], g: Gates): number {
  let p = 0;
  if (g.minGapDeg > 0) {
    for (let i = 0; i < m.length; i += 1) {
      for (let j = i + 1; j < m.length; j += 1) {
        const short = g.minGapDeg - hueGap(m[i].hue, m[j].hue);
        if (short > 0) p += short;
      }
    }
  }
  if (g.minContrast > 0) {
    for (const x of m) {
      const short = g.minContrast - x.contrast;
      if (short > 0) p += short * 40;
    }
  }
  // Distances are small numbers in OKLab (0.10 already reads as two colors),
  // so they are weighted up to sit on the same scale as degrees of crowding.
  if (g.minSurfaceDistance > 0) {
    for (const x of m) {
      const short = g.minSurfaceDistance - x.surfaceDistance;
      if (short > 0) p += short * 400;
    }
  }
  if (g.minDistance > 0) {
    for (let i = 0; i < m.length; i += 1) {
      for (let j = i + 1; j < m.length; j += 1) {
        const short = g.minDistance - between(m[i].lab, m[j].lab);
        if (short > 0) p += short * 400;
      }
    }
  }
  return p;
}

/**
 * Everything one position contributes to the penalty: its own shortfalls plus
 * the pairs it takes part in.
 *
 * `descend` moves exactly one hue at a time, so recomputing the whole set for
 * each candidate costs O(n^2) to learn about O(n) changed terms. Scoring the
 * moved position alone is what keeps the count slider live at 16 colors.
 */
function penaltyAt(m: readonly Placed[], i: number, g: Gates): number {
  let p = 0;
  const x = m[i];
  if (g.minContrast > 0) {
    const short = g.minContrast - x.contrast;
    if (short > 0) p += short * 40;
  }
  if (g.minSurfaceDistance > 0) {
    const short = g.minSurfaceDistance - x.surfaceDistance;
    if (short > 0) p += short * 400;
  }
  for (let j = 0; j < m.length; j += 1) {
    if (j === i) continue;
    if (g.minGapDeg > 0) {
      const short = g.minGapDeg - hueGap(x.hue, m[j].hue);
      if (short > 0) p += short;
    }
    if (g.minDistance > 0) {
      const short = g.minDistance - between(x.lab, m[j].lab);
      if (short > 0) p += short * 400;
    }
  }
  return p;
}

/**
 * Where the search starts: uniform rings of `freeCount` hues at several
 * rotations. A uniform ring can never open a 2 * minHueGap hole around a
 * pinned hue, so with anchors it also seeds across the arc the anchors leave free.
 */
function seedRings(freeCount: number, anchorHues: readonly number[], minGapDeg: number): number[][] {
  const seeds: number[][] = [];
  const seedStep = Math.max(6, Math.round(freeCount * 1.6));
  for (let start = 0; start < 360; start += seedStep) {
    seeds.push(Array.from({ length: freeCount }, (_, i) => Math.round((start + (i * 360) / freeCount) % 360)));
  }
  if (anchorHues.length > 0) {
    const base = anchorHues[0];
    const span = 360 - 2 * Math.max(minGapDeg, 1);
    for (let jitter = -8; jitter <= 8; jitter += 2) {
      for (const divisor of [Math.max(1, freeCount - 1), freeCount]) {
        seeds.push(
          Array.from({ length: freeCount }, (_, i) =>
            Math.round(wrapPositive(base + minGapDeg + jitter + (i * span) / divisor, 360)),
          ),
        );
      }
    }
  }
  return seeds;
}

/**
 * Move one free hue at a time, by the first step that improves it, until no
 * step does. Without `useChroma` it descends the penalty; with it, it climbs
 * chroma, and `keepLegal` refuses any move that adds penalty.
 */
function descend(
  hues: number[],
  anchors: readonly Placed[],
  at: (H: number) => Placed,
  g: Gates,
  useChroma: boolean,
  keepLegal: boolean,
): number[] {
  const current = [...hues];
  let meta = [...anchors, ...current.map(at)];
  const offset = anchors.length;
  for (let iteration = 0; iteration < 120; iteration += 1) {
    let improved = false;
    for (let i = 0; i < current.length; i += 1) {
      const slot = offset + i;
      const beforeP = penaltyAt(meta, slot, g);
      const beforeC = meta[slot].chroma;
      for (const delta of STEPS) {
        const next = wrapPositive(current[i] + delta, 360);
        if (next === current[i]) continue;
        const candidate = at(next);
        const trialMeta = meta.slice();
        trialMeta[slot] = candidate;
        const afterP = penaltyAt(trialMeta, slot, g);
        const better = useChroma
          ? (keepLegal ? afterP <= beforeP : true) && candidate.chroma > beforeC
          : afterP < beforeP;
        if (!better) continue;
        if (keepLegal && afterP > beforeP) continue;
        current[i] = next;
        meta = trialMeta;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }
  return current;
}

/**
 * Search hue positions that maximize mean chroma subject to the gates.
 *
 * Seeds matter: a uniform 360/n ring can never open a `2 * minHueGap` hole
 * around a pinned hue, so with anchors the seeds spread across the arc the
 * anchors leave free instead.
 */
export function searchHues(c: Constraints): number[] | null {
  const g: Gates = {
    minGapDeg: floorDegrees(c),
    minContrast: c.minContrast,
    minSurfaceDistance: c.minSurfaceDistance,
    minDistance: c.minDistance,
  };
  const anchors = c.anchors.map((a) => measure(toHexPreview(a), c.surface));
  const freeCount = c.count - c.anchors.length;
  if (freeCount < 0) return null;
  const at = createPlacer(c);
  const metaFor = (free: number[]) => [...anchors, ...free.map(at)];
  const score = (free: number[]) => {
    const m = metaFor(free);
    return m.reduce((sum, x) => sum + x.chroma, 0) / m.length;
  };
  if (freeCount === 0) return penalty(metaFor([]), g) > 0 ? null : [];

  let best: number[] | null = null;
  let bestScore = -1;
  for (const seed of seedRings(freeCount, c.anchors.map((a) => a.hue), g.minGapDeg)) {
    const repaired = penalty(metaFor(seed), g) > 0 ? descend(seed, anchors, at, g, false, false) : seed;
    if (penalty(metaFor(repaired), g) > 0) continue;
    const tuned = descend(repaired, anchors, at, g, true, true);
    if (penalty(metaFor(tuned), g) > 0) continue;
    const s = score(tuned);
    if (s > bestScore) {
      bestScore = s;
      best = tuned;
    }
  }
  return best;
}
