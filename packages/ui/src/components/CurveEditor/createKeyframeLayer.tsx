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
import { arrowMove } from '@weasel-js/quantity';
import { attract } from '@weasel-js/ui-input';
import { snapRadiusPx as kitSnapRadiusPx } from '../../snap';
import type { CurveLayer, EmptyDownArgs, KeyDownArgs, LayerCtx, LayerGesture, LayerHit, LayerRenderCtx } from './layerTypes';
import {
  activeBezier, applyKeyframeDrag, clampTo, keyframeLayerState, nudgedBezier, nudgedKey, withHandleAt,
  type KeyframeDrag, type KeyframeDragResult, type KeyframeLayerState,
} from './keyframeEdits';
import { keyframeHitAt } from './keyframeCurve';
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

export { CURVE_HIT_PX, HANDLE_HIT_PX, KEY_HIT_PX } from './keyframeCurve';

/** A gesture ends by applying its drag, or by dropping it. */
const settleDrag = {
  onCommit(state: KeyframeLayerState) { return { ...state, ...applyKeyframeDrag(state), drag: null }; },
  onCancel(state: KeyframeLayerState) { return { ...state, drag: null }; },
};

function handleGesture(segment: number, handle: 0 | 1): LayerGesture<KeyframeLayerState> {
  return {
    onMove(state, model) { return withHandleAt(state, segment, handle, model); },
    ...settleDrag,
  };
}

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
    const moved = nudgedKey(state, index, move, ctx.modelRange, cfg);
    if (!moved) return;
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

  return { id, render, hitTest: keyframeHitAt, onPointerDown, onKeyDown };
}
