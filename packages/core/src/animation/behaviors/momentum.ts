import type { Op } from 'core/ops/types';
import type { MoveBehavior, GestureContext } from 'interactions/gestures/types';
import { scratchKey, getScratch, setScratch } from '@weasel-js/routing';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { Target } from '@weasel-js/animator';
import type { Animator } from '@weasel-js/animator';
import type { Coast, CoastArgs } from './coast';
import { coastByWrite } from './coastByWrite';
import { coastOnTargets } from './coastOnTargets';

/** Options for the `momentum` move behavior. */
export interface MomentumOptions {
  /** Required: the per-Canvas animator that will own the decay. */
  animator: Animator;
  friction?: number;     // default 0.92 (per second)
  threshold?: number;    // default 200 world units/sec; the slowest release that coasts
  /** Sample window in ms for velocity computation. Default 80ms. */
  velocitySampleMs?: number;
  /** Optional clock override for tests. Defaults to `Date.now`. */
  now?: () => number;
  /**
   * Optional bounds for the object's top-left corner (in world units): each
   * tick's new position is clamped so the object's `(x, y)` stays inside the
   * rect. Object size is ignored, so to keep an object fully inside, shrink
   * the rect by the object's width and height.
   */
  bounds?: { x: number; y: number; width: number; height: number };
  /**
   * Boundary policy when the clamped position hits an edge. 'stop' settles at
   * the edge at once. 'continue' keeps decaying, so the object drifts along
   * the edge. Default 'stop'.
   */
  boundary?: 'stop' | 'continue';
  /** How to translate poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<unknown>;
}

interface PointerSample {
  t: number;       // ms timestamp
  x: number;
  y: number;
}

const SAMPLES = scratchKey<PointerSample[]>('momentum.samples');

/**
 * Move behavior that keeps a dragged node coasting after the pointer is
 * released, at the velocity it was traveling, until friction brings it to
 * rest. A release slower than `threshold` does not coast at all.
 *
 * The whole flick, coast included, records as one undoable transform, written
 * once it comes to rest. Over an adapter with `poseTarget`, which a
 * scene-backed one has, each node coasts on its own pose target, so anything
 * else animating it adds; over one without, the coast is shown through
 * `previewPoses`, or written through `setPose` each frame. Dragging a node
 * again while it coasts stops the coast and records it where it stands. A
 * `tweenPose` or `springPose` of a coasting node ends its coast. A node
 * something else moves or deletes mid-coast, an undo included, drops out of
 * the coast where that left it, and nothing is recorded for it.
 */
export function momentum<TPose>(opts: MomentumOptions): MoveBehavior<TPose> {
  const friction = opts.friction ?? 0.92;
  const threshold = opts.threshold ?? 200;
  const sampleMs = opts.velocitySampleMs ?? 80;
  const now = opts.now ?? (() => Date.now());
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;

  const recordSample = (ctx: GestureContext<TPose>): void => {
    let samples = getScratch(ctx.scratch, SAMPLES);
    if (!samples) {
      samples = [];
      setScratch(ctx.scratch, SAMPLES, samples);
    }
    samples.push({
      t: now(),
      x: ctx.pointer.worldX,
      y: ctx.pointer.worldY,
    });
    // Trim anything older than 4× the sample window — bounded memory.
    const cutoff = now() - sampleMs * 4;
    while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
  };

  const coasts = new Set<Coast>();

  /** Every dragged node's pose target, or null where the adapter has none for one of them. */
  const targetsOf = (ctx: GestureContext<TPose>): Map<string, Target<TPose>> | null => {
    const { adapter } = ctx;
    if (!adapter.poseTarget) return null;
    const targets = new Map<string, Target<TPose>>();
    for (const id of ctx.draggedIds) {
      if (!ctx.current.has(id)) continue;
      const target = adapter.getNode(id) && adapter.poseTarget(id, opts.poseDescriptor as PoseDescriptor<TPose> | undefined);
      if (!target) return null;
      targets.set(id, target);
    }
    return targets;
  };

  return {
    onStart(ctx) {
      for (const coast of [...coasts]) {
        if (coast.ids.some((id) => ctx.draggedIds.includes(id))) coast.stop();
      }
      setScratch(ctx.scratch, SAMPLES, []);
      recordSample(ctx);
    },
    onMove(ctx) {
      recordSample(ctx);
    },
    onEnd(ctx, end): Op[] | null | void {
      if (end.answered) return undefined;
      const samples = getScratch(ctx.scratch, SAMPLES) ?? [];
      if (samples.length < 2) return undefined;
      const last = samples[samples.length - 1];
      // Find the oldest sample within `sampleMs` of `last`.
      const cutoff = last.t - sampleMs;
      let first = samples[0];
      for (const s of samples) {
        if (s.t >= cutoff) { first = s; break; }
      }
      const dt = (last.t - first.t) / 1000;
      if (dt <= 0) return undefined;
      const vx = (last.x - first.x) / dt;
      const vy = (last.y - first.y) / dt;
      if (Math.hypot(vx, vy) < threshold) return undefined;

      const args: CoastArgs<TPose> = {
        animator: opts.animator, ctx, vx, vy, friction, d, coasts,
        bounds: opts.bounds, boundary: opts.boundary ?? 'stop',
      };
      const targets = targetsOf(ctx);
      if (targets) coastOnTargets(args, targets);
      else coastByWrite(args);
      // The coast commits the flick itself, so the move action's own commit is suppressed.
      return null;
    },
  };
}
