/**
 * The page half of `retain-redraw.spec.ts`, imported over vite's `@fs` route.
 * One context at a time holds a renderer per tile side, each redrawing the same
 * margined world layers every frame.
 */
import type { RetainLayer } from './retainLayers';

export interface Setup {
  root: string; w: number; h: number; dpr: number; layers: number; cmds: number;
  /** Tile sides; `0` draws every surface whole. */
  tiles: number[];
  budget: number | null;
}

export interface VariantTiming {
  tile: number;
  /** Each sample less the least frame timed beside it, ms. */
  net: number[];
  /** `renderer.render()`'s own time each sample, ms. */
  cpu: number[];
  /** Timer-query GPU time each sample, ms; `null` where it reported none. */
  gpu: (number | null)[];
  drawCalls: number;
  redrawn: number;
  peakBytes: number;
}

type Renderer = {
  render(cmds: unknown, view: Float32Array): void;
  lastFrameStats(): { ms: number; drawCalls: number; retained: { redrawn: number; bytes: number } };
  dispose(): void;
};

interface Stack { renderer: Renderer; cache: Map<string, unknown>; x: number }

interface Ctx { gl: WebGL2RenderingContext; stacks: Map<number, Stack> }

let mod: {
  WeaselRenderer: new (o: unknown) => Renderer;
  drawLayers: (...a: unknown[]) => unknown;
  timeInterleaved: typeof import('./frameTiming').timeInterleaved;
  drain: typeof import('./frameTiming').drain;
};
let setup: Setup;
let layers: RetainLayer[];
let ctx: Ctx | null = null;
let glRenderer = '';
/** CSS px the view jumps each frame and back, past every margin. */
const JUMP = 170;

export async function init(s: Setup): Promise<{ glRenderer: string; timer: boolean }> {
  setup = s;
  const base = `/weasel/@fs${s.root}`;
  const r = await import(/* @vite-ignore */ `${base}/packages/renderer/src/index.ts`);
  const core = await import(/* @vite-ignore */ `${base}/packages/core/src/core/layers/render.ts`);
  const kindsMod = await import(/* @vite-ignore */ `${base}/tests/perf/lib/kinds.ts`);
  const timing = await import(/* @vite-ignore */ `${base}/tests/perf/lib/frameTiming.ts`);
  const { worldLayers } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/retainLayers.ts`);
  mod = { WeaselRenderer: r.WeaselRenderer, drawLayers: core.drawLayers, timeInterleaved: timing.timeInterleaved, drain: timing.drain };
  await r.registerFont('sans-serif', { weight: 400, style: 'normal' }, '/weasel/inter/inter.json', '/weasel/inter/inter.png');
  const kinds = kindsMod.makeKindBuilders({ W: 2 * s.w, H: 2 * s.h, bitmaps: await kindsMod.imageBitmaps(6), pattern: { id: 'unused' }, shader: null });
  layers = worldLayers(kinds, s.layers, s.cmds, s.w, s.h);
  const gl = open().gl;
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') !== null;
  close();
  return { glRenderer, timer };
}

function open(): Ctx {
  const canvas = document.createElement('canvas');
  canvas.width = setup.w * setup.dpr;
  canvas.height = setup.h * setup.dpr;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('no WebGL2 context');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  ctx = { gl, stacks: new Map() };
  return ctx;
}

function close(): void {
  if (!ctx) return;
  for (const s of ctx.stacks.values()) s.renderer.dispose();
  ctx.gl.getExtension('WEBGL_lose_context')?.loseContext();
  ctx = null;
}

function frame(tile: number): void {
  const s = ctx!.stacks.get(tile)!;
  s.x = s.x === 0 ? JUMP : 0;
  const view = { x: s.x, y: 0, scale: { x: 1, y: 1 } };
  const viewMatrix = new Float32Array([1, 0, 0, 0, 1, 0, -view.x, -view.y, 1]);
  const { w, h } = setup;
  s.renderer.render(mod.drawLayers(layers, null, {}, undefined, view, { width: w, height: h }, s.cache), viewMatrix);
}

/** A fresh context with a renderer per tile side, each warmed three frames. */
export function openContext(): void {
  close();
  const { gl } = open();
  const { w, h, dpr, budget } = setup;
  for (const tile of setup.tiles) {
    const renderer = new mod.WeaselRenderer({ gl, width: w, height: h, dpr, retainBudget: budget ?? undefined });
    // The renderer's own store; the tile side is not public API.
    (renderer as unknown as { retained: { tile: number } }).retained.tile = tile === 0 ? Infinity : tile;
    ctx!.stacks.set(tile, { renderer, cache: new Map(), x: 0 });
    for (let i = 0; i < 3; i++) frame(tile);
  }
  gl.finish();
  (globalThis as { gc?: (o?: unknown) => void }).gc?.({ type: 'major', execution: 'sync' });
}

function collectGpu(gl: WebGL2RenderingContext, ext: { GPU_DISJOINT_EXT: number }, qs: WebGLQuery[]): Promise<(number | null)[]> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const poll = (): void => {
      const ready = qs.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE));
      if (!ready && performance.now() - t0 < 2000) { setTimeout(poll, 5); return; }
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
      resolve(qs.map((q) => {
        const ok = !disjoint && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
        const ns = ok ? (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) : null;
        gl.deleteQuery(q);
        return ns === null ? null : ns / 1e6;
      }));
    };
    poll();
  });
}

/** Every tile side timed interleaved in the open context, `samples` each. */
export async function timeContext(samples: number): Promise<VariantTiming[]> {
  const { gl, stacks } = ctx!;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const rec = new Map<number, { cpu: number[]; queries: WebGLQuery[]; drawCalls: number; redrawn: number; peakBytes: number }>();
  const timed = await mod.timeInterleaved(gl, setup.tiles.map((tile) => {
    const r = { cpu: [] as number[], queries: [] as WebGLQuery[], drawCalls: 0, redrawn: 0, peakBytes: 0 };
    rec.set(tile, r);
    return {
      id: String(tile),
      // The query spans the frame's own commands, not the idle task before it.
      frame: () => {
        const q = ext ? gl.createQuery() : null;
        if (ext && q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        frame(tile);
        if (ext && q) { gl.endQuery(ext.TIME_ELAPSED_EXT); r.queries.push(q); }
      },
      after: () => {
        const st = stacks.get(tile)!.renderer.lastFrameStats();
        r.cpu.push(st.ms);
        r.drawCalls = st.drawCalls;
        r.redrawn = st.retained.redrawn;
        r.peakBytes = Math.max(r.peakBytes, st.retained.bytes);
      },
    };
  }), { samples });
  const out: VariantTiming[] = [];
  for (const tile of setup.tiles) {
    const r = rec.get(tile)!;
    // `timeInterleaved` warms up with three frames under one `after`.
    const gpu = ext ? (await collectGpu(gl, ext, r.queries)).slice(3) : r.cpu.slice(1).map(() => null);
    const t = timed[String(tile)];
    out.push({ tile, net: t.samples.map((x) => +x.toFixed(4)), cpu: r.cpu.slice(1).map((x) => +x.toFixed(4)), gpu, drawCalls: r.drawCalls, redrawn: r.redrawn, peakBytes: r.peakBytes });
  }
  return out;
}

/** `n` frames of one tile side, each in a task of its own and drained, between
 *  `rr-start` and `rr-end` marks with `rr-f<i>` at each frame's start: for a
 *  profile or a trace. */
export async function runFrames({ tile, n }: { tile: number; n: number }): Promise<void> {
  const { gl } = ctx!;
  performance.mark('rr-start');
  for (let i = 0; i < n; i++) {
    await new Promise((r) => setTimeout(r, 0));
    performance.mark(`rr-f${i}`);
    frame(tile);
    mod.drain(gl);
  }
  performance.mark(`rr-f${n}`);
  performance.mark('rr-end');
}

export function closeContext(): void {
  close();
}
