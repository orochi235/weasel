/**
 * Built-in function/curve layer for LayeredCurveEditor. Bundles the
 * curve-render + anchor-render + drag/insert/delete gestures that were
 * the entirety of the original `CurveEditor`. Multiple instances coexist
 * by id; consumers can compose several to plot e.g. a primary function
 * and a derived (read-only) curve on the same chart.
 */
import type { ReactNode } from 'react';
import { sampleByInterpolation, type InterpolationMode } from './interpolation';
import { hitTestAnchor, hitTestCurve } from './hitTest';
import { dlog } from '../../dlog';
import s from './CurveEditor.module.css';
import type {
  CurveLayer, LayerCtx, LayerGesture, LayerRenderCtx, ModelPoint, PlotPoint,
  EmptyDownArgs,
} from './layerTypes';

// ── Public types ─────────────────────────────────────────────────────

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
export interface CurveSettings {
  // reserved for future per-instance overrides
}

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

const SAMPLES_PER_SEGMENT = 16;
const ANCHOR_SNAP_PX = 12;
const CURVE_HIT_PX = 8;

// ── Helpers ───────────────────────────────────────────────────────────

function clampToModelRange(p: ModelPoint, ctx: LayerCtx): ModelPoint {
  const m = ctx.modelRange;
  const xLo = Math.min(m.xMin, m.xMax);
  const xHi = Math.max(m.xMin, m.xMax);
  const yLo = Math.min(m.yMin, m.yMax);
  const yHi = Math.max(m.yMin, m.yMax);
  return {
    x: Math.max(xLo, Math.min(xHi, p.x)),
    y: Math.max(yLo, Math.min(yHi, p.y)),
  };
}

function isPinnedEndpointAt(index: number, count: number, endpoints: EndpointMode): boolean {
  if (endpoints === 'free') return false;
  return index === 0 || index === count - 1;
}

function projectAnchors(points: readonly ControlPoint[], ctx: LayerCtx): PlotPoint[] {
  return points.map((p) => ctx.toPlot(p));
}

function segmentSamples(
  points: readonly ControlPoint[],
  interpolation: InterpolationMode,
  ctx: LayerCtx,
): PlotPoint[][] {
  if (points.length < 2) return [];
  const all = sampleByInterpolation(points, SAMPLES_PER_SEGMENT, interpolation);
  const out: PlotPoint[][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = i * SAMPLES_PER_SEGMENT;
    const end = start + SAMPLES_PER_SEGMENT;
    const slice = all.slice(start, end + 1);
    out.push(slice.map((p) => ctx.toPlot(p)));
  }
  return out;
}

function resolveInterpolation(cfg: FunctionLayerConfig): InterpolationMode {
  return (cfg.constrain ?? 'none') === 'function'
    ? 'monotone'
    : (cfg.interpolation ?? 'catmull-rom');
}

// ── Factory ───────────────────────────────────────────────────────────

/**
 * Builds the built-in curve layer for `LayeredCurveEditor`: it draws the
 * interpolated curve and its anchors, and handles dragging, inserting and
 * deleting them.
 *
 * Several can coexist on one editor as long as their ids differ — plotting a
 * derived read-only curve beside an editable one is the case it is shaped
 * for, via `interactive: false`.
 */
export function createFunctionLayer(cfg: FunctionLayerConfig = {}): CurveLayer<FunctionLayerState> {
  const id = cfg.id ?? 'function';
  const domain = cfg.domain ?? '2d';
  const endpoints = cfg.endpoints ?? 'free';
  const constrain = cfg.constrain ?? 'none';
  const addPointMode = cfg.addPointMode ?? 'click-curve';
  const interpolation = resolveInterpolation(cfg);
  const interactive = cfg.interactive !== false;
  const curveVisible = cfg.curve !== false && cfg.curve !== null;

  // ── render ──────────────────────────────────────────────────────────
  function render(state: FunctionLayerState, ctx: LayerRenderCtx): ReactNode {
    const { points, activeIndex } = state;
    const plotAnchors = projectAnchors(points, ctx);

    let pathD = '';
    let fillD: string | null = null;
    if (points.length >= 2) {
      const samples = sampleByInterpolation(points, SAMPLES_PER_SEGMENT, interpolation)
        .map((p) => ctx.toPlot(p));
      const parts: string[] = [`M${samples[0].x.toFixed(2)},${samples[0].y.toFixed(2)}`];
      for (let i = 1; i < samples.length; i++) {
        parts.push(`L${samples[i].x.toFixed(2)},${samples[i].y.toFixed(2)}`);
      }
      pathD = parts.join('');

      if (cfg.fill) {
        const closingY = cfg.fill.side === 'below' ? ctx.plotSize.height : 0;
        const first = samples[0];
        const last = samples[samples.length - 1];
        const fillParts = [...parts];
        fillParts.push(`L${last.x.toFixed(2)},${closingY.toFixed(2)}`);
        fillParts.push(`L${first.x.toFixed(2)},${closingY.toFixed(2)}`);
        fillParts.push('Z');
        fillD = fillParts.join('');
      }
    }

    return (
      <>
        {fillD && (
          <path
            data-curve-element="fill"
            className={s.fill}
            d={fillD}
            fill={cfg.fill ? cfg.fill.color : undefined}
          />
        )}
        {pathD && curveVisible && (
          <path
            className={s.curve}
            d={pathD}
            fill="none"
          />
        )}
        {interactive && plotAnchors.map((a, i) => {
          const pinned = isPinnedEndpointAt(i, points.length, endpoints);
          const locked = points[i]?.locked === true;
          if ((locked || pinned) && cfg.hideNonInteractive) return null;
          const active = activeIndex === i;
          const isEndpoint = curveVisible && (i === 0 || i === points.length - 1);
          if (cfg.renderAnchor) {
            const node = cfg.renderAnchor({
              point: points[i], index: i,
              cx: a.x, cy: a.y,
              isActive: active, isLocked: locked,
              isPinnedEndpoint: pinned, isEndpoint,
            });
            if (node !== null && node !== undefined) {
              return <g key={i} data-anchor-index={i}>{node}</g>;
            }
          }
          const anchorCls = [
            s.anchor,
            isEndpoint && s.endpoint,
            (pinned || locked) && s.pinned,
            locked && s.locked,
            active && s.active,
          ].filter(Boolean).join(' ');
          const renderAsDiamond = isEndpoint || locked;
          if (renderAsDiamond) {
            const half = locked ? 3.55 : 5;
            return (
              <rect
                key={i}
                className={anchorCls}
                x={a.x - half}
                y={a.y - half}
                width={half * 2}
                height={half * 2}
                transform={`rotate(45 ${a.x} ${a.y})`}
                data-anchor-index={i}
              />
            );
          }
          return (
            <circle
              key={i}
              className={anchorCls}
              cx={a.x}
              cy={a.y}
              r={4}
              data-anchor-index={i}
            />
          );
        })}
      </>
    );
  }

  // ── hit test ────────────────────────────────────────────────────────
  function hitTest(state: FunctionLayerState, plot: PlotPoint, ctx: LayerCtx) {
    if (!interactive) return null;
    const plotAnchors = projectAnchors(state.points, ctx);
    const a = hitTestAnchor(plotAnchors, plot, ANCHOR_SNAP_PX);
    if (a) return { kind: 'anchor' as const, payload: { index: a.index } };
    if (addPointMode === 'click-curve' && curveVisible) {
      const segs = segmentSamples(state.points, interpolation, ctx);
      const c = hitTestCurve(segs, plot, CURVE_HIT_PX);
      if (c) return { kind: 'curve' as const, payload: { segIdx: c.segIdx, t: c.t } };
    }
    return null;
  }

  // ── drag gesture ────────────────────────────────────────────────────
  function makeDragGesture(index: number): LayerGesture<FunctionLayerState> {
    return {
      onMove(state, model, _e, ctx) {
        const points = state.points;
        if (index < 0 || index >= points.length) return state;
        const mr = ctx.modelRange;
        const xMin = cfg.xClamp ? cfg.xClamp[0] : mr.xMin;
        const xMax = cfg.xClamp ? cfg.xClamp[1] : mr.xMax;
        let nx = model.x;
        let ny = model.y;
        const isEndpoint = index === 0 || index === points.length - 1;

        if (endpoints === 'pinned-both' && isEndpoint) {
          nx = index === 0 ? xMin : xMax;
          ny = index === 0 ? mr.yMin : mr.yMax;
        } else if (endpoints === 'pinned-x' && isEndpoint) {
          nx = index === 0 ? xMin : xMax;
        } else if (constrain === 'function' || domain === '1d') {
          const epsilon = constrain === 'function'
            ? (xMax - xMin) / 1000
            : 0;
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
        const clamped = clampToModelRange({ x: nx, y: ny }, ctx);
        const next = points.slice();
        next[index] = { ...points[index], x: clamped.x, y: clamped.y };
        return { ...state, points: next, activeIndex: index };
      },
      onCommit(state) { return { ...state, activeIndex: null }; },
      onCancel(state) { return { ...state, activeIndex: null }; },
    };
  }

  // ── pointerdown on a positive hit ───────────────────────────────────
  function onPointerDown(
    state: FunctionLayerState,
    hit: { kind: string; payload?: unknown },
    e: PointerEvent,
    ctx: LayerCtx,
    extra: EmptyDownArgs<FunctionLayerState>,
  ): LayerGesture<FunctionLayerState> | void {
    if (hit.kind === 'anchor') {
      const { index } = hit.payload as { index: number };
      dlog('function-layer', 'anchor-down', { id, index, shift: ctx.modifiers.shift, button: e.button });
      if (state.points[index]?.locked) return;
      if (ctx.modifiers.shift) {
        if (isPinnedEndpointAt(index, state.points.length, endpoints)) return;
        if (cfg.minPoints !== undefined && state.points.length <= cfg.minPoints) return;
        extra.commit({
          ...state,
          points: state.points.filter((_, i) => i !== index),
          activeIndex: null,
        });
        return;
      }
      if (e.button === 2) return;
      extra.commit({ ...state, activeIndex: index });
      return makeDragGesture(index);
    }
    if (hit.kind === 'curve') {
      const { segIdx } = hit.payload as { segIdx: number; t: number };
      if (cfg.maxPoints !== undefined && state.points.length >= cfg.maxPoints) return;
      const insertIndex = segIdx + 1;
      const modelPt = clampToModelRange(extra.model, ctx);

      // function/1d: refuse insert that would be immediately clamped
      // against a neighbor (mouse jitter would otherwise drop a phantom
      // point directly above an existing anchor). Snap to dragging the
      // neighbor instead.
      if (constrain === 'function' || domain === '1d') {
        const epsilon = constrain === 'function'
          ? (ctx.modelRange.xMax - ctx.modelRange.xMin) / 1000
          : 0;
        const left = insertIndex > 0 ? state.points[insertIndex - 1] : null;
        const right = insertIndex < state.points.length ? state.points[insertIndex] : null;
        if (left && Math.abs(modelPt.x - left.x) < epsilon * 2) {
          extra.commit({ ...state, activeIndex: insertIndex - 1 });
          return makeDragGesture(insertIndex - 1);
        }
        if (right && Math.abs(modelPt.x - right.x) < epsilon * 2) {
          extra.commit({ ...state, activeIndex: insertIndex });
          return makeDragGesture(insertIndex);
        }
      }

      const nextPoints = [...state.points.slice(0, insertIndex), modelPt, ...state.points.slice(insertIndex)];
      extra.commit({ ...state, points: nextPoints, activeIndex: insertIndex });
      return makeDragGesture(insertIndex);
    }
  }

  // ── empty-space click ───────────────────────────────────────────────
  function onEmptyPointerDown(
    state: FunctionLayerState,
    model: ModelPoint,
    _e: PointerEvent,
    ctx: LayerCtx,
    extra: EmptyDownArgs<FunctionLayerState>,
  ): LayerGesture<FunctionLayerState> | void {
    if (!interactive) return;
    if (addPointMode !== 'click-empty') return;
    if (cfg.maxPoints !== undefined && state.points.length >= cfg.maxPoints) return;

    const clamped = clampToModelRange(model, ctx);
    let insertIndex = state.points.length;
    if (domain === '1d') {
      for (let i = 0; i < state.points.length; i++) {
        if (state.points[i].x > clamped.x) { insertIndex = i; break; }
      }
    }
    const nextPoints = [...state.points.slice(0, insertIndex), clamped, ...state.points.slice(insertIndex)];
    extra.commit({ ...state, points: nextPoints, activeIndex: null });
    return;
  }

  return {
    id,
    render,
    hitTest,
    onPointerDown,
    onEmptyPointerDown,
  };
}

/** Convenience: build a function-layer state from a points array. */
export function functionLayerState(points: readonly ControlPoint[]): FunctionLayerState {
  return { points, activeIndex: null };
}
