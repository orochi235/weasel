import type { Guide, SpacingGap } from '../types';
import {
  type BoundsConstraint,
  type InsertBehavior,
  type MoveBehavior,
  type ResizeAnchor,
  type Bounds,
  screenTolerance,
  unionBounds,
  type PoseDescriptor,
  translatePoseViaDescriptor,
  visualBoundsViaDescriptor,
  AUTO_POSE_DESCRIPTOR,
  fixedCornerOf,
} from '@weasel-js/core';
import type {
  AlignAnchor,
  AlignmentBehaviorBase,
  SpacingEdge,
} from './types';
import { MOVE_ANCHORS, matchAlignment, stretchSpan } from './match';
import { applyEdges, matchSpacing } from './spacing';

/** Options for move and resize — adds the pose descriptor for non-rect poses. */
export interface AlignMoveArgs<TPose> extends AlignmentBehaviorBase {
  poseDescriptor?: PoseDescriptor<TPose>;
}

const activeList = (m: { activeX: Guide | null; activeY: Guide | null }): Guide[] =>
  [m.activeX, m.activeY].filter((g): g is Guide => g !== null);

/** Tolerance for re-reading what a settled box touches exactly. */
const EXACT = { x: 1e-6, y: 1e-6 };

interface Resolved { dx: number; dy: number; guides: Guide[]; gaps: SpacingGap[] }

type Edges = { x: SpacingEdge | null; y: SpacingEdge | null };

/** Snap `b` to alignment lines and, when the caller supplies spacing targets,
 *  equal gaps; the nearer snap wins on each axis. What is published is read
 *  back off the settled box, so a line and a gap that both hold show together
 *  and each is drawn where the box ended up, not where it was dragged. */
function resolve(
  b: Bounds,
  args: AlignmentBehaviorBase,
  tol: { x: number; y: number },
  anchors: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] },
  edges: Edges,
): Resolved | null {
  const candidates = args.getCandidates();
  const m = matchAlignment(b, candidates, tol, anchors);
  const targets = args.getSpacingTargets?.();
  if (targets === undefined) {
    if (m.activeX === null && m.activeY === null) return null;
    return { dx: m.dx, dy: m.dy, guides: activeList(m), gaps: [] };
  }
  const s = matchSpacing(b, targets, tol, edges);
  const pick = (hit: boolean, d: number, spaced: boolean, sd: number): number | null =>
    hit && (!spaced || Math.abs(d) <= Math.abs(sd)) ? d : spaced ? sd : null;
  const dx = pick(m.activeX !== null, m.dx, s.gapsX.length > 0, s.dx);
  const dy = pick(m.activeY !== null, m.dy, s.gapsY.length > 0, s.dy);
  if (dx === null && dy === null) return null;
  const settled = applyEdges(b, dx ?? 0, dy ?? 0, edges);
  const shown = matchSpacing(settled, targets, EXACT, edges);
  return {
    dx: dx ?? 0,
    dy: dy ?? 0,
    guides: activeList(matchAlignment(settled, candidates, EXACT, anchors)),
    gaps: [...shown.gapsX, ...shown.gapsY],
  };
}

function publish(args: AlignmentBehaviorBase, r: Resolved | null): void {
  args.setActiveGuides(r?.guides ?? []);
  args.setActiveGaps?.(r?.gaps ?? []);
}

function worldTol(
  base: AlignmentBehaviorBase,
  ctx: Parameters<typeof screenTolerance>[1],
): { x: number; y: number } {
  return screenTolerance(base.tolerance ?? 6, ctx);
}

/** Move behavior: snap the dragged selection's union box (edges + center) to
 *  candidates, shaping the proposed translate. The gesture applies the
 *  transform uniformly to every dragged id, so the selection shifts together
 *  and stays rigid. Single-select is the degenerate one-box union. Publishes
 *  the matched line(s); clears on miss, end and cancel. */
export function alignMoveBehavior<TPose>(args: AlignMoveArgs<TPose>): MoveBehavior<TPose> {
  const d = (args.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  return {
    onMove(ctx, transform) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { publish(args, null); return; }
      if (transform.kind !== 'translate') return;
      // Union of every dragged id's visual box at its proposed position.
      const boxes: Bounds[] = [];
      for (const id of ctx.draggedIds) {
        const originPose = ctx.origin.get(id);
        if (originPose === undefined) continue;
        boxes.push(visualBoundsViaDescriptor(
          translatePoseViaDescriptor(originPose, transform.dx, transform.dy, d),
          d,
        ));
      }
      const union = unionBounds(boxes);
      if (union === null) return;
      const r = resolve(union, args, worldTol(args, ctx), MOVE_ANCHORS, { x: 'both', y: 'both' });
      publish(args, r);
      if (r === null) return;
      return { transform: { kind: 'translate', dx: transform.dx + r.dx, dy: transform.dy + r.dy } };
    },
    onEnd() { publish(args, null); },
    onCancel() { publish(args, null); },
  };
}

/** Insert behavior: snap the live `current` point to candidates (treating it
 *  as a zero-size box). Publishes the matched line(s). */
export function alignInsertBehavior<TPose>(args: AlignmentBehaviorBase): InsertBehavior<TPose> {
  const pointAnchors: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] } = { x: ['min'], y: ['min'] };
  return {
    onMove(ctx, { current }) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
      const box = { x: current.x, y: current.y, width: 0, height: 0 };
      const m = matchAlignment(box, args.getCandidates(), worldTol(args, ctx), pointAnchors);
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }
      args.setActiveGuides(activeList(m));
      return { current: { x: current.x + m.dx, y: current.y + m.dy } };
    },
    onEnd() { args.setActiveGuides([]); },
    onCancel() { args.setActiveGuides([]); },
  };
}

/** Resize constraint: snap the corner(s) the drag moves, as drawn, to
 *  candidates; the pinned corner stays fixed. On an unrotated pose that is
 *  the moving edge(s). On a rotated one the node's own axes set how the
 *  corner can travel: a corner handle snaps each world axis, an edge handle
 *  slides its edge until the nearer of its two corners meets a line.
 *  `poseDescriptor` reads the origin pose's box and rotation, and must match
 *  the resize action's. Publishes the matched line(s). */
export function alignResizeBehavior<TPose extends Bounds>(
  args: AlignMoveArgs<TPose>,
): BoundsConstraint<TPose> {
  const d = (args.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  return {
    onMove(ctx, { pose, anchor }) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { publish(args, null); return; }
      const origin = ctx.origin.get(ctx.draggedIds[0]);
      const rotation = origin === undefined ? 0 : (d.getRotation?.(origin) ?? 0);
      const m = rotation === 0
        ? matchMovingEdges(pose, anchor, args, worldTol(args, ctx))
        : matchRotatedCorners(pose, anchor, d.getBounds(origin!), rotation, args.getCandidates(), worldTol(args, ctx));
      if (m === null) { publish(args, null); return; }

      let { x, y, width, height } = pose;
      if (anchor.x === 'min') width += m.lx;
      else if (anchor.x === 'max') { x += m.lx; width -= m.lx; }
      if (anchor.y === 'min') height += m.ly;
      else if (anchor.y === 'max') { y += m.ly; height -= m.ly; }
      publish(args, { dx: 0, dy: 0, guides: m.guides, gaps: m.gaps });
      return { pose: { ...pose, x, y, width, height } };
    },
    onEnd() { publish(args, null); },
    onCancel() { publish(args, null); },
  };
}

/** How far to move the dragged corner in the node's local frame, and the
 *  lines that asked for it. */
interface CornerShift { lx: number; ly: number; guides: Guide[]; gaps: SpacingGap[] }

function matchMovingEdges(
  pose: Bounds,
  anchor: ResizeAnchor,
  args: AlignmentBehaviorBase,
  tol: { x: number; y: number },
): CornerShift | null {
  // A 'min' anchor pins the west/north edge, so the max edge moves.
  const moving = (a: ResizeAnchor['x']): SpacingEdge | null => (a === 'min' ? 'max' : a === 'max' ? 'min' : null);
  const edges = { x: moving(anchor.x), y: moving(anchor.y) };
  const anchors = {
    x: edges.x === null ? [] : [edges.x],
    y: edges.y === null ? [] : [edges.y],
  } as { x: AlignAnchor[]; y: AlignAnchor[] };
  const r = resolve(pose, args, tol, anchors, edges);
  return r === null ? null : { lx: r.dx, ly: r.dy, guides: r.guides, gaps: r.gaps };
}

/** The rotated case. The resize action pins the fixed corner in world after
 *  constraints run, so a corner's drawn position is the origin's fixed corner
 *  plus the rotated offset to it within `pose`. */
function matchRotatedCorners(
  pose: Bounds,
  anchor: ResizeAnchor,
  originBox: Bounds,
  rotation: number,
  candidates: readonly Guide[],
  tol: { x: number; y: number },
): CornerShift | null {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const toWorld = (lx: number, ly: number) => ({ x: lx * cos - ly * sin, y: lx * sin + ly * cos });
  const fixedLocal = fixedCornerOf(pose, anchor);
  const f0 = fixedCornerOf(originBox, anchor);
  const pivot = toWorld(f0.x - originBox.x - originBox.width / 2, f0.y - originBox.y - originBox.height / 2);
  const fixedWorld = { x: originBox.x + originBox.width / 2 + pivot.x, y: originBox.y + originBox.height / 2 + pivot.y };
  const drawn = (lx: number, ly: number) => {
    const o = toWorld(lx - fixedLocal.x, ly - fixedLocal.y);
    return { x: fixedWorld.x + o.x, y: fixedWorld.y + o.y };
  };
  const movingEdge = (axis: 'x' | 'y'): number[] => {
    const lo = axis === 'x' ? pose.x : pose.y;
    const hi = lo + (axis === 'x' ? pose.width : pose.height);
    const a = anchor[axis];
    return a === 'min' ? [hi] : a === 'max' ? [lo] : [lo, hi];
  };

  if (anchor.x !== 'free' && anchor.y !== 'free') {
    // A corner handle's corner has two degrees of freedom: snap it as a point.
    const c = drawn(movingEdge('x')[0], movingEdge('y')[0]);
    const m = matchAlignment({ x: c.x, y: c.y, width: 0, height: 0 }, candidates, tol, { x: ['min'], y: ['min'] });
    if (m.activeX === null && m.activeY === null) return null;
    const lx = m.dx * cos + m.dy * sin;
    const ly = -m.dx * sin + m.dy * cos;
    return { lx, ly, guides: activeList(m), gaps: [] };
  }
  if (anchor.x === 'free' && anchor.y === 'free') return null;

  // An edge handle moves along one local axis, carrying two corners with it.
  const along: 'x' | 'y' = anchor.x === 'free' ? 'y' : 'x';
  const dir = along === 'x' ? toWorld(1, 0) : toWorld(0, 1);
  const edge = movingEdge(along)[0];
  let best: { t: number; guide: Guide; at: { x: number; y: number } } | null = null;
  for (const across of movingEdge(along === 'x' ? 'y' : 'x')) {
    const c = along === 'x' ? drawn(edge, across) : drawn(across, edge);
    for (const g of candidates) {
      const reach = g.axis === 'x' ? dir.x : dir.y;
      if (Math.abs(reach) < 1e-9) continue;
      const t = (g.offset - (g.axis === 'x' ? c.x : c.y)) / reach;
      if (Math.abs(t * dir.x) > tol.x || Math.abs(t * dir.y) > tol.y) continue;
      if (best === null || Math.abs(t) < Math.abs(best.t)) best = { t, guide: g, at: c };
    }
  }
  if (best === null) return null;
  const across = best.guide.axis === 'x' ? best.at.y + best.t * dir.y : best.at.x + best.t * dir.x;
  const guides = [stretchSpan(best.guide, across, across)!];
  return along === 'x'
    ? { lx: best.t, ly: 0, guides, gaps: [] }
    : { lx: 0, ly: best.t, guides, gaps: [] };
}
