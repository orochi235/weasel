/**
 * Built-in function/curve layer for LayeredCurveEditor, drawn by a
 * `FunctionLayer` child. Bundles the curve-render + anchor-render +
 * drag/insert/delete gestures. Several coexist on one editor, e.g. a
 * primary function and a derived (read-only) curve on the same chart.
 */
import type { ReactNode } from 'react';
import { CurveFill } from './CurveFill';
import { hitTestAnchor, hitTestCurve } from './hitTest';
import { isHiddenAnchor } from './anchorRules';
import { arrowMove } from '@weasel-js/quantity';
import { dlog } from '../../dlog';
import s from './CurveEditor.module.css';
import type {
  CurveLayer, LayerCtx, LayerGesture, LayerRenderCtx, ModelPoint, PlotPoint,
  EmptyDownArgs, KeyDownArgs,
} from './layerTypes';
import type {
  ControlPoint, CurveDomain, EndpointMode, AddPointMode, AnchorRenderCtx, CurveSettings, FillSettings, FunctionLayerOptions, FunctionLayerState,
} from './functionLayerTypes';
import { isPrimaryPress } from '@weasel-js/gestures';
import { curvePaths, interpolationFor, segmentSamples } from './functionCurve';
import { anchorMarks, type AnchorLook } from './functionAnchorMarks';
import {
  clampToModelRange, crowdedNeighbor, emptyInsertIndex, withAnchorMoved, withoutAnchor, withPointAt, type AnchorRules,
} from './functionAnchorEdits';
import { keyTargetIn } from './layerMarks';

export type {
  ControlPoint, CurveDomain, EndpointMode, AddPointMode, AnchorRenderCtx, CurveSettings, FillSettings, FunctionLayerOptions, FunctionLayerState,
};

/** Out of every hit radius. */
const FAR: PlotPoint = { x: Infinity, y: Infinity };
export const ANCHOR_SNAP_PX = 12;
export const CURVE_HIT_PX = 8;
/** An arrow-key nudge, as a fraction of the range; shift takes ten. */
const KEY_STEP_FRACTION = 0.01;

/**
 * Builds the built-in curve layer for `LayeredCurveEditor`: it draws the
 * interpolated curve and its anchors, and handles dragging, inserting and
 * deleting them.
 *
 * Several can coexist on one editor as long as their ids differ — plotting a
 * derived read-only curve beside an editable one is the case it is shaped
 * for, via `interactive: false`.
 */
export function createFunctionLayer(cfg: FunctionLayerOptions = {}): CurveLayer<FunctionLayerState> {
  const id = cfg.id ?? 'function';
  const endpoints = cfg.endpoints ?? 'free';
  const constrain = cfg.constrain ?? 'none';
  const rules: AnchorRules = {
    endpoints,
    ordered: constrain === 'function' || (cfg.domain ?? '2d') === '1d',
    strict: constrain === 'function',
    xClamp: cfg.xClamp,
    minPoints: cfg.minPoints,
  };
  const addPointMode = cfg.addPointMode ?? 'click-curve';
  const interpolation = interpolationFor(cfg);
  const interactive = cfg.interactive !== false;
  const curveVisible = cfg.curve !== false && cfg.curve !== null;
  const look: AnchorLook = {
    endpoints, curveVisible,
    label: cfg.label, renderAnchor: cfg.renderAnchor, hideNonInteractive: cfg.hideNonInteractive,
  };
  const full = (state: FunctionLayerState) => cfg.maxPoints !== undefined && state.points.length >= cfg.maxPoints;

  function render(state: FunctionLayerState, ctx: LayerRenderCtx): ReactNode {
    const paths = curvePaths(state.points, interpolation, cfg.fill || undefined, ctx);
    return (
      <>
        {paths.fill && cfg.fill && <CurveFill d={paths.fill} fill={ctx.colorCss(cfg.fill.color)} />}
        {paths.line && curveVisible && (
          <path
            className={s.curve}
            d={paths.line}
            fill="none"
          />
        )}
        {interactive && anchorMarks(state, ctx, look)}
      </>
    );
  }

  function hitTest(state: FunctionLayerState, plot: PlotPoint, ctx: LayerCtx) {
    if (!interactive) return null;
    const plotAnchors = state.points.map((p, i) => (isHiddenAnchor(state.points, i, endpoints, cfg.hideNonInteractive) ? FAR : ctx.toPlot(p)));
    const a = hitTestAnchor(plotAnchors, plot, ctx.kitSettings?.get('targets.curveAnchorSnapPx') ?? ANCHOR_SNAP_PX);
    if (a) return { kind: 'anchor' as const, payload: { index: a.index } };
    if (addPointMode === 'click-curve' && curveVisible) {
      const segs = segmentSamples(state.points, interpolation, ctx);
      const c = hitTestCurve(segs, plot, ctx.kitSettings?.get('targets.functionCurveHitPx') ?? CURVE_HIT_PX);
      if (c) return { kind: 'curve' as const, payload: { segIdx: c.segIdx, t: c.t } };
    }
    return null;
  }

  function dragAnchor(index: number): LayerGesture<FunctionLayerState> {
    return {
      onMove(state, model, _e, ctx) { return withAnchorMoved(state, index, model, ctx.modelRange, rules); },
      onCommit(state) { return { ...state, activeIndex: null }; },
    };
  }

  /** Make the anchor at `index` active and drag it. */
  function grab(state: FunctionLayerState, index: number, extra: EmptyDownArgs<FunctionLayerState>): LayerGesture<FunctionLayerState> {
    extra.commit({ ...state, activeIndex: index });
    return dragAnchor(index);
  }

  function onContextMenu(
    state: FunctionLayerState,
    hit: { kind: string; payload?: unknown },
    e: MouseEvent,
    _ctx: LayerCtx,
    extra: EmptyDownArgs<FunctionLayerState>,
  ): void {
    if (!interactive || hit.kind !== 'anchor') return;
    e.preventDefault();
    const next = withoutAnchor(state, (hit.payload as { index: number }).index, rules);
    if (next) extra.commit(next);
  }

  function onPointerDown(
    state: FunctionLayerState,
    hit: { kind: string; payload?: unknown },
    e: PointerEvent,
    ctx: LayerCtx,
    extra: EmptyDownArgs<FunctionLayerState>,
  ): LayerGesture<FunctionLayerState> | void {
    if (!isPrimaryPress(e)) return;
    if (hit.kind === 'anchor') {
      const { index } = hit.payload as { index: number };
      dlog('function-layer', 'anchor-down', { id, index, shift: ctx.modifiers.shift, button: e.button });
      if (state.points[index]?.locked) return;
      if (ctx.modifiers.shift) {
        const next = withoutAnchor(state, index, rules);
        if (next) extra.commit(next);
        return;
      }
      return grab(state, index, extra);
    }
    if (hit.kind === 'curve') {
      const { segIdx } = hit.payload as { segIdx: number; t: number };
      if (full(state)) return;
      const insertIndex = segIdx + 1;
      const modelPt = clampToModelRange(extra.model, ctx.modelRange);
      const neighbor = crowdedNeighbor(state.points, insertIndex, modelPt.x, ctx.modelRange, rules);
      if (neighbor !== null) return grab(state, neighbor, extra);
      extra.commit({ ...state, points: withPointAt(state.points, insertIndex, modelPt), activeIndex: insertIndex });
      return dragAnchor(insertIndex);
    }
  }

  function onEmptyPointerDown(
    state: FunctionLayerState,
    model: ModelPoint,
    e: PointerEvent,
    ctx: LayerCtx,
    extra: EmptyDownArgs<FunctionLayerState>,
  ): LayerGesture<FunctionLayerState> | void {
    if (!interactive || !isPrimaryPress(e)) return;
    if (addPointMode !== 'click-empty') return;
    if (full(state)) return;
    const clamped = clampToModelRange(model, ctx.modelRange);
    const insertIndex = emptyInsertIndex(state.points, clamped.x, rules);
    if (insertIndex === null) return;
    extra.commit({ ...state, points: withPointAt(state.points, insertIndex, clamped), activeIndex: null });
  }

  function onKeyDown(
    state: FunctionLayerState,
    e: KeyboardEvent,
    ctx: LayerCtx,
    extra: KeyDownArgs<FunctionLayerState>,
  ): void {
    if (!interactive) return;
    const el = keyTargetIn(e, id)?.closest('[data-anchor-index]');
    if (!el) return;
    const move = arrowMove(e.key, e.shiftKey);
    if (move === null) return;
    e.preventDefault();
    const index = Number(el.getAttribute('data-anchor-index'));
    const p = state.points[index];
    if (!p || p.locked) return;
    const m = ctx.modelRange;
    const xSpan = cfg.xClamp ? cfg.xClamp[1] - cfg.xClamp[0] : m.xMax - m.xMin;
    const next = withAnchorMoved(state, index, {
      x: p.x + move.dx * Math.abs(xSpan) * KEY_STEP_FRACTION,
      // The model's y runs up, the screen's down.
      y: p.y - move.dy * Math.abs(m.yMax - m.yMin) * KEY_STEP_FRACTION,
    }, m, rules);
    const moved = next.points[index];
    if (moved.x === p.x && moved.y === p.y) return;
    extra.commit({ ...next, activeIndex: null });
  }

  return {
    id,
    render,
    hitTest,
    onPointerDown,
    onContextMenu,
    onEmptyPointerDown,
    onKeyDown,
  };
}

/** Convenience: build a function-layer state from a points array. */
export function functionLayerState(points: readonly ControlPoint[]): FunctionLayerState {
  return { points, activeIndex: null };
}
