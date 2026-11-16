import { polylineFromPoints } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { isRectPose, type NodeShapeEntry, OVERLAY_ROLE_STROKES } from '@weasel-js/core';
import { measureEndsOf, type MeasurePoint } from './measurement';

/** Screen-px half-length of the tick across each end of a measurement. */
export const MEASURE_TICK_PX = 5;

/**
 * A measurement's line and a tick across each end, as the measure painter
 * and the measurements layer draw it. `perPx` is world units per screen pixel, so the
 * line and its ticks keep their screen size at any zoom.
 */
export function measureCommands(start: MeasurePoint, end: MeasurePoint, perPx: number): DrawCommand[] {
  const stroke = { ...OVERLAY_ROLE_STROKES['measure'], width: { px: 1 } };
  const len = Math.hypot(end.x - start.x, end.y - start.y);
  // The ticks run across the line; with no length yet they stand upright.
  const nx = len > 0 ? -(end.y - start.y) / len : 0;
  const ny = len > 0 ? (end.x - start.x) / len : 1;
  const half = MEASURE_TICK_PX * perPx;
  const tick = (p: MeasurePoint): DrawCommand => ({
    kind: 'path',
    path: polylineFromPoints([{ x: p.x - nx * half, y: p.y - ny * half }, { x: p.x + nx * half, y: p.y + ny * half }]),
    stroke,
  });
  const out: DrawCommand[] = [tick(start), tick(end)];
  if (len > 0) out.unshift({ kind: 'path', path: polylineFromPoints([start, end]), stroke });
  return out;
}

/** Paints a measurement node — `data.measure`, in world units — in the
 *  canvas's measure color. It has no silhouette: a measurement is not content
 *  to pick. `measurementsContribution` registers it for its scene; a render
 *  with no canvas registers it itself (`nodeShapesOf(scene).register`). */
export const MEASURE_PAINTER: NodeShapeEntry = {
  id: 'measure:measurement',
  matches: (node) => (node.pose === undefined || isRectPose(node.pose)) && measureEndsOf(node) !== null,
  paint: (node, _pose, ctx) => {
    const ends = measureEndsOf(node);
    if (!ends) return [];
    return measureCommands(ends.start, ends.end, 1 / (ctx?.scale ?? 1));
  },
};
