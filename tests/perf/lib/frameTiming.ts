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
 * the next. Each sample here runs a frame in a task of its own and ends in a
 * one-pixel `readPixels`.
 *
 * **Not `finish`, which does not wait for the GPU.** On teitou, 2026-10-05
 * (`fill-rate.spec.ts`'s probe), 432M fragments timed 0.03 ms through `finish`
 * and 3.6 ms through a one-pixel `readPixels`, which cannot return before the
 * draws behind it have run. The figures specs took through `finish` before
 * then leave out the GPU's own time.
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

/** Median ms of `samples` frames, each less `leastFrame` timed beside it (see
 *  `timeInterleaved`), after `warm` untimed ones, each in a task of its own. */
export async function frameMs(
  gl: WebGL2RenderingContext, frame: () => void,
  { samples = 9, warm = 3 }: { samples?: number; warm?: number } = {},
): Promise<number> {
  assertIsolated();
  for (let i = 0; i < warm; i++) await sampleFrame(gl, frame);
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
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
 * variants, because on teitou (2026-10-05, `atlas-wall`) any frame that draws
 * costs about 1.3 ms more than one that does not — more than the work of 7,500
 * batched rects — and a per-command figure divided out of a frame that still
 * holds it is mostly that fixed price.
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
