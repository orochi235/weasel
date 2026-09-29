import type { Guide } from '../types';
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
} from './types';
import { MOVE_ANCHORS, matchAlignment } from './match';

/** Options for move and resize — adds the pose descriptor for non-rect poses. */
export interface AlignMoveArgs<TPose> extends AlignmentBehaviorBase {
  poseDescriptor?: PoseDescriptor<TPose>;
}

const activeList = (m: { activeX: Guide | null; activeY: Guide | null }): Guide[] =>
  [m.activeX, m.activeY].filter((g): g is Guide => g !== null);

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
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
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
      const m = matchAlignment(union, args.getCandidates(), worldTol(args, ctx), MOVE_ANCHORS);
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }
      args.setActiveGuides(activeList(m));
      return { transform: { kind: 'translate', dx: transform.dx + m.dx, dy: transform.dy + m.dy } };
    },
    onEnd() { args.setActiveGuides([]); },
    onCancel() { args.setActiveGuides([]); },
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
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
      const origin = ctx.origin.get(ctx.draggedIds[0]);
      const rotation = origin === undefined ? 0 : (d.getRotation?.(origin) ?? 0);
      const m = rotation === 0
        ? matchMovingEdges(pose, anchor, args.getCandidates(), worldTol(args, ctx))
        : matchRotatedCorners(pose, anchor, d.getBounds(origin!), rotation, args.getCandidates(), worldTol(args, ctx));
      if (m === null) { args.setActiveGuides([]); return; }

      let { x, y, width, height } = pose;
      if (anchor.x === 'min') width += m.lx;
      else if (anchor.x === 'max') { x += m.lx; width -= m.lx; }
      if (anchor.y === 'min') height += m.ly;
      else if (anchor.y === 'max') { y += m.ly; height -= m.ly; }
      args.setActiveGuides(m.guides);
      return { pose: { ...pose, x, y, width, height } };
    },
    onEnd() { args.setActiveGuides([]); },
    onCancel() { args.setActiveGuides([]); },
  };
}

/** How far to move the dragged corner in the node's local frame, and the
 *  lines that asked for it. */
interface CornerShift { lx: number; ly: number; guides: Guide[] }

function matchMovingEdges(
  pose: Bounds,
  anchor: ResizeAnchor,
  candidates: readonly Guide[],
  tol: { x: number; y: number },
): CornerShift | null {
  // A 'min' anchor pins the west/north edge, so the max edge moves.
  const movingX: AlignAnchor[] = anchor.x === 'min' ? ['max'] : anchor.x === 'max' ? ['min'] : [];
  const movingY: AlignAnchor[] = anchor.y === 'min' ? ['max'] : anchor.y === 'max' ? ['min'] : [];
  const m = matchAlignment(pose, candidates, tol, { x: movingX, y: movingY });
  if (m.activeX === null && m.activeY === null) return null;
  return { lx: m.dx, ly: m.dy, guides: activeList(m) };
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
    return { lx, ly, guides: activeList(m) };
  }
  if (anchor.x === 'free' && anchor.y === 'free') return null;

  // An edge handle moves along one local axis, carrying two corners with it.
  const along: 'x' | 'y' = anchor.x === 'free' ? 'y' : 'x';
  const dir = along === 'x' ? toWorld(1, 0) : toWorld(0, 1);
  const edge = movingEdge(along)[0];
  let best: { t: number; guide: Guide } | null = null;
  for (const across of movingEdge(along === 'x' ? 'y' : 'x')) {
    const c = along === 'x' ? drawn(edge, across) : drawn(across, edge);
    for (const g of candidates) {
      const reach = g.axis === 'x' ? dir.x : dir.y;
      if (Math.abs(reach) < 1e-9) continue;
      const t = (g.offset - (g.axis === 'x' ? c.x : c.y)) / reach;
      if (Math.abs(t * dir.x) > tol.x || Math.abs(t * dir.y) > tol.y) continue;
      if (best === null || Math.abs(t) < Math.abs(best.t)) best = { t, guide: g };
    }
  }
  if (best === null) return null;
  return along === 'x'
    ? { lx: best.t, ly: 0, guides: [best.guide] }
    : { lx: 0, ly: best.t, guides: [best.guide] };
}
