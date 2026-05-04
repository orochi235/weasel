import { createTransformOp } from '../../core/ops/transform';
import type { Op } from '../../core/ops/types';
import type { MoveBehavior, GestureContext } from '../../interactions/gestures/types';
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
}

interface PointerSample {
  t: number;       // ms timestamp
  x: number;
  y: number;
}

interface RectLike { x: number; y: number }

const SAMPLES_KEY = 'momentum.samples';

export function momentum<TPose>(opts: MomentumOptions): MoveBehavior<TPose> {
  const friction = opts.friction ?? 0.92;
  const threshold = opts.threshold ?? 200;
  const sampleMs = opts.velocitySampleMs ?? 80;
  const now = opts.now ?? (() => Date.now());

  const recordSample = (ctx: GestureContext<TPose>): void => {
    const samples = (ctx.scratch[SAMPLES_KEY] ??= []) as PointerSample[];
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
      ctx.scratch[SAMPLES_KEY] = [];
      recordSample(ctx);
    },
    onMove(ctx) {
      recordSample(ctx);
    },
    onEnd(ctx): Op[] | null | void {
      const samples = (ctx.scratch[SAMPLES_KEY] ?? []) as PointerSample[];
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
      const adapter = ctx.adapter as { setPose(id: string, p: TPose): void; applyBatch?(ops: Op[], label: string): void };
      opts.animator.decay<RectLike>({
        from: { x: 0, y: 0 },
        velocity: { x: vx, y: vy },
        friction,
        add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
        scale: (v, k) => ({ x: v.x * k, y: v.y * k }),
        magnitude: (v) => Math.hypot(v.x, v.y),
        onTick: (delta) => {
          lastValue = delta;
          for (const id of ctx.draggedIds) {
            const start = startPoses.get(id) as unknown as RectLike & TPose;
            if (!start) continue;
            adapter.setPose(id, { ...start, x: start.x + delta.x, y: start.y + delta.y } as TPose);
          }
        },
        onDone: () => {
          if (!adapter.applyBatch) return;
          const ops: Op[] = [];
          for (const id of ctx.draggedIds) {
            const start = startPoses.get(id) as unknown as RectLike & TPose;
            if (!start) continue;
            const finalPose = { ...start, x: start.x + lastValue.x, y: start.y + lastValue.y } as TPose;
            ops.push(createTransformOp<TPose>({ id, from: start, to: finalPose, label: 'flick' }));
          }
          if (ops.length > 0) adapter.applyBatch(ops, 'flick');
        },
      });
      return null;
    },
  };
}
