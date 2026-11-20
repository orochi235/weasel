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

/** A mark's data with its vertices as `shape`, from a save made before vertices followed the bounds, which holds
 *  them as `points` in the content box. Restated against the mark's bounds once the content box is known: against an
 *  empty one every vertex would read 0, so the data is kept as it is until then. A mark already in the current form
 *  comes back as it is. */
export function settledMarkData(
  data: AnnotationData,
  pose: WorldRect,
  content: { width: number; height: number },
): AnnotationData {
  const { points, ...rest } = data as AnnotationData & { points?: readonly FracPoint[] };
  if (!points || content.width === 0 || content.height === 0) return data;
  if (rest.shape) return rest;
  const shape = shapeFor(rest.kind, points, worldToFrac(pose, content));
  return { ...rest, ...(shape ? { shape } : {}) };
}

/** A saved scene with every mark's data settled by `settledMarkData`. A target whose content box is not known yet
 *  keeps its legacy marks, which each read and write settles once it is. */
export function migrateLegacyPoints(
  raw: SerializedMarks,
  content: { width: number; height: number },
): SerializedMarks {
  if (content.width === 0 || content.height === 0) return raw;
  const nodes = raw.nodes.map((n) => {
    const data = settledMarkData(n.data, n.pose, content);
    return data === n.data ? n : { ...n, data };
  });
  return { ...raw, nodes };
}
