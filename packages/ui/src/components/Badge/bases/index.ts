import type { BaseModule } from './types';
import ChamferedRect, { type BadgeChamferedRectBaseParams } from './ChamferedRect';
import RoundedRect, { type BadgeRoundedRectBaseParams } from './RoundedRect';
import Polygon, { type BadgePolygonBaseParams } from './Polygon';
import Puzzle, { type BadgePuzzleBaseParams } from './Puzzle';
import Quatrefoil, { type BadgeQuatrefoilBaseParams } from './Quatrefoil';
import OctantSpline, { type BadgeOctantSplineBaseParams } from './OctantSpline';
import OctantBSpline, { type BadgeOctantBSplineBaseParams } from './OctantBSpline';
import Ribbon, { type BadgeRibbonBaseParams } from './Ribbon';
import Powerline, { type BadgePowerlineBaseParams } from './Powerline';

/** The outlines a composed badge can be built on. */
export type BadgeBase =
  | 'chamfered-rect'
  | 'rounded-rect'
  | 'polygon'
  | 'puzzle'
  | 'quatrefoil'
  | 'octant-spline'
  | 'octant-bspline'
  | 'ribbon'
  | 'powerline';

/** What `baseParams` takes, by the `base` it goes with. */
export interface BadgeBaseParams {
  'chamfered-rect': BadgeChamferedRectBaseParams;
  'rounded-rect': BadgeRoundedRectBaseParams;
  'polygon': BadgePolygonBaseParams;
  'puzzle': BadgePuzzleBaseParams;
  'quatrefoil': BadgeQuatrefoilBaseParams;
  'octant-spline': BadgeOctantSplineBaseParams;
  'octant-bspline': BadgeOctantBSplineBaseParams;
  'ribbon': BadgeRibbonBaseParams;
  'powerline': BadgePowerlineBaseParams;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- BaseModule's P is contravariant (build/insets take it), and Badge.tsx indexes this registry by a runtime BadgeBase, so a per-key map type collapses to an unsatisfiable intersection.
export const BASES: Record<BadgeBase, BaseModule<any>> = {
  'chamfered-rect': ChamferedRect,
  'rounded-rect': RoundedRect,
  'polygon': Polygon,
  'puzzle': Puzzle,
  'quatrefoil': Quatrefoil,
  'octant-spline': OctantSpline,
  'octant-bspline': OctantBSpline,
  'ribbon': Ribbon,
  'powerline': Powerline,
};
