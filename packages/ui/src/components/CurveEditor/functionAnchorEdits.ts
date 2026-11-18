import type { ModelRange } from '../Plot2D/geometry';
import { isPinnedEndpointAt } from './anchorRules';
import type { ModelPoint } from './layerTypes';
import type { ControlPoint, EndpointMode, FunctionLayerState } from './functionLayerTypes';

/** What a function layer's options say about where its anchors may go, fixed when the layer is built. */
export interface AnchorRules {
  readonly endpoints: EndpointMode;
  /** Anchors keep their x order: a `'function'` constraint or a `'1d'` domain. */
  readonly ordered: boolean;
  /** Ordered anchors keep a sliver of x between them, so the curve stays a function. */
  readonly strict: boolean;
  readonly xClamp?: readonly [number, number];
  readonly minPoints?: number;
}

/** `p` held inside the plot's model range, whichever way its axes run. */
export function clampToModelRange(p: ModelPoint, m: ModelRange): ModelPoint {
  const xLo = Math.min(m.xMin, m.xMax);
  const xHi = Math.max(m.xMin, m.xMax);
  const yLo = Math.min(m.yMin, m.yMax);
  const yHi = Math.max(m.yMin, m.yMax);
  return {
    x: Math.max(xLo, Math.min(xHi, p.x)),
    y: Math.max(yLo, Math.min(yHi, p.y)),
  };
}

/** The state with the anchor at `index` moved toward `model`, as far as the rules let it go, and made active. */
export function withAnchorMoved(
  state: FunctionLayerState,
  index: number,
  model: ModelPoint,
  range: ModelRange,
  rules: AnchorRules,
): FunctionLayerState {
  const points = state.points;
  if (index < 0 || index >= points.length) return state;
  const xMin = rules.xClamp ? rules.xClamp[0] : range.xMin;
  const xMax = rules.xClamp ? rules.xClamp[1] : range.xMax;
  let nx = model.x;
  let ny = model.y;
  const isEndpoint = index === 0 || index === points.length - 1;

  if (rules.endpoints === 'pinned-both' && isEndpoint) {
    nx = points[index].x;
    ny = points[index].y;
  } else if (rules.endpoints === 'pinned-x' && isEndpoint) {
    nx = index === 0 ? xMin : xMax;
  } else if (rules.ordered) {
    const epsilon = rules.strict ? (xMax - xMin) / 1000 : 0;
    const left = index > 0 ? points[index - 1].x + epsilon : xMin;
    const right = index < points.length - 1 ? points[index + 1].x - epsilon : xMax;
    nx = Math.max(left, Math.min(right, nx));
  }

  // Always clamp x to the layer's own range (so free-mode
  // interior anchors of a sub-range layer can't escape it).
  // Normalize bounds for inverted ranges.
  {
    const lo = Math.min(xMin, xMax);
    const hi = Math.max(xMin, xMax);
    nx = Math.max(lo, Math.min(hi, nx));
  }
  const clamped = clampToModelRange({ x: nx, y: ny }, range);
  const next = points.slice();
  next[index] = { ...points[index], x: clamped.x, y: clamped.y };
  return { ...state, points: next, activeIndex: index };
}

/** The state with one anchor removed, or null where it may not be. */
export function withoutAnchor(state: FunctionLayerState, index: number, rules: AnchorRules): FunctionLayerState | null {
  if (state.points[index]?.locked) return null;
  if (isPinnedEndpointAt(index, state.points.length, rules.endpoints)) return null;
  if (rules.minPoints !== undefined && state.points.length <= rules.minPoints) return null;
  return { ...state, points: state.points.filter((_, i) => i !== index), activeIndex: null };
}

/**
 * On an ordered curve, the neighbor of `insertIndex` that a new anchor at `x` would land on top of, which the press
 * drags instead: mouse jitter would otherwise drop a phantom point directly above an existing anchor. Null otherwise.
 */
export function crowdedNeighbor(
  points: readonly ControlPoint[],
  insertIndex: number,
  x: number,
  range: ModelRange,
  rules: AnchorRules,
): number | null {
  if (!rules.ordered) return null;
  const epsilon = rules.strict ? (range.xMax - range.xMin) / 1000 : 0;
  const left = insertIndex > 0 ? points[insertIndex - 1] : null;
  const right = insertIndex < points.length ? points[insertIndex] : null;
  if (left && Math.abs(x - left.x) < epsilon * 2) return insertIndex - 1;
  if (right && Math.abs(x - right.x) < epsilon * 2) return insertIndex;
  return null;
}

/** Where an anchor added at `x` by a click in empty space goes, or null where pinned endpoints forbid it. */
export function emptyInsertIndex(points: readonly ControlPoint[], x: number, rules: AnchorRules): number | null {
  const count = points.length;
  const pinned = rules.endpoints !== 'free' && count >= 2;
  const after = points.findIndex((p) => p.x > x);
  const insertIndex = !rules.ordered ? count - (pinned ? 1 : 0) : after === -1 ? count : after;
  if (pinned && (insertIndex === 0 || insertIndex === count)) return null;
  return insertIndex;
}

/** `points` with `p` inserted at `index`. */
export function withPointAt(points: readonly ControlPoint[], index: number, p: ControlPoint): ControlPoint[] {
  return [...points.slice(0, index), p, ...points.slice(index)];
}
