import { describe, expect, it } from 'vitest';
import { OCTANT_BSPLINE_MIN_WEIGHT, octantBSplineRadius } from './OctantBSpline';
import {
  type BadgeSplineAnchor, extractAnchorPairs, OCTANT_SPLINE_DEFAULTS, octantSplineRadius, splineVertices,
} from './OctantSpline';

// Every expected value below was computed by the two bases as they stood at ebeb8f6ea (2026-11-13), before they
// shared their anchor reading and outline sweep, by running that commit's compileSpline/evalCompiled,
// compileNurbs/evalNurbsAtS and build() in a throwaway script.

const SETS: Record<string, BadgeSplineAnchor[]> = {
  bent: [{ s: 0, r: 48, w: 1 }, { s: 0.5, r: 20, w: 1 }, { s: 1, r: 40, w: 1 }],
  defaults: [{ s: 0, r: 48, w: 1 }, { s: 0.25, r: 30, w: 1 }, { s: 0.5, r: 32, w: 1 }, { s: 0.75, r: 38, w: 1 }, { s: 1, r: 46, w: 1 }],
  weighted: [{ s: 0, r: 40, w: 0.4 }, { s: 0.2, r: 55, w: 2.5 }, { s: 0.6, r: 25, w: 0 }, { s: 1, r: 35, w: 1.5 }],
};

const AT = [0, 0.1, 0.33, 0.5, 0.77, 1];

const BEFORE: Record<string, { spline: number[]; bspline: number[] }> = {
  bent: {
    spline: [48, 45.28, 28.398, 20, 30.511856, 40],
    bspline: [40, 36.28812933761279, 31.318361301649567, 28.000061040744114, 30.17270585960903, 48],
  },
  defaults: {
    spline: [48, 42.99085714285714, 27.93088, 32, 38.73305142857143, 46],
    bspline: [32, 39.25322112934018, 31.70991582588241, 32.66657511498006, 38.89770671343216, 32],
  },
  weighted: {
    spline: [40, 54.0625, 78.00125679347826, 53.38994565217391, 37.88015625, 35],
    bspline: [25, 52.42408901642843, 51.58636579043697, 47.302536617509524, 40.56050893457738, 55],
  },
};

const PARAMS = { count: 4, s1: 0.3, r1: 22, w1: 2, s2: 0.7, r2: 44, w2: 0, r3: 30, rotation: 10, samples: 48 };
const PICKED = [0, 5, 17, 30, 47];
const OUTLINES = {
  spline: [
    [95.84280851496214, 50], [66.48859654005402, 62.65214511907996], [37.347854880920075, 66.48859654005398],
    [43.14466970303012, 43.14466970303012], [94.47546290918396, 44.14469422665034],
  ],
  bspline: [
    [72.83999884365414, 50], [72.3384478376906, 67.14089389542025], [32.85910610457975, 72.3384478376906],
    [29.154485603319905, 29.154485603319912], [75.14676325338078, 46.68936581145347],
  ],
};

describe('the spline radius profiles', () => {
  for (const [name, anchors] of Object.entries(SETS)) {
    it(`draw ${name} as the bases did before they shared their code`, () => {
      const spline = octantSplineRadius(anchors);
      const bspline = octantBSplineRadius(anchors);
      AT.forEach((s, i) => {
        expect(spline(s)).toBeCloseTo(BEFORE[name]!.spline[i]!, 12);
        expect(bspline(s)).toBeCloseTo(BEFORE[name]!.bspline[i]!, 12);
      });
    });
  }
});

describe('the spline outlines', () => {
  const outline = (mode: 'octant' | 'quadrant', radius: (anchors: BadgeSplineAnchor[]) => (s: number) => number, minWeight = 0) => {
    const cfg = { ...OCTANT_SPLINE_DEFAULTS, ...PARAMS, mode };
    return splineVertices(cfg, radius(extractAnchorPairs(cfg, minWeight)));
  };

  it('sweep octant-spline in quadrant mode as before', () => {
    const verts = outline('quadrant', octantSplineRadius);
    PICKED.forEach((at, i) => {
      expect(verts[at]![0]).toBeCloseTo(OUTLINES.spline[i]![0]!, 10);
      expect(verts[at]![1]).toBeCloseTo(OUTLINES.spline[i]![1]!, 10);
    });
  });

  it('sweep octant-bspline in octant mode as before', () => {
    const verts = outline('octant', octantBSplineRadius, OCTANT_BSPLINE_MIN_WEIGHT);
    PICKED.forEach((at, i) => {
      expect(verts[at]![0]).toBeCloseTo(OUTLINES.bspline[i]![0]!, 10);
      expect(verts[at]![1]).toBeCloseTo(OUTLINES.bspline[i]![1]!, 10);
    });
  });
});
