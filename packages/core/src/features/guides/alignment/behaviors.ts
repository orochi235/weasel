import type { Guide } from '../types';
import type {
  BoundsConstraint,
  InsertBehavior,
  MoveBehavior,
  ResizePose,
} from 'interactions/gestures/types';
import { meanScale } from 'core/viewport/meanScale';
import { unionBounds } from 'features/groups/unionBounds';
import type {
  AlignAnchor,
  AlignBounds,
  AlignBoundsProjection,
  AlignmentBehaviorBase,
} from './types';
import { MOVE_ANCHORS, RECT_ALIGN_PROJECTION, matchAlignment } from './match';

/** Options for move/insert — adds the bounds projection for non-rect poses. */
export interface AlignMoveArgs<TPose> extends AlignmentBehaviorBase {
  projection?: AlignBoundsProjection<TPose>;
}

const activeList = (m: { activeX: Guide | null; activeY: Guide | null }): Guide[] =>
  [m.activeX, m.activeY].filter((g): g is Guide => g !== null);

function worldTol(base: AlignmentBehaviorBase): number {
  const t = base.tolerance ?? 6;
  return base.getView ? t / Math.max(1e-9, meanScale(base.getView().scale)) : t;
}

/** Move behavior: snap the dragged selection's union box (edges + center) to
 *  candidates, shaping the proposed translate. The gesture applies the
 *  transform uniformly to every dragged id, so the selection shifts together
 *  and stays rigid. Single-select is the degenerate one-box union. Publishes
 *  the matched line(s); clears on miss/end. */
export function alignMoveBehavior<TPose>(args: AlignMoveArgs<TPose>): MoveBehavior<TPose> {
  const proj = args.projection ?? (RECT_ALIGN_PROJECTION as unknown as AlignBoundsProjection<TPose>);
  return {
    onMove(ctx, transform) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
      if (transform.kind !== 'translate') return;
      // Union AABB of every dragged id at its proposed (translated) position.
      const boxes: AlignBounds[] = [];
      for (const id of ctx.draggedIds) {
        const originPose = ctx.origin.get(id);
        if (originPose === undefined) continue;
        boxes.push(proj.boundsOf(proj.translate(originPose, transform.dx, transform.dy)));
      }
      const union = unionBounds(boxes);
      if (union === null) return;
      const m = matchAlignment(union, args.getCandidates(), worldTol(args), MOVE_ANCHORS);
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }
      args.setActiveGuides(activeList(m));
      return { transform: { kind: 'translate', dx: transform.dx + m.dx, dy: transform.dy + m.dy } };
    },
    onEnd() { args.setActiveGuides([]); },
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
      const m = matchAlignment(box, args.getCandidates(), worldTol(args), pointAnchors);
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }
      args.setActiveGuides(activeList(m));
      return { current: { x: current.x + m.dx, y: current.y + m.dy } };
    },
    onEnd() { args.setActiveGuides([]); },
  };
}

/** Resize constraint: snap the moving edge(s) of the dragged rect to
 *  candidates. The pinned (anchor) edge stays fixed. Publishes the line(s). */
export function alignResizeBehavior<TPose extends ResizePose>(
  args: AlignmentBehaviorBase,
): BoundsConstraint<TPose> {
  return {
    onMove(ctx, { pose, anchor }) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
      // Moving edge per axis: 'min' anchor pins the west/north edge so the
      // east/south (max) edge moves, and vice versa.
      const movingX: AlignAnchor[] = anchor.x === 'min' ? ['max'] : anchor.x === 'max' ? ['min'] : [];
      const movingY: AlignAnchor[] = anchor.y === 'min' ? ['max'] : anchor.y === 'max' ? ['min'] : [];
      const m = matchAlignment(pose, args.getCandidates(), worldTol(args), { x: movingX, y: movingY });
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }

      let { x, y, width, height } = pose;
      if (m.activeX !== null) {
        if (anchor.x === 'min') { width += m.dx; } else { x += m.dx; width -= m.dx; }
      }
      if (m.activeY !== null) {
        if (anchor.y === 'min') { height += m.dy; } else { y += m.dy; height -= m.dy; }
      }
      args.setActiveGuides(activeList(m));
      return { pose: { ...pose, x, y, width, height } };
    },
    onEnd() { args.setActiveGuides([]); },
  };
}
