import { describe, expect, it } from 'vitest';
import { OCTANT_BSPLINE_MIN_WEIGHT, octantBSplineRadius } from './OctantBSpline';
import {
  type BadgeSplineAnchor, extractAnchorPairs, OCTANT_SPLINE_DEFAULTS, octantSplineRadius, splineVertices,
} from './OctantSpline';

// Every expected value below was computed by the two bases as they stood at ebeb8f6ea (2026-11-13), before they
// shared their anchor reading and outline sweep, by running that commit's compileSpline/evalCompiled,
// compileNurbs/evalNurbsAtS and build() in a throwaway script; octant-spline's weighted values since, when its
// weights stopped tilting its flat ends (2026-11-15); octant-bspline's since it moved to a uniform knot vector, which
// its mirrored phantoms make flat at both ends (2026-11-20).

const SETS: Record<string, BadgeSplineAnchor[]> = {
  bent: [{ s: 0, r: 48, w: 1 }, { s: 0.5, r: 20, w: 1 }, { s: 1, r: 40, w: 1 }],
  defaults: [{ s: 0, r: 48, w: 1 }, { s: 0.25, r: 30, w: 1 }, { s: 0.5, r: 32, w: 1 }, { s: 0.75, r: 38, w: 1 }, { s: 1, r: 46, w: 1 }],
  weighted: [{ s: 0, r: 40, w: 0.4 }, { s: 0.2, r: 55, w: 2.5 }, { s: 0.6, r: 25, w: 0 }, { s: 1, r: 35, w: 1.5 }],
};

const AT = [0, 0.1, 0.33, 0.5, 0.77, 1];

const BEFORE: Record<string, { spline: number[]; bspline: number[] }> = {
  bent: {
    spline: [48, 45.28, 28.398, 20, 30.511856, 40],
    bspline: [38.66666666666667, 37.685333333326646, 31.453130666668752, 28.00000000001456, 30.528927999974858, 33.333333333333336],
  },
  defaults: {
    spline: [48, 42.99085714285714, 27.93088, 32, 38.73305142857143, 46],
    bspline: [42.00000000000001, 39.717333333373034, 31.709952000005106, 32.66666666668849, 38.89819733330698, 43.33333333333333],
  },
  weighted: {
    spline: [40, 48.86548913043478, 78.00125679347826, 53.38994565217391, 30.991171875, 35],
    bspline: [51.36363636363636, 51.94477397533249, 51.586461024641345, 47.30211151232448, 40.56067428329481, 34.966777408637874],
  },
};

const PARAMS = { count: 4, s1: 0.3, r1: 22, w1: 2, s2: 0.7, r2: 44, w2: 0, r3: 30, rotation: 10, samples: 48 };
const PICKED = [0, 5, 17, 30, 47];
const OUTLINES = {
  spline: [
    [97.27856525936087, 50], [66.48859654005402, 62.65214511907996], [37.347854880920075, 66.48859654005398],
    [43.14466970303012, 43.14466970303012], [95.63025114724059, 43.992663470925635],
  ],
  bspline: [
    [72.83999046642992, 50], [72.33734731583485, 67.14004943529946], [32.85995056470053, 72.33734731583485],
    [29.157670252423028, 29.157670252423035], [75.14662288633562, 46.68938429112554],
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

  it('sweep octant-bspline in octant mode', () => {
    const verts = outline('octant', octantBSplineRadius, OCTANT_BSPLINE_MIN_WEIGHT);
    PICKED.forEach((at, i) => {
      expect(verts[at]![0]).toBeCloseTo(OUTLINES.bspline[i]![0]!, 10);
      expect(verts[at]![1]).toBeCloseTo(OUTLINES.bspline[i]![1]!, 10);
    });
  });
});

describe('the octant-spline curve', () => {
  it('stays flat at both ends whatever the weights next to them', () => {
    for (const w of [3, 0.2]) {
      const anchors = OCTANT_SPLINE_DEFAULTS;
      const radius = octantSplineRadius(extractAnchorPairs({ ...anchors, w0: w, w1: w, w3: w, w4: w }));
      const e = 1e-8;
      expect((radius(e) - radius(0)) / e).toBeCloseTo(0, 3);
      expect((radius(1) - radius(1 - e)) / e).toBeCloseTo(0, 3);
    }
  });
});

describe('the octant-bspline curve', () => {
  it('meets its own radius at both ends rather than a phantom control point', () => {
    for (const anchors of Object.values(SETS)) {
      const radius = octantBSplineRadius(anchors);
      expect(radius(0)).toBeCloseTo(radius(1e-6), 3);
      expect(radius(1)).toBeCloseTo(radius(1 - 1e-6), 3);
    }
  });
});

describe('a spline base anchor count', () => {
  it('reads NaN as its least', () => {
    const least = extractAnchorPairs({ count: 3 });
    expect(extractAnchorPairs({ count: NaN })).toEqual(least);
    expect(extractAnchorPairs({ count: NaN }, OCTANT_BSPLINE_MIN_WEIGHT)).toEqual(extractAnchorPairs({ count: 3 }, OCTANT_BSPLINE_MIN_WEIGHT));
  });
});

describe('octant-spline anchors that share an s', () => {
  it('draw the curve through one of them, staying within the anchors radii', () => {
    for (const count of [6, 7, 12]) {
      const radius = octantSplineRadius(extractAnchorPairs({ count }));
      for (let i = 0; i <= 200; i++) {
        const r = radius(i / 200);
        expect(r).toBeGreaterThan(20);
        expect(r).toBeLessThan(60);
      }
      expect(radius(1 - 1e-9)).toBeCloseTo(radius(1), 3);
    }
  });

  it('keep the last anchor at s = 1, so quadrant mode still closes', () => {
    const radius = octantSplineRadius(extractAnchorPairs({ count: 7, mode: 'quadrant' }));
    expect(radius(1)).toBe(radius(0));
    expect(radius(1 - 1e-9)).toBeCloseTo(radius(0), 3);
  });

  it('keep the end anchor at s = 0', () => {
    const radius = octantSplineRadius([{ s: 0, r: 40, w: 1 }, { s: 0, r: 20, w: 1 }, { s: 0.5, r: 30, w: 1 }, { s: 1, r: 35, w: 1 }]);
    expect(radius(0)).toBe(40);
    expect(radius(1e-9)).toBeCloseTo(40, 3);
  });
});

describe('the octant-bspline curve, swept round the badge', () => {
  it('mirrors itself at both ends in octant mode, so it has no corner at a cardinal or a diagonal', () => {
    for (const anchors of Object.values(SETS)) {
      const radius = octantBSplineRadius(anchors);
      for (const e of [1e-3, 1e-2]) {
        expect(radius(-e)).toBeCloseTo(radius(e), 6);
        expect(radius(1 + e)).toBeCloseTo(radius(1 - e), 6);
      }
    }
  });

  it('meets itself at each cardinal in quadrant mode, with one radius and one slope', () => {
    for (const params of [{}, PARAMS, { r1: 20, r2: 44, r3: 26, w1: 2 }]) {
      const radius = octantBSplineRadius(extractAnchorPairs({ ...params, mode: 'quadrant' }, OCTANT_BSPLINE_MIN_WEIGHT), 'quadrant');
      const e = 1e-5;
      expect(radius(1)).toBeCloseTo(radius(0), 6);
      expect((radius(1) - radius(1 - e)) / e).toBeCloseTo((radius(e) - radius(0)) / e, 1);
    }
  });
});
