import { DEFAULT_FLATTEN_TOLERANCE } from '@weasel-js/geom';
import type { ExtractOptions } from '@weasel-js/geom/tessellate';

/** Most a thick stroke's centerline turns between flattened vertices: 10°. */
const STROKE_MAX_TURN = Math.PI / 18;

/**
 * How a stroke flattens its path. Every flattened vertex is a join on edges
 * half a width out, so a bend the distance tolerance passes in 40° steps reads
 * as facets once the stroke is thick. A stroke no wider than twice the
 * tolerance keeps the fill's vertices exactly: finer ones could leave a gap
 * between its inner edge and the fill's chords, which a wider one covers.
 */
export function strokeFlattening(
  flattenTolerance: number | undefined,
  width: number,
  vertexWidths?: readonly number[],
): ExtractOptions {
  const tolerance = flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  let widest = width;
  if (vertexWidths) for (const w of vertexWidths) widest = Math.max(widest, w);
  return widest / 2 > tolerance ? { flattenTolerance, maxTurn: STROKE_MAX_TURN } : { flattenTolerance };
}
