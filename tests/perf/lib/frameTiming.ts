/**
 * Frame timing for specs whose frames break the batch, imported into the page
 * (`/weasel/@fs…/tests/perf/lib/frameTiming.ts`) rather than by the spec.
 *
 * **One frame per task.** Measured on teitou, 2026-10-04
 * (`flush-noise.spec.ts`, `yield` phase): a frame of 512 one-rect flushes costs
 * 0.5–0.8 ms when the page yields to the event loop between frames, as a real
 * frame loop does. Run back to back inside one task, the first eight still cost
 * that and every one after costs 3–9 ms, in plateaus that shift from round to
 * round, with occasional single frames stalling 0.15–3.7 s inside the GPU
 * process. A block of 80 frames timed in one task measured that regime, not
 * the renderer — which is how a per-flush figure read 5 us one round and 29
 * the next. Each sample here runs a frame in a task of its own and ends in
 * `finish`.
 *
 * A sample is the frame's latency through `finish`: the page's JS, the GPU
 * process and the GPU in series. A frame loop overlaps the GPU with the next
 * frame's JS, so for a GPU-bound frame this overstates what the loop pays.
 *
 * Variants interleave sample by sample so whatever drifts lands on all of them,
 * and the statistic is the median. It needs `performance.now()` finer than the
 * 100 us it is coarsened to by default, so the page must be cross-origin
 * isolated — see `isolate.ts`.
 */

export interface TimedVariant {
  id: string;
  /** Draw one frame. Called between `before` and `after`, if given. */
  frame(): void;
  before?(): void;
  after?(): void;
}

export interface TimingOptions {
  /** Samples per variant. */
  samples?: number;
  /** Quantile `stat` reports. */
  quantile?: number;
}

export function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

const nextTask = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function assertIsolated(): void {
  if (!globalThis.crossOriginIsolated) {
    throw new Error('frameTiming: the page is not cross-origin isolated, so the timer is too coarse; see isolate.ts');
  }
}

/** One frame in a task of its own, through `finish`, in ms. */
async function sampleFrame(gl: WebGL2RenderingContext, frame: () => void): Promise<number> {
  await nextTask();
  const t0 = performance.now();
  frame();
  gl.finish();
  return performance.now() - t0;
}

/** Median ms of `samples` frames, after `warm` untimed ones, each in a task of
 *  its own. */
export async function frameMs(
  gl: WebGL2RenderingContext, frame: () => void,
  { samples = 9, warm = 3 }: { samples?: number; warm?: number } = {},
): Promise<number> {
  assertIsolated();
  for (let i = 0; i < warm; i++) await sampleFrame(gl, frame);
  const out: number[] = [];
  for (let i = 0; i < samples; i++) out.push(await sampleFrame(gl, frame));
  return quantile(out, 0.5);
}

/** Per-variant ms per frame: every sample, and the quantile of them. */
export async function timeInterleaved(
  gl: WebGL2RenderingContext,
  variants: readonly TimedVariant[],
  { samples = 40, quantile: q = 0.5 }: TimingOptions = {},
): Promise<Record<string, { stat: number; samples: number[] }>> {
  assertIsolated();
  const out: Record<string, number[]> = {};
  for (const v of variants) {
    out[v.id] = [];
    v.before?.();
    for (let i = 0; i < 3; i++) await sampleFrame(gl, v.frame);
    v.after?.();
  }
  for (let s = 0; s < samples; s++) {
    for (const v of variants) {
      v.before?.();
      out[v.id].push(await sampleFrame(gl, v.frame));
      v.after?.();
    }
  }
  const result: Record<string, { stat: number; samples: number[] }> = {};
  for (const v of variants) result[v.id] = { stat: quantile(out[v.id], q), samples: out[v.id] };
  return result;
}
