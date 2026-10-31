/**
 * The painter for a node whose trait names an `outline`. A participant that
 * already had a look of its own (a text block, an image, a path) keeps it by
 * naming no outline at all.
 *
 * Rows are **not** painted here. A built body's rows are ordinary scene nodes
 * under the container, so the kit's own text painter draws them.
 */
import {
  commandFill,
  commandStroke,
  polylineFromPoints,
  RECT_POSE_DESCRIPTOR,
  registerNodeShape,
  resolveFill,
  resolveStroke,
  type NodeShapeEntry,
  type Path,
  type PoseDescriptor,
  type Stroke,
  type Fill,
  type Inherit,
} from '@weasel-js/core';
import { bodyRules } from './bodyRules';
import { outlineDetail, outlinePath, type Outline } from './outline';
import { diagramContainerOf, headerBox, laneOutlineOf } from './containers/trait';
import { diagramNodeOf, type DiagramNodeReader } from './trait';
import { sequencePartOf } from './sequence/trait';

/** Options for {@link diagramShape} and {@link registerDiagramShape}. */
export interface DiagramShapeOptions<TPose> {
  /** Distinguishes one registration from another, and is what the disposer
   *  removes. Default `'diagram:outline'`. */
  id?: string;
  /** How the trait is read. Default: the node's own `data.diagram`. */
  read?: DiagramNodeReader;
  /** Reads the box the outline is built in. Default `RECT_POSE_DESCRIPTOR`. */
  geometry?: PoseDescriptor<TPose>;
}

/** The entry, for a consumer composing their own painter list. */
export function diagramShape<TPose>(
  opts: DiagramShapeOptions<TPose> = {},
): NodeShapeEntry<unknown, TPose> {
  const geometry = opts.geometry ?? (RECT_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const outlineOf = (node: { id: string; kind: 'mark' | 'group'; data: unknown }) =>
    diagramNodeOf(node, opts.read)?.outline ?? laneOutlineOf(node) ?? sequenceOutlineOf(node);

  return {
    id: opts.id ?? 'diagram:outline',
    matches: (node) => outlineOf(node) !== undefined,
    paint: (node, pose, ctx) => {
      const outline = outlineOf(node);
      if (outline === undefined) return [];
      const d = node.data as { fill?: Fill | Inherit | null; stroke?: Stroke | Inherit | null };
      const box = geometry.getBounds(pose);
      const declaredFill = resolveFill(d.fill, ctx?.inherited?.fill);
      const declaredStroke = resolveStroke(d.stroke, ctx?.inherited?.stroke);
      const fill = declaredFill && commandFill(declaredFill, box);
      const stroke = declaredStroke && commandStroke(declaredStroke, box);
      const header = headerBox(box, diagramContainerOf(node)?.header);
      const divider = header === null || !stroke ? [] : [{ kind: 'path' as const, path: dividerPath(box, header), stroke }];
      const detailPath = stroke ? outlineDetail(outline, box) : null;
      const detail = stroke && detailPath ? [{ kind: 'path' as const, path: detailPath, stroke }] : [];
      const trait = diagramNodeOf(node, opts.read);
      const rules = stroke && trait !== null ? bodyRules(trait, box).map((path) => ({ kind: 'path' as const, path, stroke })) : [];
      return [{
        kind: 'path',
        path: outlinePath(outline, box),
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      }, ...detail, ...rules, ...divider];
    },
    // The drawn boundary, so picking and clipping follow the diamond rather
    // than its bounding box.
    silhouette: (node, pose) => {
      const outline = outlineOf(node);
      return outline === undefined ? null : outlinePath(outline, geometry.getBounds(pose));
    },
  };
}

/** A sequence part's outline: its head, note, or box, which the sequence draws and no connector meets. */
function sequenceOutlineOf(node: { data: unknown }): Outline | undefined {
  if (sequencePartOf(node) === null) return undefined;
  return (node.data as { diagram?: { outline?: Outline } }).diagram?.outline;
}

type Box = { x: number; y: number; width: number; height: number };

/** The line between a container's header and its body. */
function dividerPath(box: Box, header: Box): Path {
  return header.width < box.width
    ? polylineFromPoints([{ x: header.x + header.width, y: box.y }, { x: header.x + header.width, y: box.y + box.height }])
    : polylineFromPoints([{ x: box.x, y: header.y + header.height }, { x: box.x + box.width, y: header.y + header.height }]);
}

/**
 * Register {@link diagramShape}. Returns the disposer, and takes `'high'`
 * priority so a body outline wins over a `data.shape` or `data.path` the same
 * node may also carry.
 */
export function registerDiagramShape<TPose>(opts: DiagramShapeOptions<TPose> = {}): () => void {
  return registerNodeShape(diagramShape(opts), { priority: 'high' });
}
