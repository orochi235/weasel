import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { MoveBehavior, GestureContext } from 'interactions/gestures/types';
import { scratchKey, getScratch, setScratch } from '@weasel-js/routing';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import type { Animator } from '../types';

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
   * Optional bounds for the object's top-left corner (in world units). When
   * supplied, momentum-driven translation is clamped: each tick's new
   * position is constrained so the object's `(x, y)` stays inside the rect.
   * Without bounds, a hard flick carries the object indefinitely until
   * friction dampens velocity below `threshold`.
   *
   * Note: ignores object size for now — the bound is on the top-left, not
   * the visible edges. A consumer wanting "object stays fully inside" should
   * pass `bounds = { x: canvas.x, y: canvas.y, width: canvas.w - obj.w,
   * height: canvas.h - obj.h }` (and accept that it doesn't adapt to
   * variable-sized objects mid-flight).
   */
  bounds?: { x: number; y: number; width: number; height: number };
  /**
   * Boundary policy when the clamped position hits an edge. 'stop' cancels
   * the decay (instant settle at the edge). 'continue' keeps decaying but
   * subsequent ticks stay clamped (object drifts along the edge as friction
   * decays the velocity). Default 'stop'.
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

interface RectLike { x: number; y: number }

const sameBounds = (a: Bounds, b: Bounds): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

let nextCoast = 0;

const SAMPLES = scratchKey<PointerSample[]>('momentum.samples');

/**
 * Move behavior that keeps a dragged node coasting after the pointer is
 * released, at the velocity it was traveling, until friction brings it to
 * rest. A release slower than `threshold` does not coast at all.
 *
 * Plugs into the move action rather than replacing it, so the drag itself is
 * unchanged — this only decides what happens after the release. The whole
 * flick, coast included, records as one undoable transform. Dragging a node
 * again while it coasts stops the coast and records it where it stands. A node
 * something else moves or deletes mid-coast, an undo included, drops out of
 * the coast where that left it, and nothing is recorded for it.
 */
export function momentum<TPose>(opts: MomentumOptions): MoveBehavior<TPose> {
  const friction = opts.friction ?? 0.92;
  const threshold = opts.threshold ?? 200;
  const sampleMs = opts.velocitySampleMs ?? 80;
  const now = opts.now ?? (() => Date.now());
  const bounds = opts.bounds;
  const boundaryPolicy = opts.boundary ?? 'stop';
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;

  /** Apply bounds clamp to (sx + dx, sy + dy). Returns clamped (nx, ny) and
   *  whether either axis was clamped (signalling boundary hit). */
  const clampToBounds = (sx: number, sy: number, dx: number, dy: number): { nx: number; ny: number; hit: boolean } => {
    let nx = sx + dx;
    let ny = sy + dy;
    if (!bounds) return { nx, ny, hit: false };
    let hit = false;
    if (nx < bounds.x) { nx = bounds.x; hit = true; }
    else if (nx > bounds.x + bounds.width) { nx = bounds.x + bounds.width; hit = true; }
    if (ny < bounds.y) { ny = bounds.y; hit = true; }
    else if (ny > bounds.y + bounds.height) { ny = bounds.y + bounds.height; hit = true; }
    return { nx, ny, hit };
  };

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

  const coasts = new Set<{ ids: readonly string[]; stop(): void }>();

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
      const speed = Math.hypot(vx, vy);
      if (speed < threshold) return undefined;

      // Suppress default commit and fire decay. We translate each dragged id
      // by the per-frame delta and commit one transform op per id when done.
      const startPoses = new Map<string, TPose>(ctx.current);
      let lastValue = { x: 0, y: 0 };
      const adapter = ctx.adapter as typeof ctx.adapter & { applyOps?(ops: Op[], label: string): void };
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
      // Track per-id final positions when bounds clamping is active — used
      // by onDone to compute the correct final transform op (not just
      // start + decay's last delta, which may overshoot the boundary).
      const finalPositions = new Map<string, { x: number; y: number }>();
      const cancelKey = `momentum:${nextCoast++}`;
      const coast = {
        ids: ctx.draggedIds.slice(),
        stop: (): void => {
          // Canceled from outside (cancelAll, unmount), it stopped long ago and somewhere else.
          if (!opts.animator.isActive(cancelKey)) {
            coasts.delete(coast);
            return;
          }
          decayHandle.cancel();
          commitFlick();
        },
      };
      coasts.add(coast);
      const decayHandle = opts.animator.decay<RectLike>({
        from: { x: 0, y: 0 },
        velocity: { x: vx, y: vy },
        friction,
        cancelKey,
        add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
        scale: (v, k) => ({ x: v.x * k, y: v.y * k }),
        magnitude: (v) => Math.hypot(v.x, v.y),
        onTick: (delta) => {
          lastValue = delta;
          let allHit = bounds !== undefined;
          for (const id of [...riding]) {
            if (!stillOurs(id)) {
              riding.delete(id);
              continue;
            }
            const start = startPoses.get(id);
            if (!start) continue;
            const o = d.getBounds(start);
            const { nx, ny, hit } = clampToBounds(o.x, o.y, delta.x, delta.y);
            if (!hit) allHit = false;
            finalPositions.set(id, { x: nx, y: ny });
            adapter.setPose(id, translatePoseViaDescriptor(start, nx - o.x, ny - o.y, d));
            lastSeen.set(id, d.getBounds(adapter.getPose(id)));
          }
          if (riding.size === 0) {
            coasts.delete(coast);
            decayHandle.cancel();
            return;
          }
          // If 'stop' policy and every dragged id's clamped position hit
          // the boundary, cancel the decay so the animation settles instantly
          // instead of drifting along the edge as friction wears off.
          if (boundaryPolicy === 'stop' && allHit) coast.stop();
        },
        onDone: () => {
          commitFlick();
        },
      });

      function commitFlick(): void {
        if (!coasts.delete(coast) || !adapter.applyOps) return;
        const ops: Op[] = [];
        for (const id of riding) {
          if (!stillOurs(id)) continue;
          const start = startPoses.get(id);
          if (!start) continue;
          const o = d.getBounds(start);
          const fp = finalPositions.get(id) ?? { x: o.x + lastValue.x, y: o.y + lastValue.y };
          const finalPose = translatePoseViaDescriptor(start, fp.x - o.x, fp.y - o.y, d);
          const from = ctx.origin.get(id) ?? start;
          ops.push(createTransformOp<TPose>({ id, from, to: finalPose, label: 'flick' }));
        }
        if (ops.length > 0) adapter.applyOps(ops, 'flick');
      }

      return null;
    },
  };
}
