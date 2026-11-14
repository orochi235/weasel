// The radius profiles behind Badge's polar bases, for drawing or editing one of their curves outside a badge. Each
// curve is r(s) over one octant (or quadrant) of the outline: s = 0 is the cardinal direction and s = 1 the
// diagonal, or the next cardinal for a spline in `quadrant` mode.
export {
  type BadgeSplineAnchor,
  OCTANT_SPLINE_DEFAULTS,
  OCTANT_SPLINE_MAX_ANCHORS,
  OCTANT_SPLINE_MIN_ANCHORS,
  octantSplineRadius,
} from './bases/OctantSpline';
export { OCTANT_BSPLINE_MIN_WEIGHT, octantBSplineRadius } from './bases/OctantBSpline';
export { quatrefoilRadius } from './bases/Quatrefoil';
