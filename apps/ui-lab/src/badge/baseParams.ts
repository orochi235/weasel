import { type ConfigShape, f } from '@weasel-js/labkit';
import type { BadgeBase } from '@weasel-js/ui/components/Badge';
import { OCTANT_SPLINE_DEFAULTS } from '@weasel-js/ui/components/Badge/geometry';
import { head, num } from './params';

/** Every quatrefoil param, for the `quatrefoil` base and shape alike. */
export const QUATREFOIL_PARAMS = {
  __spike__: head('Spike'),
  spikeR: num(50, 5, 50, 0.5),
  spikeCurvature: num(1, 0.3, 4, 0.05),
  spikeBend: num(0, -0.9, 0.9, 0.02),
  spikeTipErosion: num(0, 0, 1, 0.02),
  __valley__: head('Valley'),
  valleyR: num(25, 0, 50, 0.5),
  valleyAt: num(0.5, 0.05, 0.95, 0.01),
  valleySmooth: num(3, 0, 20, 0.25),
  __lobe__: head('Lobe'),
  lobeR: num(42, 5, 75, 0.5),
  lobeCurvature: num(1, 0.3, 4, 0.05),
  lobeBend: num(0, -0.9, 0.9, 0.02),
  lobeTipErosion: num(0, 0, 1, 0.02),
  __advanced__: head('Advanced'),
  rotation: num(0, -45, 45, 0.5),
  samples: num(192, 48, 360, 4),
} satisfies ConfigShape;

/** The anchor slots a spline base reads, `count` and `s0`…`w11`, at the base's own defaults. */
export type SplineCurve = Record<string, number>;

export const SPLINE_CURVE_DEFAULTS: SplineCurve = Object.fromEntries(
  Object.entries(OCTANT_SPLINE_DEFAULTS).filter(([key]) => key === 'count' || /^[srw]\d+$/.test(key)),
) as SplineCurve;

/** The key a spline base's group keeps its curve under; the editor drawing it is the app's to give. */
export const SPLINE_CURVE = 'curve';

const splineParams = (curve: ConfigShape[string]) => ({
  mode: f.enum('octant', ['octant', 'quadrant']),
  [SPLINE_CURVE]: curve,
  __advanced__: head('Advanced'),
  rotation: num(0, -45, 45, 0.5),
  samples: num(192, 48, 360, 4),
}) satisfies ConfigShape;

const EDGES = ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'concave-chevron'] as const;
const TAB = ['flat', 'out', 'in'] as const;
const RIBBON_END = ['flat', 'inward', 'outward'] as const;

/** Each base's params, with `curve` the editor `spline` builds for the two spline bases. */
export function baseParams(spline: ConfigShape[string]): Record<BadgeBase, ConfigShape> {
  return {
    'rounded-rect': {
      erosion: num(0.16, 0, 1, 0.02),
      eccentricity: num(1, 0.3, 3, 0.05),
      pinch: num(0, 0, 1, 0.02),
    },
    'chamfered-rect': { chamfer: num(6, 0, 25, 0.5) },
    // A preset's outline, which no control edits; unset, the base draws its own.
    polygon: { vertices: f.custom<readonly (readonly number[])[] | null>('badge-vertices', null).hidden() },
    puzzle: {
      top: f.enum('out', TAB),
      right: f.enum('in', TAB),
      bottom: f.enum('out', TAB),
      left: f.enum('in', TAB),
      tabSize: num(12, 4, 30, 0.5),
      arcSamples: num(18, 6, 40, 1),
    },
    'octant-spline': splineParams(spline),
    'octant-bspline': splineParams(spline),
    quatrefoil: QUATREFOIL_PARAMS,
    ribbon: {
      left: f.enum('inward', RIBBON_END),
      right: f.enum('outward', RIBBON_END),
      taperWidth: num(8, 0, 24, 0.5),
    },
    powerline: {
      leftEdge: f.enum('flat', EDGES),
      rightEdge: f.enum('flat', EDGES),
      depth: num(6, 0, 20, 0.5),
    },
  };
}
