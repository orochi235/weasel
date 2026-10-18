/**
 * Frame timing for specs whose frames break the batch, imported into the page
 * (`/weasel/@fs…/tests/perf/lib/frameTiming.ts`) rather than by the spec.
 *
 * **One frame per task, after `setTimeout(0)`.** The few ms of idle that buys
 * is what a frame loop has between frames, and idle slows the next frame's GPU
 * work several times over against a GPU kept busy (`README.md`, "Idle time
 * before a frame slows the GPU"). Each sample ends in a one-pixel `readPixels`.
 *
 * **Not `finish`, which in Chromium's WebGL is a flush.** A one-pixel
 * `readPixels` cannot return before the draws behind it have run.
 *
 * A sample is the frame's latency through that read: the page's JS, the GPU
 * process and the GPU in series, plus one small readback. A frame loop overlaps
 * the GPU with the next frame's JS, so for a GPU-bound frame this overstates
 * what the loop pays.
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
  /** What a sample waits on before reading the clock. Default a one-pixel `readPixels`. */
  sync?: () => void;
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

const pixel = new Uint8Array(4);

/**
 * The least frame that still reaches the GPU: one scissored pixel cleared, with
 * the state that touches put back. A frame that issues nothing returns from the
 * read at once, so it cannot stand in for the fixed price of getting a frame
 * submitted and finished.
 */
function leastFrame(gl: WebGL2RenderingContext): void {
  const scissoring = gl.isEnabled(gl.SCISSOR_TEST);
  const box = gl.getParameter(gl.SCISSOR_BOX) as Int32Array;
  const color = gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array;
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0, 0, 1, 1);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.scissor(box[0], box[1], box[2], box[3]);
  gl.clearColor(color[0], color[1], color[2], color[3]);
  if (!scissoring) gl.disable(gl.SCISSOR_TEST);
}

/** Waits for every draw issued to the bound framebuffer to have run. */
export function drain(gl: WebGL2RenderingContext): void {
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
}

/** One frame in a task of its own, through `sync` (default `drain`), in ms. */
async function sampleFrame(gl: WebGL2RenderingContext, frame: () => void, sync?: () => void): Promise<number> {
  await nextTask();
  const t0 = performance.now();
  frame();
  if (sync) sync();
  else drain(gl);
  return performance.now() - t0;
}

/** How far the median of `xs` is likely from the true one: its standard error,
 *  from the median absolute deviation so one stalled frame does not set it. */
export function medianError(xs: readonly number[]): number {
  const mid = quantile(xs, 0.5);
  const spread = 1.4826 * quantile(xs.map((x) => Math.abs(x - mid)), 0.5);
  return (1.2533 * spread) / Math.sqrt(xs.length);
}

export interface Settle {
  /** Keep sampling until the median is known to this many ms, or to 2% of itself if that is more. */
  withinMs: number;
  /** Stop here even if it is not. */
  maxSamples: number;
}

/** Median ms of `samples` frames, each less `leastFrame` timed beside it (see
 *  `timeInterleaved`), after `warm` untimed ones, each in a task of its own.
 *  A frame that costs about what `leastFrame` does reads as noise around zero
 *  at a few samples; `settle` takes more until the median holds still. */
export async function frameMs(
  gl: WebGL2RenderingContext, frame: () => void,
  { samples = 9, warm = 3, settle }: { samples?: number; warm?: number; settle?: Settle } = {},
): Promise<number> {
  assertIsolated();
  for (let i = 0; i < warm; i++) await sampleFrame(gl, frame);
  const out: number[] = [];
  const settled = (): boolean => {
    if (!settle || out.length >= settle.maxSamples) return true;
    return medianError(out) <= Math.max(settle.withinMs, 0.02 * Math.abs(quantile(out, 0.5)));
  };
  while (out.length < samples || !settled()) {
    const floor = await sampleFrame(gl, () => leastFrame(gl));
    out.push((await sampleFrame(gl, frame)) - floor);
  }
  return quantile(out, 0.5);
}

export interface Timed {
  /** The quantile of `samples`, sync included. */
  stat: number;
  /** The quantile of each sample less `leastFrame` timed beside it: what the frame's own work costs. */
  net: number;
  samples: number[];
}

/**
 * Per-variant ms per frame. `leastFrame` is timed in every round beside the
 * variants, because any frame that draws costs a fixed price over one that
 * does not, and a per-command figure divided out of a frame that still holds
 * it is mostly that price.
 */
export async function timeInterleaved(
  gl: WebGL2RenderingContext,
  variants: readonly TimedVariant[],
  { samples = 40, quantile: q = 0.5, sync }: TimingOptions = {},
): Promise<Record<string, Timed>> {
  assertIsolated();
  const least = (): void => leastFrame(gl);
  const out: Record<string, number[]> = {};
  const floor: number[] = [];
  for (const v of variants) {
    out[v.id] = [];
    v.before?.();
    for (let i = 0; i < 3; i++) await sampleFrame(gl, v.frame, sync);
    v.after?.();
  }
  for (let s = 0; s < samples; s++) {
    floor.push(await sampleFrame(gl, least, sync));
    for (const v of variants) {
      v.before?.();
      out[v.id].push(await sampleFrame(gl, v.frame, sync));
      v.after?.();
    }
  }
  const result: Record<string, Timed> = {};
  for (const v of variants) {
    result[v.id] = {
      stat: quantile(out[v.id], q),
      net: quantile(out[v.id].map((x, i) => x - floor[i]), q),
      samples: out[v.id],
    };
  }
  return result;
}
