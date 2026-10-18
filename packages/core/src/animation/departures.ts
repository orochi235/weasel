/**
 * Ghosts of removed nodes: what a pose transition shows leaving after the
 * scene has let a node go. A ghost is not a scene node, so picking,
 * selection and history never see it; it lives here until its glide ends.
 */
import type { PoseDescriptor } from '../core/geometry/poseDescriptor';
import { createPoseOverrides } from '../core/scene/poseOverrides';
import type { PoseRemoval } from '../core/scene/poseWrites';
import type { NodeId } from '../core/scene/types';
import type { ReflowTransition } from '../layout/types';
import { poseAxes } from './poseTarget';
import type { AnimatedReflow, ReflowScene } from './reflow';

/** A pose and how opaque it is shown. */
export interface Faded<TPose> {
  pose: TPose;
  alpha: number;
}

/** `base`'s poses with an opacity riding beside them, as one more axis. */
export function fadedDescriptor<TPose>(base: PoseDescriptor<TPose>): PoseDescriptor<Faded<TPose>> {
  const lerp = base.lerp;
  return {
    getBounds: (v) => base.getBounds(v.pose),
    remapBounds: (v, src, dst) => ({ ...v, pose: base.remapBounds(v.pose, src, dst) }),
    fromBounds: (bounds, t) => ({ ...t, pose: base.fromBounds(bounds, t.pose) }),
    lerp: lerp && ((a, b, t) => ({ pose: lerp(a.pose, b.pose, t), alpha: a.alpha + (b.alpha - a.alpha) * t })),
    axes(like) {
      const axes = poseAxes(base, like.pose);
      if (!axes) return null;
      const n = axes.count;
      return {
        count: n + 1,
        angles: axes.angles,
        to: (v) => [...axes.to(v.pose), v.alpha],
        from: (a) => ({ pose: axes.from(Array.prototype.slice.call(a, 0, n) as number[]), alpha: a[n]! }),
      };
    },
  };
}

/** A removed node as its ghost shows it now. */
export interface ShownDeparture<TPose, TNode> {
  removal: PoseRemoval<TPose, TNode>;
  pose: TPose;
  alpha: number;
}

/** The ghosts one canvas shows. */
export interface Departures<TPose, TNode> {
  /** See `removal` off from where it was shown toward `exit` of that pose,
   *  fading out, through `transition`. Does nothing for a transition with no
   *  `over`, which cannot carry a node the scene no longer holds. */
  leave(removal: PoseRemoval<TPose, TNode>, exit: (pose: TPose) => TPose, transition: ReflowTransition<TPose>): void;
  /** Drop `id`'s ghost — its node is back — and answer where it was shown. */
  recall(id: string): TPose | undefined;
  shown(): ShownDeparture<TPose, TNode>[];
  /** Hear each frame a ghost moves, and each one that comes or goes. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

interface Ghost<TPose, TNode> {
  removal: PoseRemoval<TPose, TNode>;
  /** Where its glide ends: the exit pose, unseen. */
  home: Faded<TPose>;
}

export function createDepartures<TPose, TNode>(): Departures<TPose, TNode> {
  const ghosts = new Map<string, Ghost<TPose, TNode>>();
  const overrides = createPoseOverrides<Faded<TPose>>(() => undefined);
  const scene: ReflowScene<Faded<TPose>> = {
    overrides,
    get: (id) => {
      const g = ghosts.get(id);
      return g && { id: id as NodeId, pose: g.home };
    },
    childrenOf: () => [],
  };
  let carrier: { from: ReflowTransition<TPose>; over: AnimatedReflow<Faded<TPose>> | null } | null = null;
  const carrierOf = (t: ReflowTransition<TPose>): AnimatedReflow<Faded<TPose>> | null => {
    if (carrier?.from !== t) {
      carrier?.over?.dispose();
      const over = (t as Partial<AnimatedReflow<TPose>>).over?.(scene, fadedDescriptor) ?? null;
      carrier = { from: t, over };
    }
    return carrier.over;
  };
  // A ghost whose glide has let go of it has left.
  overrides.subscribe(() => {
    for (const id of [...ghosts.keys()]) if (!overrides.has(id as NodeId)) ghosts.delete(id);
  });

  return {
    leave(removal, exit, transition) {
      const over = carrierOf(transition);
      if (!over) return;
      const id = removal.id as string;
      over.stop(id);
      ghosts.set(id, { removal, home: { pose: exit(removal.pose), alpha: 0 } });
      over.settle(id, { from: { pose: removal.pose, alpha: 1 } });
      if (!overrides.has(removal.id)) ghosts.delete(id);
    },
    recall(id) {
      if (!ghosts.has(id)) return undefined;
      const shown = overrides.read(id as NodeId)?.pose ?? ghosts.get(id)!.home;
      ghosts.delete(id);
      carrier?.over?.stop(id);
      return shown.pose;
    },
    shown() {
      return [...ghosts.values()].map((g) => {
        const v = overrides.read(g.removal.id)?.pose ?? g.home;
        return { removal: g.removal, pose: v.pose, alpha: v.alpha };
      });
    },
    subscribe: overrides.subscribe,
    dispose() {
      ghosts.clear();
      carrier?.over?.dispose();
      carrier = null;
      overrides.clearAll();
    },
  };
}
