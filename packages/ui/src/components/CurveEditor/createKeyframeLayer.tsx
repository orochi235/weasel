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
import { isPrimaryPress } from '@weasel-js/gestures';
import { hitTestAnchor, hitTestCurve } from './hitTest';
import { arrowMove } from '@weasel-js/quantity';
import { attract } from '@weasel-js/ui-input';
import { snapRadiusPx as kitSnapRadiusPx } from '../../snap';
import type { CurveLayer, EmptyDownArgs, KeyDownArgs, LayerCtx, LayerGesture, LayerHit, LayerRenderCtx, PlotPoint } from './layerTypes';
import { clamp } from '@weasel-js/geom';
import {
  activeBezier, applyKeyframeDrag, keyframeLayerState, moveKeyTo,
  type Bezier, type KeyframeDrag, type KeyframeDragResult, type KeyframeLayerState,
} from './keyframeEdits';
import { handlePoints, keyframeSegments } from './keyframeCurve';
import { keyframeMarks, type KeyframeNames } from './keyframeMarks';
import { keyTargetIn } from './layerMarks';

export { applyKeyframeDrag, keyframeLayerState, type KeyframeDrag, type KeyframeDragResult, type KeyframeLayerState };

/** Options for {@link createKeyframeLayer}. */
export interface KeyframeLayerOptions {
  /** Layer id; default `'keyframes'`. */
  id?: string;
  /** Names the curve in each mark's accessible name. Default `'Curve'`. */
  label?: string;
  /** Formats a key time for accessible names. Default: rounded number. */
  formatX?: (x: number) => string;
  /** Times a dragged key snaps to. Holding alt defeats the snap. */
  snapX?: readonly number[];
  /** Snap reach, in plot pixels. Default: the `targets.snapRadiusPx` kit setting, else 6. */
  snapRadiusPx?: number;
  /** Bounds for a key's time. Default: unbounded. */
  xClamp?: readonly [number, number];
  /** Bounds for a key's value. Default: unbounded. */
  yClamp?: readonly [number, number];
  /** One arrow-key step in model units; shift takes ten. Default: 1% of the
   *  plot's range on that axis. */
  step?: { x?: number; y?: number };
}

export const KEY_HIT_PX = 8;
export const HANDLE_HIT_PX = 8;
export const CURVE_HIT_PX = 6;
const HANDLE_STEP = 0.01;

function clampTo(v: number, range?: readonly [number, number]): number {
  return range ? clamp(v, range[0], range[1]) : v;
}

/** `bezier` with handle `h` moved by `dx`, `dy` key steps; a handle's x stays within its segment. */
function nudgedBezier(bezier: Bezier, h: number, dx: number, dy: number): Bezier {
  const next = [...bezier] as [number, number, number, number];
  next[h * 2] = Math.min(1, Math.max(0, next[h * 2] + dx * HANDLE_STEP));
  next[h * 2 + 1] += dy * HANDLE_STEP;
  return next;
}

/** A gesture ends by applying its drag, or by dropping it. */
const settleDrag = {
  onCommit(state: KeyframeLayerState) { return { ...state, ...applyKeyframeDrag(state), drag: null }; },
  onCancel(state: KeyframeLayerState) { return { ...state, drag: null }; },
};

/**
 * Builds a keyframe layer for `LayeredCurveEditor`. Model x is time and model
 * y is value; each segment is drawn through the easing on the key it runs
 * into. Every key, segment and handle is focusable and named, and the arrow
 * keys move whichever one has focus.
 */
export function createKeyframeLayer(cfg: KeyframeLayerOptions = {}): CurveLayer<KeyframeLayerState> {
  const id = cfg.id ?? 'keyframes';
  const names: KeyframeNames = {
    label: cfg.label ?? 'Curve',
    formatX: cfg.formatX ?? ((x: number) => String(Math.round(x))),
  };
  const snapRadiusPx = (ctx: LayerCtx): number => cfg.snapRadiusPx ?? kitSnapRadiusPx(ctx.kitSettings);

  function render(state: KeyframeLayerState, ctx: LayerRenderCtx): ReactNode {
    return keyframeMarks(state, ctx, names);
  }

  function hitTest(state: KeyframeLayerState, plot: PlotPoint, ctx: LayerCtx): LayerHit | null {
    const bezier = activeBezier(state);
    if (bezier) {
      const h = hitTestAnchor(handlePoints(state, bezier, ctx), plot, ctx.kitSettings?.get('targets.curveHandleHitPx') ?? HANDLE_HIT_PX);
      if (h) return { kind: 'handle', payload: { handle: h.index } };
    }
    const k = hitTestAnchor(state.keys.map((key) => ctx.toPlot({ x: key.t, y: key.value })), plot, ctx.kitSettings?.get('targets.curveKeyHitPx') ?? KEY_HIT_PX);
    if (k) return { kind: 'key', payload: { index: k.index } };
    const c = hitTestCurve(keyframeSegments(state.drag, state.keys, ctx), plot, ctx.kitSettings?.get('targets.curveHitPx') ?? CURVE_HIT_PX);
    if (c) return { kind: 'segment', payload: { segment: c.segIdx + 1 } };
    return null;
  }

  function keyGesture(index: number): LayerGesture<KeyframeLayerState> {
    return {
      onMove(state, model, e, ctx) {
        let t = clampTo(model.x, cfg.xClamp);
        if (cfg.snapX && !e.altKey) {
          const perPx = (ctx.modelRange.xMax - ctx.modelRange.xMin) / ctx.plotSize.width;
          t = clampTo(attract(t, cfg.snapX, Math.abs(perPx) * snapRadiusPx(ctx)), cfg.xClamp);
        }
        return { ...state, drag: { kind: 'key', index, t, value: clampTo(model.y, cfg.yClamp) } };
      },
      ...settleDrag,
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
      ...settleDrag,
    };
  }

  function onPointerDown(
    state: KeyframeLayerState,
    hit: LayerHit,
    e: PointerEvent,
    _ctx: LayerCtx,
    extra: EmptyDownArgs<KeyframeLayerState>,
  ): LayerGesture<KeyframeLayerState> | void {
    if (!isPrimaryPress(e)) return;
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

  /** Enter or space selects the focused key; an arrow moves it, and focus follows it through a re-sort. */
  function keyOnKey(
    state: KeyframeLayerState, e: KeyboardEvent, keyEl: Element, move: { dx: number; dy: number } | null,
    ctx: LayerCtx, extra: KeyDownArgs<KeyframeLayerState>,
  ): void {
    const index = Number(keyEl.getAttribute('data-keyframe-index'));
    const k = state.keys[index];
    if (!k) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      extra.commit({ ...state, selectedKey: index });
      return;
    }
    if (!move) return;
    e.preventDefault();
    const m = ctx.modelRange;
    const stepX = cfg.step?.x ?? Math.abs(m.xMax - m.xMin) / 100;
    const stepY = cfg.step?.y ?? Math.abs(m.yMax - m.yMin) / 100;
    const t = clampTo(k.t + move.dx * stepX, cfg.xClamp);
    const value = clampTo(k.value + move.dy * stepY, cfg.yClamp);
    if (t === k.t && value === k.value) return;
    const moved = moveKeyTo(state, index, t, value);
    extra.commit({ ...state, ...moved, drag: null });
    // Marks are keyed by index, so the one at the key's new index is the
    // element that draws it after the re-sort.
    if (moved.selectedKey !== index) {
      keyEl.parentNode
        ?.querySelector<SVGElement>(`[data-keyframe-index="${moved.selectedKey}"]`)
        ?.focus();
    }
  }

  function onKeyDown(
    state: KeyframeLayerState,
    e: KeyboardEvent,
    ctx: LayerCtx,
    extra: KeyDownArgs<KeyframeLayerState>,
  ): void {
    const target = keyTargetIn(e, id);
    if (!target) return;
    const arrow = arrowMove(e.key, e.shiftKey);
    // The model's y runs up, the screen's down.
    const move = arrow && (arrow.dx !== 0 || arrow.dy !== 0) ? { dx: arrow.dx, dy: -arrow.dy } : null;

    const keyEl = target.closest('[data-keyframe-index]');
    if (keyEl) { keyOnKey(state, e, keyEl, move, ctx, extra); return; }

    const segEl = target.closest('[data-segment-index]');
    if (segEl && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      extra.commit({ ...state, selectedSegment: Number(segEl.getAttribute('data-segment-index')) });
      return;
    }

    const handleEl = target.closest('[data-handle-index]');
    const bezier = activeBezier(state);
    if (handleEl && bezier && state.selectedSegment !== null && move) {
      e.preventDefault();
      const next = nudgedBezier(bezier, Number(handleEl.getAttribute('data-handle-index')), move.dx, move.dy);
      const moved = applyKeyframeDrag({ ...state, drag: { kind: 'handle', segment: state.selectedSegment, bezier: next } });
      if (moved.keys !== state.keys) extra.commit({ ...state, ...moved, drag: null });
    }
  }

  return { id, render, hitTest, onPointerDown, onKeyDown };
}
