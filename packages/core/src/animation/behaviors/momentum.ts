import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { MoveBehavior, GestureContext } from 'interactions/gestures/types';
import { scratchKey, getScratch, setScratch } from 'interactions/scratchKey';
import type { Animator } from '../types';

export interface MomentumOptions {
  /** Required: the per-Canvas animator that will own the decay. */
  animator: Animator;
  friction?: number;     // default 0.92 (per second)
  threshold?: number;    // default 200 px/sec
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
}

interface PointerSample {
  t: number;       // ms timestamp
  x: number;
  y: number;
}

interface RectLike { x: number; y: number }

const SAMPLES = scratchKey<PointerSample[]>('momentum.samples');

export function momentum<TPose>(opts: MomentumOptions): MoveBehavior<TPose> {
  const friction = opts.friction ?? 0.92;
  const threshold = opts.threshold ?? 200;
  const sampleMs = opts.velocitySampleMs ?? 80;
  const now = opts.now ?? (() => Date.now());
  const bounds = opts.bounds;
  const boundaryPolicy = opts.boundary ?? 'stop';

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

  return {
    onStart(ctx) {
      setScratch(ctx.scratch, SAMPLES, []);
      recordSample(ctx);
    },
    onMove(ctx) {
      recordSample(ctx);
    },
    onEnd(ctx): Op[] | null | void {
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
      const adapter = ctx.adapter as { setPose(id: string, p: TPose): void; applyOps?(ops: Op[], label: string): void };
      // Track per-id final positions when bounds clamping is active — used
      // by onDone to compute the correct final transform op (not just
      // start + decay's last delta, which may overshoot the boundary).
      const finalPositions = new Map<string, { x: number; y: number }>();
      let decayHandle: { cancel(): void } | null = null;
      decayHandle = opts.animator.decay<RectLike>({
        from: { x: 0, y: 0 },
        velocity: { x: vx, y: vy },
        friction,
        add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
        scale: (v, k) => ({ x: v.x * k, y: v.y * k }),
        magnitude: (v) => Math.hypot(v.x, v.y),
        onTick: (delta) => {
          lastValue = delta;
          let allHit = bounds !== undefined;
          for (const id of ctx.draggedIds) {
            const start = startPoses.get(id) as unknown as RectLike & TPose;
            if (!start) continue;
            const { nx, ny, hit } = clampToBounds(start.x, start.y, delta.x, delta.y);
            if (!hit) allHit = false;
            finalPositions.set(id, { x: nx, y: ny });
            adapter.setPose(id, { ...start, x: nx, y: ny } as TPose);
          }
          // If 'stop' policy and every dragged id's clamped position hit
          // the boundary, cancel the decay so the animation settles instantly
          // instead of drifting along the edge as friction wears off.
          if (boundaryPolicy === 'stop' && allHit && decayHandle) {
            decayHandle.cancel();
            // Manually fire onDone since cancel() bypasses it.
            commitFlick();
          }
        },
        onDone: () => {
          commitFlick();
        },
      });

      function commitFlick(): void {
        if (!adapter.applyOps) return;
        const ops: Op[] = [];
        for (const id of ctx.draggedIds) {
          const start = startPoses.get(id) as unknown as RectLike & TPose;
          if (!start) continue;
          const fp = finalPositions.get(id) ?? { x: start.x + lastValue.x, y: start.y + lastValue.y };
          const finalPose = { ...start, x: fp.x, y: fp.y } as TPose;
          ops.push(createTransformOp<TPose>({ id, from: start, to: finalPose, label: 'flick' }));
        }
        if (ops.length > 0) adapter.applyOps(ops, 'flick');
      }

      return null;
    },
  };
}
