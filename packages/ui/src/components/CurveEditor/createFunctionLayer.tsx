/**
 * Built-in function/curve layer for LayeredCurveEditor, drawn by a
 * `FunctionLayer` child. Bundles the curve-render + anchor-render +
 * drag/insert/delete gestures. Several coexist on one editor, e.g. a
 * primary function and a derived (read-only) curve on the same chart.
 */
import type { ReactNode } from 'react';
import { arrowMove } from '@weasel-js/quantity';
import { dlog } from '../../dlog';
import type {
  CurveLayer, LayerCtx, LayerGesture, LayerRenderCtx, ModelPoint, PlotPoint,
  EmptyDownArgs, KeyDownArgs,
} from './layerTypes';
import type {
  ControlPoint, CurveDomain, EndpointMode, AddPointMode, AnchorRenderCtx, CurveSettings, FillSettings, FunctionLayerOptions, FunctionLayerState,
} from './functionLayerTypes';
import { isPrimaryPress } from '@weasel-js/gestures';
import { functionHitAt, interpolationFor } from './functionCurve';
import { anchorLookFor, functionMarks } from './functionMarks';
import {
  anchorRulesFor, pressOnCurve, withAnchorMoved, withAnchorNudged, withEmptyInsert, withoutAnchor,
} from './functionAnchorEdits';
import { keyTargetIn } from './layerMarks';

export type {
  ControlPoint, CurveDomain, EndpointMode, AddPointMode, AnchorRenderCtx, CurveSettings, FillSettings, FunctionLayerOptions, FunctionLayerState,
};

export { ANCHOR_SNAP_PX, CURVE_HIT_PX } from './functionCurve';

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
  const rules = anchorRulesFor(cfg);
  const addPointMode = cfg.addPointMode ?? 'click-curve';
  const interpolation = interpolationFor(cfg);
  const interactive = cfg.interactive !== false;
  const look = anchorLookFor(cfg);
  const curveVisible = look.curveVisible;
  const full = (state: FunctionLayerState) => cfg.maxPoints !== undefined && state.points.length >= cfg.maxPoints;

  const curve = { interpolation, fill: cfg.fill || undefined, visible: curveVisible };
  function render(state: FunctionLayerState, ctx: LayerRenderCtx): ReactNode {
    return functionMarks(state, ctx, curve, interactive ? look : null);
  }

  const curveTakesPresses = addPointMode === 'click-curve' && curveVisible;
  function hitTest(state: FunctionLayerState, plot: PlotPoint, ctx: LayerCtx) {
    return interactive ? functionHitAt(state.points, plot, ctx, look, curveTakesPresses ? interpolation : null) : null;
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
      if (full(state)) return;
      const { next, index } = pressOnCurve(state, (hit.payload as { segIdx: number }).segIdx, extra.model, ctx.modelRange, rules);
      extra.commit(next);
      return dragAnchor(index);
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
    const next = withEmptyInsert(state, model, ctx.modelRange, rules);
    if (next) extra.commit(next);
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
    const next = withAnchorNudged(state, Number(el.getAttribute('data-anchor-index')), move, ctx.modelRange, rules);
    if (next) extra.commit(next);
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
