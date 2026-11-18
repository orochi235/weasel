import { type EasingFn, type Keyframe } from '@weasel-js/animator';
import { cubicBezierEasing, lerp, resolveEasing } from '@weasel-js/geom';
import type { LayerCtx, PlotPoint } from './layerTypes';
import type { Bezier, KeyframeLayerState } from './keyframeEdits';

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

/** The plot positions of the selected segment's two bezier handles. */
export function handlePoints(state: KeyframeLayerState, bezier: Bezier, ctx: Pick<LayerCtx, 'toPlot'>): [PlotPoint, PlotPoint] {
  const a = state.keys[state.selectedSegment! - 1];
  const b = state.keys[state.selectedSegment!];
  const at = (xf: number, yf: number) => ctx.toPlot({ x: lerp(a.t, b.t, xf), y: lerp(a.value, b.value, yf) });
  return [at(bezier[0], bezier[1]), at(bezier[2], bezier[3])];
}
