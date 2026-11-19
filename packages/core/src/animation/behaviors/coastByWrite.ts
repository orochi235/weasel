import { createSetPoseOp } from 'core/ops/setPose';
import type { Op } from 'core/ops/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
import { clampCorner, coastKey, sameBounds, type Coast, type CoastArgs } from './coast';

interface Delta { x: number; y: number }

/**
 * A coast over an adapter with no pose targets: one decay of the flick's travel, written to
 * every node it carries each frame, through `previewPoses` where the adapter has it and
 * `setPose` where it does not. Nothing else animating a node adds to it.
 */
export function coastByWrite<TPose>(a: CoastArgs<TPose>): void {
  const { animator, ctx, d, bounds, coasts } = a;
  const adapter = ctx.adapter;
  const startPoses = new Map<string, TPose>(ctx.current);
  let lastValue: Delta = { x: 0, y: 0 };
  const show = (poses: Map<string, TPose | null>): void => {
    if (adapter.previewPoses) adapter.previewPoses(poses);
    else for (const [id, pose] of poses) if (pose !== null) adapter.setPose(id, pose);
  };
  // What the scene held for each node right after the coast last wrote it.
  // A node that is gone, or reads back as anything else, has another
  // writer now, an undo or a delete, and leaves the coast unrecorded.
  const riding = new Set(ctx.draggedIds);
  const lastSeen = new Map<string, Bounds>();
  for (const id of riding) {
    if (adapter.getNode(id)) lastSeen.set(id, d.getBounds(adapter.getPose(id)));
  }
  const stillOurs = (id: string): boolean => {
    const seen = lastSeen.get(id);
    return seen !== undefined && adapter.getNode(id) !== undefined
      && sameBounds(d.getBounds(adapter.getPose(id)), seen);
  };
  // Where each node was last put, which under bounds is not its start plus the decay's travel.
  const finalPositions = new Map<string, Delta>();
  /** Under 'stop', the nodes settled at an edge: each stays where it hit while the rest travel on. */
  const halted = new Set<string>();
  const cancelKey = coastKey();
  const coast: Coast = {
    ids: ctx.draggedIds.slice(),
    stop: (): void => {
      decayHandle.cancel();
      commitFlick();
    },
  };
  coasts.add(coast);
  // A decay canceled from outside (`cancelAll`, `cancelKey`, the animator unmounting) skips
  // `onDone`: the coast has stopped where it last showed the nodes, and is recorded there.
  const unwatch = animator.watch((event) => {
    if (event.type === 'cancel' && event.animation.key === cancelKey) commitFlick();
  });
  // Held from the release itself, so no frame paints the pre-drag pose
  // between the drag's preview going away and the first coast frame.
  show(new Map([...riding].flatMap((id) => {
    const start = startPoses.get(id);
    return start === undefined ? [] : [[id, start] as const];
  })));
  const decayHandle = animator.decay<Delta>({
    from: { x: 0, y: 0 },
    velocity: { x: a.vx, y: a.vy },
    friction: a.friction,
    cancelKey,
    add: (p, q) => ({ x: p.x + q.x, y: p.y + q.y }),
    scale: (v, k) => ({ x: v.x * k, y: v.y * k }),
    magnitude: (v) => Math.hypot(v.x, v.y),
    onTick: (delta) => {
      lastValue = delta;
      const frame = new Map<string, TPose | null>();
      for (const id of [...riding]) {
        if (!stillOurs(id)) {
          riding.delete(id);
          frame.set(id, null);
          continue;
        }
        const start = startPoses.get(id);
        if (!start || halted.has(id)) continue;
        const o = d.getBounds(start);
        const { nx, ny, hitX, hitY } = clampCorner(bounds, o.x + delta.x, o.y + delta.y);
        if (a.boundary === 'stop' && (hitX || hitY)) halted.add(id);
        finalPositions.set(id, { x: nx, y: ny });
        frame.set(id, translatePoseViaDescriptor(start, nx - o.x, ny - o.y, d));
      }
      show(frame);
      for (const id of riding) lastSeen.set(id, d.getBounds(adapter.getPose(id)));
      if (riding.size === 0) {
        coasts.delete(coast);
        unwatch();
        decayHandle.cancel();
        return;
      }
      // Under 'stop', once every node has settled at an edge the coast is over.
      if ([...riding].every((id) => halted.has(id) || !startPoses.has(id))) coast.stop();
    },
    onDone: () => {
      commitFlick();
    },
  });

  function commitFlick(): void {
    if (!coasts.delete(coast)) return;
    unwatch();
    const ops: Op[] = [];
    const shown = new Map<string, TPose | null>();
    for (const id of riding) {
      shown.set(id, null);
      if (!stillOurs(id)) continue;
      const start = startPoses.get(id);
      if (!start) continue;
      const o = d.getBounds(start);
      const fp = finalPositions.get(id) ?? { x: o.x + lastValue.x, y: o.y + lastValue.y };
      const finalPose = translatePoseViaDescriptor(start, fp.x - o.x, fp.y - o.y, d);
      const from = ctx.origin.get(id) ?? start;
      ops.push(createSetPoseOp<TPose>({ id, from, to: finalPose, label: 'flick' }));
    }
    // The document first, so the preview never gives way to the pre-drag pose.
    if (ops.length > 0) {
      if (adapter.applyOps) adapter.applyOps(ops, 'flick');
      else if (adapter.previewPoses) for (const op of ops) op.apply(adapter);
    }
    adapter.previewPoses?.(shown);
  }
}
