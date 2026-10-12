import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { translatePoseViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Target, TargetAxes } from '../target';
import type { AnimationHandle } from '../types';
import { poseKey } from '../poseHelpers';
import { clampCorner, coastKey, sameBounds, type Coast, type CoastArgs } from './coast';

interface Rider<TPose> {
  id: string;
  target: Target<TPose>;
  /** The committed pose as the coast last left it. Anything else there is another writer's. */
  seen: TPose;
  /** Null once this node has stopped. */
  handle: AnimationHandle | null;
  /** The corner and velocity its running decay started with. */
  startX: number;
  startY: number;
  vx: number;
  vy: number;
}

/** A world velocity as the rate of change of a pose at `at`. */
function poseVelocity<TPose>(
  ax: TargetAxes<TPose>,
  d: PoseDescriptor<TPose>,
  at: TPose,
  vx: number,
  vy: number,
): TPose {
  const base = ax.to(at);
  const alongX = ax.to(translatePoseViaDescriptor(at, 1, 0, d));
  const alongY = ax.to(translatePoseViaDescriptor(at, 0, 1, d));
  return ax.from(base.map((b, i) => vx * (alongX[i]! - b) + vy * (alongY[i]! - b)));
}

/**
 * A coast on each node's own pose target: a decay per node, so anything else animating the
 * node adds to it. The document keeps the pre-drag pose while the node travels, takes the
 * pose it stops at, and the flick is recorded as one transform once every node has stopped.
 */
export function coastOnTargets<TPose>(a: CoastArgs<TPose>, targets: ReadonlyMap<string, Target<TPose>>): void {
  const { animator, ctx, d, bounds, coasts } = a;
  const adapter = ctx.adapter;
  // Speed lost per unit traveled: an exponential coast's velocity is its first less this times
  // how far it has gone, which is how a node stopped at an edge knows what speed it has left.
  const drag = -Math.log(a.friction);
  const cancelKey = coastKey();
  const riders = new Map<string, Rider<TPose>>();

  const ours = (r: Rider<TPose>): boolean =>
    adapter.getNode(r.id) !== undefined && sameBounds(d.getBounds(r.target.committed()), d.getBounds(r.seen));

  const launch = (r: Rider<TPose>, from: TPose | undefined, vx: number, vy: number): void => {
    const at = from ?? r.target.committed();
    const velocity = poseVelocity(r.target.axes, d, at, vx, vy);
    const corner = d.getBounds(at);
    r.startX = corner.x;
    r.startY = corner.y;
    r.vx = vx;
    r.vy = vy;
    r.handle = animator.decay<TPose>({
      target: r.target,
      from,
      velocity,
      friction: a.friction,
      cancelKey,
      interrupt: false,
      onTick: (own) => tick(r, own),
      onDone: () => halted(r),
    });
  };

  const halted = (r: Rider<TPose>): void => {
    r.handle = null;
    r.seen = r.target.committed();
    for (const other of riders.values()) if (other.handle) return;
    commitFlick();
  };

  /**
   * Takes `r` out of the coast where another writer left its node. Where that writer is another
   * animation on the node, the node is still short of `left` by what the coast had traveled, at
   * `own`: a spring carries that to nothing from the coast's speed, joining the node's moves.
   */
  const drop = (r: Rider<TPose>, own: TPose): void => {
    const left = r.target.committed();
    riders.delete(r.id);
    r.handle?.cancel();
    r.target.commit(left);
    if (r.target.active && adapter.getNode(r.id) !== undefined) {
      const moved = d.getBounds(left);
      const was = d.getBounds(r.seen);
      const corner = d.getBounds(own);
      const vx = r.vx - drag * (corner.x - (moved.x - was.x) - r.startX);
      const vy = r.vy - drag * (corner.y - (moved.y - was.y) - r.startY);
      animator.spring<TPose>({
        target: r.target,
        from: own,
        to: left,
        velocity: poseVelocity(r.target.axes, d, own, vx, vy),
        cancelKey: poseKey(r.id),
        interrupt: false,
      });
    }
    halted(r);
  };

  function tick(r: Rider<TPose>, own: TPose): void {
    if (!ours(r)) { drop(r, own); return; }
    const corner = d.getBounds(own);
    const { nx, ny, hitX, hitY } = clampCorner(bounds, corner.x, corner.y);
    if (!hitX && !hitY) return;
    const vx = hitX ? 0 : r.vx - drag * (corner.x - r.startX);
    const vy = hitY ? 0 : r.vy - drag * (corner.y - r.startY);
    // Canceled, it commits the pose it reached; the edge is where it belongs.
    r.handle?.cancel();
    r.target.commit(translatePoseViaDescriptor(r.target.committed(), nx - corner.x, ny - corner.y, d));
    r.seen = r.target.committed();
    if (a.boundary === 'continue' && Math.hypot(vx, vy) > 0) launch(r, undefined, vx, vy);
    else halted(r);
  }

  const coast: Coast = {
    ids: ctx.draggedIds.slice(),
    stop: (): void => {
      // Canceled from outside (cancelAll, unmount), it stopped long ago and somewhere else.
      if (!animator.isActive(cancelKey)) {
        coasts.delete(coast);
        return;
      }
      for (const r of riders.values()) {
        r.handle?.cancel();
        r.handle = null;
        r.seen = r.target.committed();
      }
      commitFlick();
    },
  };
  coasts.add(coast);

  function commitFlick(): void {
    if (!coasts.delete(coast)) return;
    const ops: Op[] = [];
    for (const r of riders.values()) {
      if (!ours(r)) continue;
      const from = ctx.origin.get(r.id) ?? r.seen;
      ops.push(createTransformOp<TPose>({ id: r.id, from, to: r.target.committed(), label: 'flick' }));
    }
    // The document already holds each pose; this is what makes the flick one undoable step.
    if (ops.length > 0) adapter.applyOps?.(ops, 'flick');
  }

  for (const [id, target] of targets) {
    riders.set(id, { id, target, seen: target.committed(), handle: null, startX: 0, startY: 0, vx: 0, vy: 0 });
  }
  // Each starts from its release pose, which the document does not hold: the drag was a preview.
  for (const r of [...riders.values()]) launch(r, ctx.current.get(r.id), a.vx, a.vy);
}
