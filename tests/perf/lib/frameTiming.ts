/**
 * Frame timing that holds still on a GPU process whose speed does not.
 *
 * Imported into the page (`/weasel/@fs…/tests/perf/lib/frameTiming.ts`), not
 * by the spec. Measured on teitou, 2026-10-04 (`flush-noise.spec.ts`): the same
 * 512-flush frame ran at 3.4, 5.8, 7.0, 9.2 and 52 ms in plateaus tens of
 * frames long, with single frames stalling 0.15–3.7 s inside the GPU process's
 * command decode. A block mean takes every stall and plateau it overlaps, which
 * is how one per-flush figure read 5 us one round and 29 the next.
 *
 * So: variants interleave sample by sample, so a plateau lands on all of them;
 * each sample ends in `finish`, so a stall costs one sample rather than a block;
 * and the statistic is a low quantile, the cost in the fastest state the node
 * reaches. `performance.now()` is coarsened to 100 us here, so a sample runs
 * enough frames to fill `minSampleMs`.
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
  /** Shortest sample, in ms; sets frames per sample from a rough first pass. */
  minSampleMs?: number;
  /** Quantile `stat` reports. */
  quantile?: number;
}

export function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

/** Per-variant ms per frame: every sample, and the low quantile of them. */
export function timeInterleaved(
  gl: WebGL2RenderingContext,
  variants: readonly TimedVariant[],
  { samples = 40, minSampleMs = 2, quantile: q = 0.1 }: TimingOptions = {},
): Record<string, { stat: number; samples: number[] }> {
  const framesFor = new Map<string, number>();
  for (const v of variants) {
    v.before?.();
    for (let i = 0; i < 3; i++) v.frame();
    gl.finish();
    const t0 = performance.now();
    for (let i = 0; i < 4; i++) v.frame();
    gl.finish();
    const rough = Math.max((performance.now() - t0) / 4, 0.01);
    v.after?.();
    framesFor.set(v.id, Math.min(200, Math.max(1, Math.ceil(minSampleMs / rough))));
  }
  const out: Record<string, number[]> = {};
  for (const v of variants) out[v.id] = [];
  for (let s = 0; s < samples; s++) {
    for (const v of variants) {
      const frames = framesFor.get(v.id)!;
      v.before?.();
      v.frame();
      gl.finish();
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) v.frame();
      gl.finish();
      out[v.id].push((performance.now() - t0) / frames);
      v.after?.();
    }
  }
  const result: Record<string, { stat: number; samples: number[] }> = {};
  for (const v of variants) result[v.id] = { stat: quantile(out[v.id], q), samples: out[v.id] };
  return result;
}
