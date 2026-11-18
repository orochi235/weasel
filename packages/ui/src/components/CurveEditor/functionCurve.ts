import { type InterpolationMode, sampleByInterpolation, trimNumber } from '@weasel-js/geom';
import { isHiddenAnchor } from './anchorRules';
import { hitTestAnchor, hitTestCurve } from './hitTest';
import type { AnchorLook } from './functionMarks';
import { pathThrough } from './layerMarks';
import type { LayerCtx, LayerHit, PlotPoint } from './layerTypes';
import type { ControlPoint, FillSettings, FunctionLayerOptions } from './functionLayerTypes';

const SAMPLES_PER_SEGMENT = 16;

/** The interpolation a function layer draws with: a `'function'` constraint forces monotone. */
export function interpolationFor(cfg: Pick<FunctionLayerOptions, 'constrain' | 'interpolation'>): InterpolationMode {
  return (cfg.constrain ?? 'none') === 'function'
    ? 'monotone'
    : (cfg.interpolation ?? 'catmull-rom');
}

/** The curve's samples in plot space, one run per pair of neighboring anchors, each sharing its ends. */
export function segmentSamples(
  points: readonly ControlPoint[],
  interpolation: InterpolationMode,
  ctx: Pick<LayerCtx, 'toPlot'>,
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

/** Out of every hit radius. */
const FAR: PlotPoint = { x: Infinity, y: Infinity };
export const ANCHOR_SNAP_PX = 12;
export const CURVE_HIT_PX = 8;

/**
 * What a press at `plot` lands on: a shown anchor, or else the curve when `curve` names the interpolation to hit it
 * through; null where a press on the curve adds nothing.
 */
export function functionHitAt(
  points: readonly ControlPoint[],
  plot: PlotPoint,
  ctx: Pick<LayerCtx, 'toPlot' | 'kitSettings'>,
  shown: Pick<AnchorLook, 'endpoints' | 'hideNonInteractive'>,
  curve: InterpolationMode | null,
): LayerHit | null {
  const plotAnchors = points.map((p, i) => (isHiddenAnchor(points, i, shown.endpoints, shown.hideNonInteractive) ? FAR : ctx.toPlot(p)));
  const a = hitTestAnchor(plotAnchors, plot, ctx.kitSettings?.get('targets.curveAnchorSnapPx') ?? ANCHOR_SNAP_PX);
  if (a) return { kind: 'anchor', payload: { index: a.index } };
  if (curve) {
    const c = hitTestCurve(segmentSamples(points, curve, ctx), plot, ctx.kitSettings?.get('targets.functionCurveHitPx') ?? CURVE_HIT_PX);
    if (c) return { kind: 'curve', payload: { segIdx: c.segIdx, t: c.t } };
  }
  return null;
}

/** The curve's SVG path, and the path of the region it shades when it has a fill; empty with fewer than two points. */
export function curvePaths(
  points: readonly ControlPoint[],
  interpolation: InterpolationMode,
  fill: FillSettings | undefined,
  ctx: Pick<LayerCtx, 'toPlot' | 'plotSize'>,
): { line: string; fill: string | null } {
  if (points.length < 2) return { line: '', fill: null };
  const samples = sampleByInterpolation(points, SAMPLES_PER_SEGMENT, interpolation).map((p) => ctx.toPlot(p));
  const line = pathThrough(samples);
  if (!fill) return { line, fill: null };
  const closingY = trimNumber(fill.side === 'below' ? ctx.plotSize.height : 0, 2);
  const first = samples[0];
  const last = samples[samples.length - 1];
  return { line, fill: `${line}L${trimNumber(last.x, 2)},${closingY}L${trimNumber(first.x, 2)},${closingY}Z` };
}
