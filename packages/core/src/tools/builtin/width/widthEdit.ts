/**
 * What the width tool reads and writes: the stroke under a point, the anchor
 * a press takes hold of — inserting one where the press falls between two —
 * and the per-vertex widths a drag leaves behind.
 */
import {
  editAnchorSetTracked, insertAnchorOnSegment, nearestSegmentT, pathDistanceToPoint, pathToAnchors,
  type PolygonPath,
} from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { resolveStrokeWidth, widestStrokeWidth } from '@weasel-js/stroke';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { resolveEditablePathOf } from 'features/paths/editablePath';
import { withPath } from 'interactions/actions/pathCommands/pathNodes';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;
type Point = { x: number; y: number };

/** A stroked path node and its centerline in world space. */
export interface WidthTarget {
  id: NodeId;
  node: AnyNode;
  path: PolygonPath;
  stroke: Stroke;
}

/**
 * The anchor a press took hold of, on a node's geometry as the press leaves
 * it: `path` gained an anchor at `index` when the press fell between two.
 */
export interface WidthGrip {
  target: WidthTarget;
  /** The world path, with the inserted anchor if there is one. */
  path: PolygonPath;
  /** The per-vertex widths, one per anchor of `path`; `NaN` takes `stroke.width`. */
  widths: number[];
  index: number;
  at: Point;
  inserted: boolean;
}

function anchorPoints(path: PolygonPath): Point[] {
  return pathToAnchors(path).anchors.flat().map((a) => ({ x: a.x, y: a.y }));
}

/** The node's stroke, when it paints one along an editable path. */
function targetOf(scene: AnyScene, node: AnyNode): WidthTarget | null {
  if (node.kind !== 'leaf' || node.derivePath || node.derivePose || scene.isLocked(node.id)) return null;
  const stroke = (node.data as { stroke?: Stroke | null } | null)?.stroke;
  if (!stroke?.paint) return null;
  const path = resolveEditablePathOf(node);
  return path ? { id: node.id, node, path, stroke } : null;
}

/** The topmost stroke whose ink is within `reach` of `(x, y)`. `scale`
 *  resolves a `{ px }` width. */
export function widthTargetAt(scene: AnyScene, x: number, y: number, scale: number, reach: number): WidthTarget | null {
  const nodes = scene.renderOrderNodes();
  for (let i = nodes.length - 1; i >= 0; i--) {
    const target = targetOf(scene, nodes[i]);
    if (!target) continue;
    const half = widestStrokeWidth(resolveStrokeWidth(target.stroke.width ?? 1, scale), target.stroke.vertexWidths) / 2;
    if (pathDistanceToPoint(target.path, x, y) <= half + reach) return target;
  }
  return null;
}

/** `target`'s per-vertex widths, one per anchor; `NaN` where none is set. */
export function widthsOf(target: WidthTarget, count: number): number[] {
  const own = target.stroke.vertexWidths ?? [];
  return Array.from({ length: count }, (_, i) => {
    const w = own[i];
    return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : NaN;
  });
}

/** The index of `target`'s anchor within `reach` of `(x, y)`, nearest first, or -1. */
export function anchorNear(path: PolygonPath, x: number, y: number, reach: number): number {
  let best = -1;
  let bestD = reach;
  anchorPoints(path).forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * Take hold of `target` at `(x, y)`: the anchor within `reach`, or a new one
 * on the segment nearest, split so the path keeps its shape.
 */
export function gripAt(target: WidthTarget, x: number, y: number, reach: number): WidthGrip | null {
  const count = anchorPoints(target.path).length;
  const index = anchorNear(target.path, x, y, reach);
  if (index >= 0) {
    return { target, path: target.path, widths: widthsOf(target, count), index, at: anchorPoints(target.path)[index], inserted: false };
  }
  const set = pathToAnchors(target.path);
  const hit = nearestSegmentT(set.anchors, x, y, set.closed);
  if (!hit) return null;
  let inserted = -1;
  const next = editAnchorSetTracked(target.path, (s) => {
    inserted = insertAnchorOnSegment(s, hit);
    return inserted !== -1;
  });
  if (!next || inserted < 0) return null;
  const widths = widthsOf(target, count);
  widths.splice(inserted, 0, NaN);
  return { target, path: next.path, widths, index: inserted, at: anchorPoints(next.path)[inserted], inserted: true };
}

/** The node's pose and data with `grip`'s geometry and `widths`, or null
 *  when the node cannot store the geometry. All-`NaN` widths drop the list. */
export function storedWith(grip: WidthGrip, widths: readonly number[]): { pose: unknown; data: unknown } | null {
  const { node, stroke } = grip.target;
  const shaped = grip.inserted ? withPath(node, grip.path) : { pose: node.pose, data: node.data };
  if (!shaped) return null;
  const { vertexWidths: _old, ...rest } = stroke;
  void _old;
  const next: Stroke = widths.some((w) => Number.isFinite(w)) ? { ...rest, vertexWidths: [...widths] } : rest;
  return { pose: shaped.pose, data: { ...(shaped.data as object), stroke: next } };
}
