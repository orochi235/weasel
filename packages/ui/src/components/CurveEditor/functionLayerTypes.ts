import type { ReactNode } from 'react';
import type { InterpolationMode } from './interpolation';

/** One anchor of a curve, in model space. */
export interface ControlPoint {
  x: number;
  y: number;
  /** When true, this control point can't be moved or deleted by the
   *  user. Render as a smaller diamond with locked styling. */
  locked?: boolean;
}

/**
 * Whether a curve's points keep their x order. In `'1d'` an anchor cannot be
 * dragged past its neighbors and a new point is inserted at its x position;
 * in `'2d'` points are free to move anywhere and keep their list order.
 */
export type CurveDomain = '1d' | '2d';
/**
 * How much of a curve's first and last anchor the user may move: everything,
 * only their y, or nothing.
 */
export type EndpointMode = 'free' | 'pinned-x' | 'pinned-both';
/**
 * Where a click adds a new anchor — on the curve itself, anywhere in the
 * plot, or nowhere.
 */
export type AddPointMode = 'click-curve' | 'click-empty' | 'never';

/**
 * What a `renderAnchor` function is given for one anchor: the point, its
 * index, its position in plot space (`cx`/`cy`), and the states that change
 * how it should look.
 */
export interface AnchorRenderProps {
  point: ControlPoint;
  index: number;
  cx: number;
  cy: number;
  isActive: boolean;
  isLocked: boolean;
  isPinnedEndpoint: boolean;
  isEndpoint: boolean;
}

/**
 * Per-instance curve-rendering overrides. Currently empty — passing `{}`
 * means "draw the curve", and `false`/`null` means don't.
 */
export type CurveSettings = object;

/** Shades the region between the curve and one edge of the plot. */
export interface FillSettings {
  side: 'below' | 'above';
  color?: string;
}

/** Configuration for {@link createFunctionLayer}. */
export interface FunctionLayerConfig {
  /** Layer id; default `'function'`. Two instances on the same editor
   *  must have distinct ids. */
  id?: string;
  domain?: CurveDomain;
  endpoints?: EndpointMode;
  interpolation?: InterpolationMode;
  constrain?: 'none' | 'function';
  addPointMode?: AddPointMode;
  minPoints?: number;
  maxPoints?: number;
  curve?: CurveSettings | false | null;
  fill?: FillSettings | false | null;
  hideNonInteractive?: boolean;
  renderAnchor?: (info: AnchorRenderProps) => ReactNode;
  /** When false, the layer renders the curve+fill but doesn't render
   *  anchors and doesn't accept pointer input. For derived read-only
   *  curves (e.g. plotting f'(x) alongside f(x)). Default true. */
  interactive?: boolean;
  /** Override x clamp range for drags and pinned endpoints. Defaults
   *  to the editor's modelRange x. Use this to constrain a layer to a
   *  sub-range of the plot (e.g. a bevel curve occupying x ∈ [0, b]
   *  while the editor's xRange is [0, halfWidth]). */
  xClamp?: readonly [number, number];
  /** Names the curve in each anchor's accessible name. Default `'Point'`. */
  label?: string;
}

/**
 * The state a function layer owns. Treat it as opaque and round-trip it
 * through `LayeredCurveEditor`'s `onLayerChange`; `points` is the part worth
 * reading.
 */
export interface FunctionLayerState {
  points: readonly ControlPoint[];
  /** Layer-internal: the index of the anchor currently being dragged.
   *  Cleared between gestures. Consumers treat the whole state as
   *  opaque and round-trip it via onLayerChange. */
  activeIndex: number | null;
}
