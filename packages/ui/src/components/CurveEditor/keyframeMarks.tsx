import type { ReactNode } from 'react';
import type { Keyframe } from '@weasel-js/animator';
import { Diamond } from './Diamond';
import s from './CurveEditor.module.css';
import { pathThrough } from './layerMarks';
import type { LayerRenderCtx, PlotPoint } from './layerTypes';
import { activeBezier, applyKeyframeDrag, type Bezier, type KeyframeLayerState } from './keyframeEdits';
import { handlePoints, keyframeSegments } from './keyframeCurve';

/** How a keyframe layer names its marks, fixed when the layer is built. */
export interface KeyframeNames {
  readonly label: string;
  readonly formatX: (x: number) => string;
}

/** The band behind the selected segment, spanning the plot's height. */
function segmentBand(keys: readonly Keyframe<number>[], seg: number, ctx: LayerRenderCtx): ReactNode {
  const x0 = ctx.toPlot({ x: keys[seg - 1].t, y: 0 }).x;
  const x1 = ctx.toPlot({ x: keys[seg].t, y: 0 }).x;
  return (
    <rect
      className={s.segmentBand}
      x={Math.min(x0, x1)}
      y={0}
      width={Math.abs(x1 - x0)}
      height={ctx.plotSize.height}
    />
  );
}

/** One focusable target over each segment, named by the key it runs into. */
function segmentTargets(
  segments: readonly PlotPoint[][], keys: readonly Keyframe<number>[], seg: number | null, names: KeyframeNames,
): ReactNode[] {
  return segments.map((pts, i) => (
    <path
      key={`seg-${i + 1}`}
      className={s.segmentTarget}
      d={pathThrough(pts)}
      role="button"
      tabIndex={0}
      aria-label={`${names.label} segment into ${names.formatX(keys[i + 1].t)}`}
      aria-current={seg === i + 1 ? 'true' : undefined}
      data-segment-index={i + 1}
    />
  ));
}

/** The selected segment's two bezier handles, each on a stem from the key it leaves. */
function bezierHandles(state: KeyframeLayerState, bezier: Bezier, ctx: LayerRenderCtx, names: KeyframeNames): ReactNode {
  const [h1, h2] = handlePoints(state, bezier, ctx);
  const from = state.keys[state.selectedSegment! - 1];
  const into = state.keys[state.selectedSegment!];
  const a = ctx.toPlot({ x: from.t, y: from.value });
  const b = ctx.toPlot({ x: into.t, y: into.value });
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
          r={ctx.handleHalf('--wzl-handle-dot-size-sm')}
          role="button"
          tabIndex={0}
          aria-label={`${names.label} bezier handle ${i + 1}`}
          data-handle-index={i}
        />
      ))}
    </>
  );
}

/** One focusable diamond per committed key, the one being dragged marked so. */
function keyMarks(state: KeyframeLayerState, ctx: LayerRenderCtx, names: KeyframeNames): ReactNode[] {
  const dragIndex = state.drag?.kind === 'key' ? state.drag.index : null;
  return state.keys.map((k, i) => (
    <Diamond
      key={`key-${i}`}
      className={s.keyframe}
      at={ctx.toPlot({ x: k.t, y: k.value })}
      half={ctx.handleHalf('--wzl-handle-size')}
      role="button"
      tabIndex={0}
      aria-label={`${names.label} key at ${names.formatX(k.t)}`}
      aria-current={state.selectedKey === i ? 'true' : undefined}
      data-keyframe-index={i}
      data-dragging={dragIndex === i ? 'true' : undefined}
    />
  ));
}

/** Where a key drag in flight would drop its key. */
function keyGhost(drag: { t: number; value: number }, ctx: LayerRenderCtx): ReactNode {
  return (
    <Diamond
      aria-hidden="true"
      className={s.keyframeGhost}
      at={ctx.toPlot({ x: drag.t, y: drag.value })}
      half={ctx.handleHalf('--wzl-handle-size')}
      data-keyframe-ghost=""
    />
  );
}

/**
 * Everything a keyframe layer draws: the curve through the keys as a key drag would leave them, the selected
 * segment's band and handles, a target per segment, a diamond per key, and the ghost of a key in flight.
 */
export function keyframeMarks(state: KeyframeLayerState, ctx: LayerRenderCtx, names: KeyframeNames): ReactNode {
  const preview = state.drag?.kind === 'key' ? applyKeyframeDrag(state) : state;
  const shown = preview.keys;
  const segments = keyframeSegments(state.drag, shown, ctx);
  const curve = segments.flatMap((pts, i) => (i === 0 ? pts : pts.slice(1)));
  const seg = preview.selectedSegment;
  const bezier = activeBezier(state);
  return (
    <>
      {seg !== null && seg >= 1 && seg < shown.length ? segmentBand(shown, seg, ctx) : null}
      {curve.length > 1 ? <path data-curve-element="curve" className={s.curve} d={pathThrough(curve)} /> : null}
      {segmentTargets(segments, shown, seg, names)}
      {bezier ? bezierHandles(state, bezier, ctx, names) : null}
      {keyMarks(state, ctx, names)}
      {state.drag?.kind === 'key' ? keyGhost(state.drag, ctx) : null}
    </>
  );
}
