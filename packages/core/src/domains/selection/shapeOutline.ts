/**
 * Selection outlines that follow a node's shape rather than its box.
 *
 * The outline is a world-space path stroked outward at a fixed screen width,
 * so the view transform carries it through pan and zoom without rebuilding
 * it. It starts at the node's drawn edge: the silhouette, grown past the
 * node's own stroke when it has one.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import { viewToMat3 } from '@weasel-js/renderer';
import {
  boxToBox, identity, invert, meanScale, multiply, pathToAnchors, poseFrameOf, transformPath, type Affine, type Path,
} from '@weasel-js/geom';
import { offsetPath, strokeToPath } from '@weasel-js/stroke';
import type { CommandStroke, Stroke } from '@weasel-js/paint';
import type { NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { inheritedPaintIn } from 'core/scene/inheritedPaint';
import { findShapeInk } from 'canvas/NodeShape';
import { nodeOutline } from 'domains/paths/strokeOutline';
import { strokeRegion } from 'domains/paths/strokeRegion';
import type { DrawnBoundsScene } from 'canvas/drawnBounds';

/** How a shape outline reads one node each frame. */
export interface ShapeOutlineReads {
  scene: DrawnBoundsScene;
  /** Where the node is drawn this frame, in-flight preview included. */
  poseOf: (id: string) => unknown;
  /** True while a gesture previews `id` somewhere other than its committed pose. */
  inFlight: (id: string) => boolean;
}

interface Edge {
  /** What the edge was built from: the silhouette, or the derived path that stands in for the pose. */
  key: Path;
  pose: unknown;
  distance: number;
  edge: Path;
}

/**
 * A per-layer builder of shape outlines. It keeps each outlined node's drawn
 * edge between frames: growing a curved silhouette past its stroke costs
 * milliseconds, so it is rebuilt only when the shape or the stroke's reach
 * changes, and a node in flight reuses its committed edge, carried by the
 * move from the committed box to the previewed one.
 */
export function createShapeOutliner(): {
  /** World-space paths to stroke, and the ids that have no shape to follow. */
  outline(ids: readonly string[], reads: ShapeOutlineReads, scale: number): { paths: Path[]; boxed: string[] };
} {
  const edges = new Map<string, Edge>();
  return {
    outline(ids, reads, scale) {
      const paths: Path[] = [];
      const boxed: string[] = [];
      for (const id of ids) {
        const edge = edgeOf(id, reads, scale, edges);
        if (edge) paths.push(edge);
        else boxed.push(id);
      }
      if (edges.size > ids.length) {
        const live = new Set(ids);
        for (const id of edges.keys()) if (!live.has(id)) edges.delete(id);
      }
      return { paths, boxed };
    },
  };
}

function edgeOf(id: string, reads: ShapeOutlineReads, scale: number, edges: Map<string, Edge>): Path | null {
  const { scene } = reads;
  const node = scene.get(id as NodeId);
  if (!node || node.kind === 'group' || (scene.childrenOf?.(id as NodeId).length ?? 0) > 0) return null;
  const pose = reads.poseOf(id);
  const derivedPath = scene.derivedPathOf?.(id as NodeId) ?? null;
  const silhouette = nodeOutline(node, pose, derivedPath ? { derivedPath } : undefined);
  if (!silhouette) return null;
  const inherited = inheritedPaintIn(scene, node);
  const ink = findShapeInk(node, pose, { scale, ...(inherited === undefined ? {} : { inherited }) });
  const distance = (ink?.outset ?? 0) + (ink?.outsetPx ?? 0) / scale;
  const open = isOpen(silhouette);
  if (open && distance <= 0) return null;
  if (distance <= 0) {
    edges.delete(id);
    return silhouette;
  }
  const key = derivedPath ?? silhouette;
  const held = edges.get(id);
  if (held && held.key === key && held.distance === distance) return held.edge;
  if (held && held.distance === distance && reads.inFlight(id)) {
    const carry = boxMove(held.pose, pose);
    if (carry) return transformPath(held.edge, carry);
  }
  const edge = open ? inkBand(silhouette, ink?.stroke, pose, distance, scale) : offsetPath(silhouette, distance);
  if (edge.kind === 'polygon' && edge.commands.length === 0) return null;
  edges.set(id, { key, pose, distance, edge });
  return edge;
}

/**
 * The region an open path's ink covers: its stroke's ribbon, caps and heads
 * and all, unbroken by any dash; a band reaching `distance` either side when
 * the painter does not say what stroke it draws.
 */
function inkBand(path: Path, stroke: Stroke | undefined, pose: unknown, distance: number, scale: number): Path {
  if (stroke === undefined) return strokeToPath(path, { width: distance * 2, join: 'round', cap: 'round' });
  const { dash: _dash, ...unbroken } = stroke;
  return strokeRegion(path, unbroken, poseFrameOf(pose), { scale });
}

/** An open run encloses nothing, so its edge is the region its ink covers. */
function isOpen(path: Path): boolean {
  return path.kind !== 'rect' && !pathToAnchors(path).closed.every(Boolean);
}

/** The map taking a box pose's drawing onto another box pose's, or `null` when either is not a box. */
function boxMove(from: unknown, to: unknown): Affine | null {
  const a = from as { x?: number; y?: number; width?: number; height?: number } | null;
  const b = to as { x?: number; y?: number; width?: number; height?: number } | null;
  if (a?.x == null || a.y == null || a.width == null || a.height == null) return null;
  if (b?.x == null || b.y == null || b.width == null || b.height == null) return null;
  const unframe = invert(poseFrameOf(from) ?? identity());
  if (!unframe) return null;
  const box = boxToBox(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height);
  return multiply(poseFrameOf(to) ?? identity(), multiply(box, unframe));
}

/** Screen-space commands stroking `paths` outward at `stroke`'s width in screen pixels. */
export function shapeOutlineCommands(paths: readonly Path[], stroke: CommandStroke, view: View): DrawCommand[] {
  if (paths.length === 0) return [];
  const w = stroke.width ?? 1;
  const ribbon: CommandStroke = {
    ...stroke,
    width: typeof w === 'number' ? { px: w } : w,
    align: stroke.align ?? 'outer',
  };
  return [{
    kind: 'group',
    transform: viewToMat3(view),
    children: paths.map((path) => ({ kind: 'path', path, stroke: ribbon })),
  }];
}

/** The view's mean scale, which a `{ px }` stroke reach is resolved at. */
export function viewScaleOf(view: View): number {
  return meanScale(view.scale);
}
