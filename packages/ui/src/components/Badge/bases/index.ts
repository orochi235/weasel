import type { BaseModule } from './types';
import ChamferedRect, { type ChamferedRectParams } from './ChamferedRect';
import RoundedRect, { type RoundedRectParams } from './RoundedRect';
import Polygon, { type PolygonParams } from './Polygon';
import Puzzle, { type PuzzleParams } from './Puzzle';
import Quatrefoil, { type QuatrefoilParams } from './Quatrefoil';
import OctantSpline, { type OctantSplineParams } from './OctantSpline';
import OctantBSpline, { type OctantBSplineParams } from './OctantBSpline';
import Ribbon, { type RibbonParams } from './Ribbon';
import Powerline, { type PowerlineParams } from './Powerline';

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

export interface BadgeBaseParams {
  'chamfered-rect': ChamferedRectParams;
  'rounded-rect': RoundedRectParams;
  'polygon': PolygonParams;
  'puzzle': PuzzleParams;
  'quatrefoil': QuatrefoilParams;
  'octant-spline': OctantSplineParams;
  'octant-bspline': OctantBSplineParams;
  'ribbon': RibbonParams;
  'powerline': PowerlineParams;
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
