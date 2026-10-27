import { DEFAULT_FLATTEN_TOLERANCE } from '@weasel-js/geom';
import type { VertexWidth } from '@weasel-js/paint';
import type { ExtractOptions } from '@weasel-js/geom/tessellate';
import { widestStrokeWidth } from './vertexWidths';

/**
 * How a stroke flattens its path. Every flattened vertex is a join on edges
 * half a width out, so the edges are held to the tolerance as well as the
 * path: a bend the path's tolerance passes in 40° steps reads as facets once
 * the stroke is thick. A stroke no wider than twice the tolerance keeps the
 * fill's vertices exactly: finer ones could leave a gap between its inner edge
 * and the fill's chords, which a wider one covers.
 */
export function strokeFlattening(
  flattenTolerance: number | undefined,
  width: number,
  vertexWidths?: readonly VertexWidth[],
): ExtractOptions {
  const tolerance = flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const widest = widestStrokeWidth(width, vertexWidths);
  return widest / 2 > tolerance ? { flattenTolerance, offset: widest / 2 } : { flattenTolerance };
}
