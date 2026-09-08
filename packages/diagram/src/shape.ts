/**
 * The painter for a node whose trait names an `outline`.
 *
 * Registered the way every other trait's renderer is — a `NodeShapeEntry` with
 * a `matches` over the node's data — so a diagram body is picked, clipped and
 * area-selected by the same walk as everything else, and a participant that
 * already had a look of its own (a text block, an image, a path) keeps it by
 * naming no outline at all.
 *
 * Rows are **not** painted here. A built body's rows are ordinary scene nodes
 * under the container, so the kit's own text painter draws them and text
 * editing, selection and styling work on them without a special case.
 */
import {
  RECT_POSE_DESCRIPTOR,
  registerNodeShape,
  type FillStyle,
  type NodeShapeEntry,
  type PoseProjection,
  type Stroke,
} from '@weasel-js/core';
import { outlinePath } from './outline';
import { diagramNodeOf, type DiagramNodeReader } from './trait';

export interface DiagramShapeOptions<TPose> {
  /** Distinguishes one registration from another, and is what the disposer
   *  removes. Default `'diagram:outline'`. */
  id?: string;
  /** How the trait is read. Default: the node's own `data.diagram`. */
  read?: DiagramNodeReader;
  /** Reads the box the outline is built in. Default `RECT_POSE_DESCRIPTOR`. */
  geometry?: PoseProjection<TPose>;
  /** Painted when the node's data declares neither. */
  defaultFill?: FillStyle | null;
  defaultStroke?: Stroke | null;
}

/** The entry, for a consumer composing their own painter list. */
export function diagramShape<TPose>(
  opts: DiagramShapeOptions<TPose> = {},
): NodeShapeEntry<unknown, TPose> {
  const geometry = opts.geometry ?? (RECT_POSE_DESCRIPTOR as PoseProjection<TPose>);
  const outlineOf = (node: { id: string; kind: 'leaf' | 'container'; data: unknown }) =>
    diagramNodeOf(node, opts.read)?.outline;

  return {
    id: opts.id ?? 'diagram:outline',
    matches: (node) => outlineOf(node) !== undefined,
    paint: (node, pose) => {
      const outline = outlineOf(node);
      if (outline === undefined) return [];
      const d = node.data as { fill?: FillStyle | null; stroke?: Stroke | null };
      const fill = d.fill === undefined ? opts.defaultFill : d.fill;
      const stroke = d.stroke === undefined ? opts.defaultStroke : d.stroke;
      return [{
        kind: 'path',
        path: outlinePath(outline, geometry.getBounds(pose)),
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      }];
    },
    // The drawn boundary, so picking and clipping follow the diamond rather
    // than its bounding box.
    silhouette: (node, pose) => {
      const outline = outlineOf(node);
      return outline === undefined ? null : outlinePath(outline, geometry.getBounds(pose));
    },
  };
}

/**
 * Register {@link diagramShape}. Returns the disposer, and takes `'high'`
 * priority so a body outline wins over a `data.shape` or `data.path` the same
 * node may also carry.
 */
export function registerDiagramShape<TPose>(opts: DiagramShapeOptions<TPose> = {}): () => void {
  return registerNodeShape(diagramShape(opts), { priority: 'high' });
}
