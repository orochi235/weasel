/**
 * A stroke as geometry: the region its ink covers, as a fillable path.
 *
 * The ribbon the renderer draws already has the joins, caps, dashes, and
 * marker trims; unioning its triangles gives the silhouette with every
 * self-overlap resolved, so the outline and the drawn stroke cannot disagree.
 */
import { scaleVertexWidth, type Stroke } from '@weasel-js/paint';
import { invert, transformPath, type Affine, type Path, type PolygonPath } from '@weasel-js/geom';
import { pathIntersect, pathSubtract, pathUnion, trianglesToPath } from '@weasel-js/geom/booleans';
import { strokeInsets } from './markerInset';
import { resolveStrokeWidth, tessellateStroke } from './tessellate/stroke';
import { markerHeads } from './markerHeads';

/** Options for {@link strokeToPath}. */
export interface StrokeToPathOptions {
  /** Screen pixels per world unit, for a `{ px }` width or marker size.
   *  Default 1. */
  scale?: number;
  /** Flatness tolerance for curves, in the path's units. */
  flattenTolerance?: number;
  /**
   * The frame the stroke is drawn in, as the matrix taking that frame to the
   * path's coordinates: a node's `poseFrameOf`. A frame that skews or
   * stretches does the same to the stroke, as it does on the canvas. For a
   * `{ px }` width under a view that scales each axis apart, the frame is the
   * screen: the inverse of the view's scale, with `scale` left at 1.
   */
  frame?: Affine;
}

const EMPTY: PolygonPath = {
  kind: 'polygon', commands: new Uint8Array(0), coords: new Float32Array(0), fillRule: 'nonzero',
};

/**
 * The region `stroke` covers when drawn along `path`, as a path to fill:
 * width, cap, join, miter limit, dash, alignment, per-vertex widths, and
 * marker heads all included. Curves are flattened, so the result holds only
 * M/L/Z. A stroke with no width answers an empty path, and so does one drawn
 * in a `frame` that flattens it.
 */
export function strokeToPath(path: Path, stroke: Stroke, opts: StrokeToPathOptions = {}): PolygonPath {
  const { frame, ...drawn } = opts;
  if (!frame) return outlineOf(path, stroke, drawn);
  const back = invert(frame);
  if (!back) return EMPTY;
  return transformPath(outlineOf(transformPath(path, back), stroke, drawn), frame) as PolygonPath;
}

function outlineOf(path: Path, stroke: Stroke, opts: StrokeToPathOptions): PolygonPath {
  // The ribbon, the heads and the booleans all work in the path's own offsets.
  if (path.kind === 'polygon' && path.origin) {
    const { origin, ...offsets } = path;
    const out = outlineOf(offsets, stroke, opts);
    return out.coords.length === 0 ? out : { ...out, origin };
  }
  const width = resolveStrokeWidth(stroke.width ?? 1, opts.scale ?? 1);
  if (!(width > 0)) return EMPTY;
  const tolerance = opts.flattenTolerance;
  const sized: Stroke = { ...stroke, width };
  const insets = strokeInsets(sized, width);
  const align = stroke.align ?? 'center';
  // A rect's aligned ribbon is built in place. Any other path gets a centered
  // ribbon twice as wide, cut to the side of the path it belongs on.
  const cut = align !== 'center' && path.kind !== 'rect';
  const ribbonStroke: Stroke = cut
    ? { ...sized, width: width * 2, align: 'center', vertexWidths: stroke.vertexWidths?.map((w) => scaleVertexWidth(w, 2)) }
    : sized;
  const mesh = tessellateStroke(path, ribbonStroke, {
    flattenTolerance: tolerance, startInset: insets.start, endInset: insets.end,
  });
  let ribbon = trianglesToPath(mesh.vertices, mesh.indices);
  if (cut) ribbon = align === 'inner' ? pathIntersect(ribbon, path) : pathSubtract(ribbon, path);

  const heads: PolygonPath[] = [];
  for (const { entry, path: head, size } of markerHeads(path, sized, width, tolerance)) {
    if ((entry.fill ?? 'line') !== 'none') heads.push(head);
    if (entry.outline && (entry.outline.paint ?? 'line') !== 'none') {
      heads.push(strokeToPath(head, { width: entry.outline.width * size, cap: 'round', join: 'round' }, opts));
    }
  }
  return heads.length === 0 ? ribbon : pathUnion(ribbon, ...heads);
}
