import type { SerializedScene } from '@weasel-js/core';
import { roundPoints, toShape, type WorldRect, worldToFrac } from './frac';
import type { AnnotationData, FracPoint, FracRect } from './types';

/** Where a mark's vertices sit in its own bounds, from points in the content
 *  box. A point has none to store: its bounds are its position. */
export function shapeFor(
  kind: AnnotationData['kind'],
  points: readonly FracPoint[] | undefined,
  frac: FracRect,
): readonly FracPoint[] | undefined {
  if (!points || kind === 'point') return undefined;
  return roundPoints(toShape(points, frac));
}

export type SerializedMarks = SerializedScene<AnnotationData, 'marks', WorldRect>;

/** Scenes saved before vertices followed the bounds hold them as `points` in
 *  the content box. Restated against each mark's bounds as saved, once the
 *  content box is known: against an empty one every vertex would read 0. */
export function migrateLegacyPoints(
  raw: SerializedMarks,
  content: { w: number; h: number },
): SerializedMarks {
  if (content.w === 0 || content.h === 0) return raw;
  const nodes = raw.nodes.map((n) => {
    const { points, ...data } = n.data as AnnotationData & { points?: readonly FracPoint[] };
    if (!points || data.shape) return n;
    const shape = shapeFor(data.kind, points, worldToFrac(n.pose, content));
    return { ...n, data: { ...data, ...(shape ? { shape } : {}) } };
  });
  return { ...raw, nodes };
}
