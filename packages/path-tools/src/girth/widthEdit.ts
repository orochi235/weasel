/**
 * What the Girth tool reads and writes: the stroke edge under a point, the
 * width point a press on it moves — inserting an anchor where the press falls
 * between two — and the per-vertex widths a drag leaves behind.
 */
import {
  editAnchorSetTracked, insertAnchorOnSegment, nearestSegmentT, pathToAnchors, type PolygonPath,
} from '@weasel-js/geom';
import {
  type HalfWidths, type Stroke, type VertexWidth, vertexHalfWidths, vertexWidthFromSides,
} from '@weasel-js/paint';
import { resolveStrokeWidth, strokeEdgeNear, type StrokeEdgeHit, type StrokeSide } from '@weasel-js/stroke';
import { resolveEditablePathOf, withPath, type NodeId, type Scene, type SceneNode } from '@weasel-js/core';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = SceneNode<unknown, string, unknown>;
type Point = { x: number; y: number };

/** A stroked path node and its centerline in world space. */
export interface WidthTarget {
  id: NodeId;
  node: AnyNode;
  path: PolygonPath;
  stroke: Stroke;
  /** The stroke's own width in world units: what an unset entry takes. */
  fallback: number;
}

/** A stroke edge found under a point, and the width point a press there
 *  moves: anchor `index`, or one inserted at `at` when `index` is null. */
export interface WidthEdgeHit {
  target: WidthTarget;
  edge: StrokeEdgeHit;
  index: number | null;
  at: Point;
}

/**
 * The width point a drag edits, on a node's geometry as the press leaves it:
 * `path` gained an anchor at `index` when the press fell between two.
 */
export interface WidthGrip {
  target: WidthTarget;
  /** The world path, with the inserted anchor if there is one. */
  path: PolygonPath;
  /** One entry per anchor of `path`; `NaN` takes the stroke's own width. */
  widths: VertexWidth[];
  index: number;
  at: Point;
  inserted: boolean;
  /** The edge taken hold of, and the unit normal it moves along. */
  side: StrokeSide;
  normal: Point;
  /** Each edge's distance from the path at the width point, before the drag. */
  start: HalfWidths;
  /** What the nib multiplies a stored width by there, so a drag moves the
   *  edge as drawn. */
  factor: number;
}

function anchorPoints(path: PolygonPath): Point[] {
  return pathToAnchors(path).anchors.flat().map((a) => ({ x: a.x, y: a.y }));
}

/** Whether `entry` gives either edge a distance of its own. */
export function isWidthSet(entry: VertexWidth | undefined): boolean {
  const { left, right } = vertexHalfWidths(entry, NaN);
  return !Number.isNaN(left) || !Number.isNaN(right);
}

/** The node's stroke, when it paints one along an editable path. */
function targetOf(scene: AnyScene, node: AnyNode, scale: number): WidthTarget | null {
  if (node.kind !== 'leaf' || node.derivePath || node.derivePose || scene.isLocked(node.id) || scene.isHidden(node.id)) return null;
  const stroke = (node.data as { stroke?: Stroke | null } | null)?.stroke;
  if (!stroke?.paint) return null;
  const path = resolveEditablePathOf(node);
  return path ? { id: node.id, node, path, stroke, fallback: resolveStrokeWidth(stroke.width ?? 1, scale) } : null;
}

/** The topmost stroke, and its edge nearest `(x, y)`, that `accept` takes.
 *  `scale` resolves a `{ px }` width. */
function edgeAt(
  scene: AnyScene, x: number, y: number, scale: number, accept: (edge: StrokeEdgeHit) => boolean,
): { target: WidthTarget; edge: StrokeEdgeHit } | null {
  const nodes = scene.renderOrderNodes();
  for (let i = nodes.length - 1; i >= 0; i--) {
    const target = targetOf(scene, nodes[i], scale);
    if (!target) continue;
    const edge = strokeEdgeNear(target.path, target.stroke, x, y, { scale });
    if (edge && accept(edge)) return { target, edge };
  }
  return null;
}

/** The topmost stroke whose ink is within `reach` of `(x, y)`. */
export function widthTargetAt(scene: AnyScene, x: number, y: number, scale: number, reach: number): WidthTarget | null {
  return edgeAt(scene, x, y, scale, (edge) => edge.gap <= reach)?.target ?? null;
}

/** The topmost stroke edge within `reach` of `(x, y)`, and the width point a
 *  press there moves: the anchor within `reach` along the path, or a new one. */
export function widthEdgeAt(scene: AnyScene, x: number, y: number, scale: number, reach: number): WidthEdgeHit | null {
  const found = edgeAt(scene, x, y, scale, (edge) => Math.abs(edge.gap) <= reach);
  if (!found) return null;
  const { edge } = found;
  let index: number | null = null;
  let bestD = reach;
  const anchors = anchorPoints(found.target.path);
  anchors.forEach((p, i) => {
    const d = Math.hypot(p.x - edge.x, p.y - edge.y);
    if (d <= bestD) { bestD = d; index = i; }
  });
  return { ...found, index, at: index === null ? { x: edge.x, y: edge.y } : anchors[index] };
}

/** `target`'s per-vertex widths, one per anchor; `NaN` where none is set. */
export function widthsOf(target: WidthTarget, count: number): VertexWidth[] {
  const own = target.stroke.vertexWidths ?? [];
  return Array.from({ length: count }, (_, i) => (isWidthSet(own[i]) ? own[i] : NaN));
}

/** Each anchor's unit normal toward its right edge, from the directions the
 *  path leaves and enters it by. */
export function anchorNormals(path: PolygonPath): Point[] {
  const set = pathToAnchors(path);
  return set.anchors.flatMap((sub, s) => sub.map((a, i) => {
    const closed = set.closed?.[s] ?? false;
    const next = sub[i + 1] ?? (closed ? sub[0] : undefined);
    const prev = sub[i - 1] ?? (closed ? sub[sub.length - 1] : undefined);
    const out = a.outHandle ?? next;
    const inn = a.inHandle ?? prev;
    let tx = 0, ty = 0;
    for (const [from, to] of [[a, out], [inn, a]] as const) {
      if (!from || !to) continue;
      const len = Math.hypot(to.x - from.x, to.y - from.y);
      if (len > 0) { tx += (to.x - from.x) / len; ty += (to.y - from.y) / len; }
    }
    const len = Math.hypot(tx, ty);
    return len > 0 ? { x: -ty / len, y: tx / len } : { x: 0, y: 1 };
  }));
}

/** The index of the set width point whose line across the stroke passes
 *  within `reach` of `(x, y)`, nearest first, or -1. */
export function widthPointNear(target: WidthTarget, x: number, y: number, reach: number): number {
  const anchors = anchorPoints(target.path);
  const normals = anchorNormals(target.path);
  const widths = widthsOf(target, anchors.length);
  let best = -1;
  let bestD = reach;
  anchors.forEach((a, i) => {
    if (!isWidthSet(widths[i])) return;
    const { left, right } = vertexHalfWidths(widths[i], target.fallback);
    const n = normals[i];
    // Along the normal, clamped to the line from the left edge to the right.
    const along = Math.min(right, Math.max(-left, (x - a.x) * n.x + (y - a.y) * n.y));
    const d = Math.hypot(x - (a.x + n.x * along), y - (a.y + n.y * along));
    if (d <= bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Take hold of the width point `hit` names, inserting its anchor — the
 *  path's shape and the stroke's width there both kept — when it is new. */
export function gripAt(hit: WidthEdgeHit): WidthGrip | null {
  const { target, edge } = hit;
  const count = anchorPoints(target.path).length;
  const widths = widthsOf(target, count);
  const factor = edge.factor > 0.05 ? edge.factor : 1;
  const base = { target, side: edge.side, normal: { x: edge.nx, y: edge.ny }, factor };
  if (hit.index !== null) {
    const start = vertexHalfWidths(widths[hit.index], target.fallback);
    return { ...base, path: target.path, widths, index: hit.index, at: hit.at, inserted: false, start };
  }
  const set = pathToAnchors(target.path);
  const seg = nearestSegmentT(set.anchors, edge.x, edge.y, set.closed);
  if (!seg) return null;
  let inserted = -1;
  const next = editAnchorSetTracked(target.path, (s) => {
    inserted = insertAnchorOnSegment(s, seg);
    return inserted !== -1;
  });
  if (!next || inserted < 0) return null;
  const start = { left: edge.left / factor, right: edge.right / factor };
  widths.splice(inserted, 0, widths.some(isWidthSet) ? vertexWidthFromSides(start.left, start.right) : NaN);
  return { ...base, path: next.path, widths, index: inserted, at: anchorPoints(next.path)[inserted], inserted: true, start };
}

/** The grabbed edge's distance from the path after the pointer has moved
 *  `delta` along the grip's normal, as stored: never below zero. */
export function movedSide(grip: WidthGrip, delta: number): number {
  return Math.max(0, grip.start[grip.side] + delta / grip.factor);
}

/** The width point's entry once its grabbed edge sits `moved` from the path:
 *  both edges there, or with `oneSided` only the grabbed one. */
export function draggedWidth(grip: WidthGrip, moved: number, oneSided: boolean): VertexWidth {
  if (!oneSided) return 2 * moved;
  return grip.side === 'left' ? vertexWidthFromSides(moved, grip.start.right) : vertexWidthFromSides(grip.start.left, moved);
}

/** The node's pose and data with `grip`'s geometry and `widths`, or null
 *  when the node cannot store the geometry. All-unset widths drop the list. */
export function storedWith(grip: WidthGrip, widths: readonly VertexWidth[]): { pose: unknown; data: unknown } | null {
  const { node, stroke } = grip.target;
  const shaped = grip.inserted ? withPath(node, grip.path) : { pose: node.pose, data: node.data };
  if (!shaped) return null;
  const { vertexWidths: _old, ...rest } = stroke;
  void _old;
  const next: Stroke = widths.some(isWidthSet) ? { ...rest, vertexWidths: [...widths] } : rest;
  return { pose: shaped.pose, data: { ...(shaped.data as object), stroke: next } };
}
