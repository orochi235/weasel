import { type EasingFn, type Keyframe } from '@weasel-js/animator';
import { cubicBezierEasing, lerp, resolveEasing } from '@weasel-js/geom';
import { hitTestAnchor, hitTestCurve } from './hitTest';
import type { LayerCtx, LayerHit, PlotPoint } from './layerTypes';
import { activeBezier, type Bezier, type KeyframeLayerState } from './keyframeEdits';

const SAMPLES_PER_SEGMENT = 16;

// A live handle drag is previewed straight from its control points: a
// fresh spec per pointermove through `resolveEasing` would leave one
// permanent cache entry per pixel of drag.
function easingInto(drag: KeyframeLayerState['drag'], keys: readonly Keyframe<number>[], seg: number): EasingFn {
  if (drag?.kind === 'handle' && drag.segment === seg) return cubicBezierEasing(...drag.bezier);
  return resolveEasing(keys[seg].easing);
}

/** Each segment of `keys` sampled in plot space through its easing, with a handle drag in flight drawn live. */
export function keyframeSegments(
  drag: KeyframeLayerState['drag'],
  keys: readonly Keyframe<number>[],
  ctx: Pick<LayerCtx, 'toPlot'>,
): PlotPoint[][] {
  const out: PlotPoint[][] = [];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    const ease = easingInto(drag, keys, i);
    const pts: PlotPoint[] = [];
    for (let j = 0; j <= SAMPLES_PER_SEGMENT; j++) {
      const u = j / SAMPLES_PER_SEGMENT;
      pts.push(ctx.toPlot({ x: lerp(a.t, b.t, u), y: lerp(a.value, b.value, ease(u)) }));
    }
    out.push(pts);
  }
  return out;
}

export const KEY_HIT_PX = 8;
export const HANDLE_HIT_PX = 8;
export const CURVE_HIT_PX = 6;

/** What a press at `plot` lands on: a handle of the selected segment, else a key, else a segment. */
export function keyframeHitAt(state: KeyframeLayerState, plot: PlotPoint, ctx: Pick<LayerCtx, 'toPlot' | 'kitSettings'>): LayerHit | null {
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

/** The plot positions of the selected segment's two bezier handles. */
export function handlePoints(state: KeyframeLayerState, bezier: Bezier, ctx: Pick<LayerCtx, 'toPlot'>): [PlotPoint, PlotPoint] {
  const a = state.keys[state.selectedSegment! - 1];
  const b = state.keys[state.selectedSegment!];
  const at = (xf: number, yf: number) => ctx.toPlot({ x: lerp(a.t, b.t, xf), y: lerp(a.value, b.value, yf) });
  return [at(bezier[0], bezier[1]), at(bezier[2], bezier[3])];
}
