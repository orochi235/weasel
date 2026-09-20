/**
 * Keyframe layer for LayeredCurveEditor: a value-over-time curve whose shape
 * between two keys is the easing on the later one, with draggable keys and
 * draggable cubic-bezier handles on the selected segment.
 *
 * Distinct from `createFunctionLayer`, which interpolates a spline through
 * its anchors. Here the keys are exact and the easing approximates between
 * them, so the two do not share curve maths.
 */
import type { ReactNode } from 'react';
import { cubicBezierEasing, resolveEasing, type EasingFn, type Keyframe } from '@weasel-js/core';
import { hitTestAnchor, hitTestCurve } from './hitTest';
import { handleHalf } from '../../handles';
import { SNAP_RADIUS_PX, snapToNearest } from '../../snap';
import s from './CurveEditor.module.css';
import type {
  CurveLayer, EmptyDownArgs, KeyDownArgs, LayerCtx, LayerGesture, LayerHit, LayerRenderCtx, PlotPoint,
} from './layerTypes';

type Bezier = readonly [number, number, number, number];

/** A gesture in flight. The committed keys hold still underneath it. */
export type KeyframeDrag =
  | { kind: 'key'; index: number; t: number; value: number }
  | { kind: 'handle'; segment: number; bezier: Bezier };

/**
 * The state a keyframe layer owns, held by the consumer and round-tripped
 * through `LayeredCurveEditor`'s `onLayerChange`.
 */
export interface KeyframeLayerState {
  /** Sorted ascending by `t`. */
  keys: readonly Keyframe<number>[];
  selectedKey: number | null;
  /** Index of the key the selected segment runs into. Its bezier handles show. */
  selectedSegment: number | null;
  drag: KeyframeDrag | null;
}

/** Configuration for {@link createKeyframeLayer}. */
export interface KeyframeLayerConfig {
  /** Layer id; default `'keyframes'`. */
  id?: string;
  /** Names the curve in each mark's accessible name. Default `'Curve'`. */
  label?: string;
  /** Formats a key time for accessible names. Default: rounded number. */
  formatX?: (x: number) => string;
  /** Times a dragged key snaps to. Holding alt defeats the snap. */
  snapX?: readonly number[];
  /** Snap reach, in plot pixels. Default 6. */
  snapRadiusPx?: number;
  /** Bounds for a key's time. Default: unbounded. */
  xClamp?: readonly [number, number];
  /** Bounds for a key's value. Default: unbounded. */
  yClamp?: readonly [number, number];
  /** One arrow-key step in model units; shift takes ten. Default: 1% of the
   *  plot's range on that axis. */
  step?: { x?: number; y?: number };
}

const SAMPLES_PER_SEGMENT = 16;
const KEY_HIT_PX = 8;
const HANDLE_HIT_PX = 8;
const CURVE_HIT_PX = 6;
const KEY_HALF = handleHalf('--wzl-handle-size');
const HANDLE_RADIUS = 3.5;
const SHIFT_MULTIPLIER = 10;
const HANDLE_STEP = 0.01;

/** A keyframe layer state with nothing selected and no gesture in flight. */
export function keyframeLayerState(keys: readonly Keyframe<number>[]): KeyframeLayerState {
  return { keys, selectedKey: null, selectedSegment: null, drag: null };
}

function clampTo(v: number, range?: readonly [number, number]): number {
  return range ? Math.min(range[1], Math.max(range[0], v)) : v;
}

function bezierOf(key: Keyframe<number> | undefined): Bezier | null {
  const e = key?.easing;
  return typeof e === 'object' && e !== null && 'bezier' in e ? e.bezier : null;
}

function moveKeyTo(
  keys: readonly Keyframe<number>[], index: number, t: number, value: number,
): { keys: Keyframe<number>[]; selectedKey: number } {
  const moved = { ...keys[index], t, value };
  const rest = keys.filter((_, i) => i !== index);
  const at = rest.findIndex((k) => k.t > t);
  const selectedKey = at === -1 ? rest.length : at;
  rest.splice(selectedKey, 0, moved);
  return { keys: rest, selectedKey };
}

/**
 * The keys a state's drag would leave behind: a dragged key re-sorted into
 * place, or a dragged handle's control points written onto the key its
 * segment runs into. `selectedKey` follows a moved key to its new index; a
 * key dropped where it started returns the same `keys` array.
 */
export function applyKeyframeDrag(
  state: KeyframeLayerState,
): { keys: readonly Keyframe<number>[]; selectedKey: number | null } {
  const { drag, keys } = state;
  if (!drag) return { keys, selectedKey: state.selectedKey };
  if (drag.kind === 'key') {
    const k = keys[drag.index];
    if (k && k.t === drag.t && k.value === drag.value) return { keys, selectedKey: drag.index };
    return moveKeyTo(keys, drag.index, drag.t, drag.value);
  }
  const next = keys.slice();
  next[drag.segment] = { ...keys[drag.segment], easing: { bezier: drag.bezier } };
  return { keys: next, selectedKey: state.selectedKey };
}

/**
 * Builds a keyframe layer for `LayeredCurveEditor`. Model x is time and model
 * y is value; each segment is drawn through the easing on the key it runs
 * into. Every key, segment and handle is focusable and named, and the arrow
 * keys move whichever one has focus.
 */
export function createKeyframeLayer(cfg: KeyframeLayerConfig = {}): CurveLayer<KeyframeLayerState> {
  const id = cfg.id ?? 'keyframes';
  const label = cfg.label ?? 'Curve';
  const formatX = cfg.formatX ?? ((x: number) => String(Math.round(x)));
  const snapRadiusPx = cfg.snapRadiusPx ?? SNAP_RADIUS_PX;

  // A live handle drag is previewed straight from its control points: a
  // fresh spec per pointermove through `resolveEasing` would leave one
  // permanent cache entry per pixel of drag.
  function easingInto(state: KeyframeLayerState, keys: readonly Keyframe<number>[], seg: number): EasingFn {
    const d = state.drag;
    if (d?.kind === 'handle' && d.segment === seg) return cubicBezierEasing(...d.bezier);
    return resolveEasing(keys[seg].easing);
  }

  function segmentSamples(state: KeyframeLayerState, keys: readonly Keyframe<number>[], ctx: LayerCtx): PlotPoint[][] {
    const out: PlotPoint[][] = [];
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1];
      const b = keys[i];
      const ease = easingInto(state, keys, i);
      const pts: PlotPoint[] = [];
      for (let j = 0; j <= SAMPLES_PER_SEGMENT; j++) {
        const u = j / SAMPLES_PER_SEGMENT;
        pts.push(ctx.toPlot({ x: a.t + (b.t - a.t) * u, y: a.value + (b.value - a.value) * ease(u) }));
      }
      out.push(pts);
    }
    return out;
  }

  function activeBezier(state: KeyframeLayerState): Bezier | null {
    const seg = state.selectedSegment;
    if (seg === null || seg < 1 || seg >= state.keys.length) return null;
    const d = state.drag;
    if (d?.kind === 'handle' && d.segment === seg) return d.bezier;
    return bezierOf(state.keys[seg]);
  }

  function handlePoints(state: KeyframeLayerState, bezier: Bezier, ctx: LayerCtx): [PlotPoint, PlotPoint] {
    const a = state.keys[state.selectedSegment! - 1];
    const b = state.keys[state.selectedSegment!];
    const at = (xf: number, yf: number) =>
      ctx.toPlot({ x: a.t + xf * (b.t - a.t), y: a.value + yf * (b.value - a.value) });
    return [at(bezier[0], bezier[1]), at(bezier[2], bezier[3])];
  }

  const path = (pts: readonly PlotPoint[]): string =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('');

  // ── render ──────────────────────────────────────────────────────────
  function render(state: KeyframeLayerState, ctx: LayerRenderCtx): ReactNode {
    const shown = state.drag?.kind === 'key' ? applyKeyframeDrag(state).keys : state.keys;
    const segments = segmentSamples(state, shown, ctx);
    const curve = segments.flatMap((pts, i) => (i === 0 ? pts : pts.slice(1)));
    const seg = state.selectedSegment;
    const bezier = activeBezier(state);
    const dragIndex = state.drag?.kind === 'key' ? state.drag.index : null;

    return (
      <>
        {seg !== null && seg >= 1 && seg < shown.length ? (() => {
          const x0 = ctx.toPlot({ x: shown[seg - 1].t, y: 0 }).x;
          const x1 = ctx.toPlot({ x: shown[seg].t, y: 0 }).x;
          return (
            <rect
              className={s.segmentBand}
              x={Math.min(x0, x1)}
              y={0}
              width={Math.abs(x1 - x0)}
              height={ctx.plotSize.height}
            />
          );
        })() : null}
        {curve.length > 1 ? <path data-curve-element="curve" className={s.curve} d={path(curve)} /> : null}
        {segments.map((pts, i) => (
          <path
            key={`seg-${i + 1}`}
            className={s.segmentTarget}
            d={path(pts)}
            role="button"
            tabIndex={0}
            aria-label={`${label} segment into ${formatX(shown[i + 1].t)}`}
            aria-current={seg === i + 1 ? 'true' : undefined}
            data-segment-index={i + 1}
          />
        ))}
        {bezier ? (() => {
          const [h1, h2] = handlePoints(state, bezier, ctx);
          const a = ctx.toPlot({ x: state.keys[seg! - 1].t, y: state.keys[seg! - 1].value });
          const b = ctx.toPlot({ x: state.keys[seg!].t, y: state.keys[seg!].value });
          return (
            <>
              <line className={s.handleStem} x1={a.x} y1={a.y} x2={h1.x} y2={h1.y} />
              <line className={s.handleStem} x1={b.x} y1={b.y} x2={h2.x} y2={h2.y} />
              {[h1, h2].map((h, i) => (
                <circle
                  key={`handle-${i}`}
                  className={s.handle}
                  cx={h.x}
                  cy={h.y}
                  r={HANDLE_RADIUS}
                  role="button"
                  tabIndex={0}
                  aria-label={`${label} bezier handle ${i + 1}`}
                  data-handle-index={i}
                />
              ))}
            </>
          );
        })() : null}
        {state.keys.map((k, i) => {
          const p = ctx.toPlot({ x: k.t, y: k.value });
          return (
            <rect
              key={`key-${i}`}
              className={s.keyframe}
              x={p.x - KEY_HALF}
              y={p.y - KEY_HALF}
              width={KEY_HALF * 2}
              height={KEY_HALF * 2}
              transform={`rotate(45 ${p.x} ${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${label} key at ${formatX(k.t)}`}
              aria-current={state.selectedKey === i ? 'true' : undefined}
              data-keyframe-index={i}
              data-dragging={dragIndex === i ? 'true' : undefined}
            />
          );
        })}
        {state.drag?.kind === 'key' ? (() => {
          const p = ctx.toPlot({ x: state.drag.t, y: state.drag.value });
          return (
            <rect
              aria-hidden="true"
              className={s.keyframeGhost}
              x={p.x - KEY_HALF}
              y={p.y - KEY_HALF}
              width={KEY_HALF * 2}
              height={KEY_HALF * 2}
              transform={`rotate(45 ${p.x} ${p.y})`}
              data-keyframe-ghost=""
            />
          );
        })() : null}
      </>
    );
  }

  // ── hit test ────────────────────────────────────────────────────────
  function hitTest(state: KeyframeLayerState, plot: PlotPoint, ctx: LayerCtx): LayerHit | null {
    const bezier = activeBezier(state);
    if (bezier) {
      const h = hitTestAnchor(handlePoints(state, bezier, ctx), plot, HANDLE_HIT_PX);
      if (h) return { kind: 'handle', payload: { handle: h.index } };
    }
    const k = hitTestAnchor(state.keys.map((key) => ctx.toPlot({ x: key.t, y: key.value })), plot, KEY_HIT_PX);
    if (k) return { kind: 'key', payload: { index: k.index } };
    const c = hitTestCurve(segmentSamples(state, state.keys, ctx), plot, CURVE_HIT_PX);
    if (c) return { kind: 'segment', payload: { segment: c.segIdx + 1 } };
    return null;
  }

  // ── gestures ────────────────────────────────────────────────────────
  function keyGesture(index: number): LayerGesture<KeyframeLayerState> {
    return {
      onMove(state, model, e, ctx) {
        let t = clampTo(model.x, cfg.xClamp);
        if (cfg.snapX && !e.altKey) {
          const perPx = (ctx.modelRange.xMax - ctx.modelRange.xMin) / ctx.plotSize.width;
          t = clampTo(snapToNearest(t, cfg.snapX, Math.abs(perPx) * snapRadiusPx), cfg.xClamp);
        }
        return { ...state, drag: { kind: 'key', index, t, value: clampTo(model.y, cfg.yClamp) } };
      },
      onCommit(state) { return { ...state, ...applyKeyframeDrag(state), drag: null }; },
      onCancel(state) { return { ...state, drag: null }; },
    };
  }

  function handleGesture(segment: number, handle: 0 | 1): LayerGesture<KeyframeLayerState> {
    return {
      onMove(state, model) {
        const a = state.keys[segment - 1];
        const b = state.keys[segment];
        const d = state.drag;
        if (!a || !b || d?.kind !== 'handle') return state;
        const xf = b.t === a.t ? 0 : Math.min(1, Math.max(0, (model.x - a.t) / (b.t - a.t)));
        const yf = b.value === a.value ? 0 : (model.y - a.value) / (b.value - a.value);
        const bezier = [...d.bezier] as [number, number, number, number];
        bezier[handle * 2] = xf;
        bezier[handle * 2 + 1] = yf;
        return { ...state, drag: { kind: 'handle', segment, bezier } };
      },
      onCommit(state) { return { ...state, ...applyKeyframeDrag(state), drag: null }; },
      onCancel(state) { return { ...state, drag: null }; },
    };
  }

  function onPointerDown(
    state: KeyframeLayerState,
    hit: LayerHit,
    e: PointerEvent,
    _ctx: LayerCtx,
    extra: EmptyDownArgs<KeyframeLayerState>,
  ): LayerGesture<KeyframeLayerState> | void {
    if (e.button !== 0) return;
    if (hit.kind === 'handle') {
      const bezier = activeBezier(state);
      const segment = state.selectedSegment;
      if (!bezier || segment === null) return;
      const { handle } = hit.payload as { handle: 0 | 1 };
      extra.commit({ ...state, drag: { kind: 'handle', segment, bezier } });
      return handleGesture(segment, handle);
    }
    if (hit.kind === 'key') {
      const { index } = hit.payload as { index: number };
      const k = state.keys[index];
      extra.commit({ ...state, selectedKey: index, drag: { kind: 'key', index, t: k.t, value: k.value } });
      return keyGesture(index);
    }
    if (hit.kind === 'segment') {
      const { segment } = hit.payload as { segment: number };
      extra.commit({ ...state, selectedSegment: segment });
    }
  }

  // ── keyboard ────────────────────────────────────────────────────────
  function onKeyDown(
    state: KeyframeLayerState,
    e: KeyboardEvent,
    ctx: LayerCtx,
    extra: KeyDownArgs<KeyframeLayerState>,
  ): void {
    const target = e.target as Element | null;
    if (target?.closest?.('[data-layer-id]')?.getAttribute('data-layer-id') !== id) return;
    const activate = e.key === 'Enter' || e.key === ' ';
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    const mult = e.shiftKey ? SHIFT_MULTIPLIER : 1;

    const keyEl = target.closest('[data-keyframe-index]');
    if (keyEl) {
      const index = Number(keyEl.getAttribute('data-keyframe-index'));
      const k = state.keys[index];
      if (!k) return;
      if (activate) {
        e.preventDefault();
        extra.commit({ ...state, selectedKey: index });
        return;
      }
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      const m = ctx.modelRange;
      const stepX = (cfg.step?.x ?? Math.abs(m.xMax - m.xMin) / 100) * mult;
      const stepY = (cfg.step?.y ?? Math.abs(m.yMax - m.yMin) / 100) * mult;
      const t = clampTo(k.t + dx * stepX, cfg.xClamp);
      const value = clampTo(k.value + dy * stepY, cfg.yClamp);
      if (t === k.t && value === k.value) return;
      extra.commit({ ...state, ...moveKeyTo(state.keys, index, t, value), drag: null });
      return;
    }

    const segEl = target.closest('[data-segment-index]');
    if (segEl && activate) {
      e.preventDefault();
      extra.commit({ ...state, selectedSegment: Number(segEl.getAttribute('data-segment-index')) });
      return;
    }

    const handleEl = target.closest('[data-handle-index]');
    const bezier = activeBezier(state);
    if (handleEl && bezier && state.selectedSegment !== null && (dx !== 0 || dy !== 0)) {
      e.preventDefault();
      const h = Number(handleEl.getAttribute('data-handle-index'));
      const next = [...bezier] as [number, number, number, number];
      next[h * 2] = Math.min(1, Math.max(0, next[h * 2] + dx * HANDLE_STEP * mult));
      next[h * 2 + 1] += dy * HANDLE_STEP * mult;
      const drag: KeyframeDrag = { kind: 'handle', segment: state.selectedSegment, bezier: next };
      extra.commit({ ...state, ...applyKeyframeDrag({ ...state, drag }), drag: null });
    }
  }

  return { id, render, hitTest, onPointerDown, onKeyDown };
}
