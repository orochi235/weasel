/**
 * Where a staged command's time goes, by paint: a solid, a linear gradient and
 * a pattern, each a frame of rects that all join one run.
 *
 * `transition-matrix.spec.ts` prices a homogeneous frame of each kind, and a
 * pattern cost more than a gradient there with nothing saying why. This times
 * the same frames three ways: through the frame's own read (what the matrix
 * reports), the CPU time `render` takes to issue it with the GPU idle before
 * it, and a CPU profile of the issuing, summed by function. The profile is
 * taken separately from the timing, since the profiler slows what it watches.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const N = 512;
const RUNS = rounds(3);
/** Frames rendered under the profiler, per kind. */
const PROFILED_FRAMES = 200;
const KINDS = ['solid', 'gradient', 'pattern'] as const;
/** Functions listed per kind, by self time. */
const TOP = 14;

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}
interface Profile { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] }

/** Self time per function, in ms, keyed `name (file:line)`. */
function selfTimes(profile: Profile): Map<string, number> {
  const byNode = new Map<number, number>();
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    byNode.set(id, (byNode.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  }
  const out = new Map<string, number>();
  for (const node of profile.nodes) {
    const ms = byNode.get(node.id);
    if (!ms) continue;
    const { functionName, url, lineNumber } = node.callFrame;
    const file = url.split('/').pop()?.split('?')[0] ?? '';
    const key = `${functionName || '(anonymous)'} (${file}:${lineNumber + 1})`;
    out.set(key, (out.get(key) ?? 0) + ms);
  }
  return out;
}

test.setTimeout(600_000);

test('paint staging: where a solid, a gradient and a pattern command spend their time', async ({ page, browser, browserName }) => {
  const run = startRun('paint-staging', { viewport: '800x600', dpr: 1, commands: N, runs: RUNS, profiledFrames: PROFILED_FRAMES });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  await page.evaluate(async ({ root, n }) => {
    const base = `/weasel/@fs${root}`;
    const { WeaselRenderer, registerTexture } = await import(/* @vite-ignore */ `${base}/packages/renderer/src/index.ts`);
    const { makeKindBuilders, checkerBitmap } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/kinds.ts`);
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = new WeaselRenderer({ gl, canvas, width: 800, height: 600, dpr: 1 });
    const builders = makeKindBuilders({ W: 800, H: 600, bitmaps: [], pattern: registerTexture(await checkerBitmap()), shader: null });
    const pools: Record<string, unknown[]> = {};
    for (const k of ['solid', 'gradient', 'pattern']) pools[k] = Array.from({ length: n }, (_, i) => builders[k](i));
    const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (const k of Object.keys(pools)) for (let i = 0; i < 5; i++) renderer.render(pools[k], identity);
    gl.finish();
    Object.assign(globalThis, {
      __staging: {
        gl, renderer, pools, identity,
        glRenderer: String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
      },
    });
  }, { root: repoRoot, n: N });

  const glRenderer = await page.evaluate(() => (globalThis as unknown as { __staging: { glRenderer: string } }).__staging.glRenderer);
  console.log(`\nPaint staging — 800x600, dpr 1, ${N} rects a frame, on ${glRenderer}\n`);

  // Frame time through the read, and CPU time to issue, interleaved by kind.
  const timed: Record<string, { frame: number[]; issue: number[]; draws: number }> = {};
  for (const k of KINDS) timed[k] = { frame: [], issue: [], draws: 0 };
  const total = RUNS * KINDS.length;
  let index = 0;
  for (let r = 1; r <= RUNS; r++) {
    const res = await page.evaluate(async ({ root, kinds }) => {
      const s = (globalThis as unknown as { __staging: {
        gl: WebGL2RenderingContext; renderer: { render(c: unknown[], m: Float32Array): void; lastFrameStats(): { drawCalls: number } };
        pools: Record<string, unknown[]>; identity: Float32Array;
      } }).__staging;
      const { timeInterleaved, drain } = await import(/* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/frameTiming.ts`);
      const frames = await timeInterleaved(s.gl, kinds.map((k) => ({ id: k, frame: () => s.renderer.render(s.pools[k], s.identity) })));
      const issue: Record<string, number> = {};
      const draws: Record<string, number> = {};
      for (const k of kinds) {
        const xs: number[] = [];
        for (let i = 0; i < 40; i++) {
          await new Promise((res2) => setTimeout(res2, 0));
          drain(s.gl);
          const t0 = performance.now();
          s.renderer.render(s.pools[k], s.identity);
          xs.push(performance.now() - t0);
          drain(s.gl);
        }
        xs.sort((a, b) => a - b);
        issue[k] = xs[xs.length >> 1];
        draws[k] = s.renderer.lastFrameStats().drawCalls;
      }
      return { frame: Object.fromEntries(kinds.map((k) => [k, frames[k].net])), issue, draws };
    }, { root: repoRoot, kinds: [...KINDS] });
    for (const k of KINDS) {
      timed[k].frame.push(res.frame[k]);
      timed[k].issue.push(res.issue[k]);
      timed[k].draws = res.draws[k];
      index++;
      console.log(`  ${String(index).padStart(2)}/${total}  run ${r}  ${k.padEnd(8)} ${res.frame[k].toFixed(3).padStart(7)} ms/frame  ${res.issue[k].toFixed(3).padStart(7)} ms to issue`);
    }
  }

  // A CPU profile of each kind's issuing, apart from the timing.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
  const profiles: Record<string, Map<string, number>> = {};
  for (const k of KINDS) {
    await cdp.send('Profiler.start');
    await page.evaluate(async ({ kind, frames }) => {
      const s = (globalThis as unknown as { __staging: {
        gl: WebGL2RenderingContext; renderer: { render(c: unknown[], m: Float32Array): void };
        pools: Record<string, unknown[]>; identity: Float32Array;
      } }).__staging;
      const px = new Uint8Array(4);
      for (let i = 0; i < frames; i++) {
        s.renderer.render(s.pools[kind], s.identity);
        s.gl.readPixels(0, 0, 1, 1, s.gl.RGBA, s.gl.UNSIGNED_BYTE, px);
        if (i % 8 === 7) await new Promise((res) => setTimeout(res, 0));
      }
    }, { kind: k, frames: PROFILED_FRAMES });
    const { profile } = await cdp.send('Profiler.stop') as unknown as { profile: Profile };
    profiles[k] = selfTimes(profile);
  }

  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  const perCmd = (ms: number) => (ms * 1000) / N;
  console.log('\n| kind | us/command, frame | us/command, issue | draws |');
  console.log('|---|---:|---:|---:|');
  for (const k of KINDS) {
    console.log(`| ${k} | ${perCmd(med(timed[k].frame)).toFixed(2).padStart(6)} | ${perCmd(med(timed[k].issue)).toFixed(2).padStart(6)} | ${String(timed[k].draws).padStart(3)} |`);
  }
  for (const k of KINDS) {
    const rows = [...profiles[k].entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP);
    console.log(`\n${k}: self time per command under the profiler, us (${PROFILED_FRAMES} frames)`);
    for (const [fn, ms] of rows) console.log(`  ${((ms * 1000) / (PROFILED_FRAMES * N)).toFixed(3).padStart(7)}  ${fn}`);
  }

  expect(errors, errors.join('\n')).toEqual([]);
  for (const k of KINDS) expect(timed[k].draws, `${k} should stay in one run`).toBeLessThanOrEqual(2);

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  for (const k of KINDS) {
    const fns: Record<string, ReturnType<typeof metric>> = {};
    for (const [fn, ms] of [...profiles[k].entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
      fns[fn] = metric((ms * 1000) / (PROFILED_FRAMES * N), 'us', `self time per command over ${PROFILED_FRAMES} profiled frames`);
    }
    run.item(k, {
      perCommand: metric(perCmd(med(timed[k].frame)), 'us', `median of ${RUNS} runs of a frame through its read, per command`, timed[k].frame.map(perCmd)),
      issuePerCommand: metric(perCmd(med(timed[k].issue)), 'us', `median of ${RUNS} runs of the median of 40 issues with the GPU drained, per command`, timed[k].issue.map(perCmd)),
      drawCalls: metric(timed[k].draws, 'count', 'one untimed frame'),
      ...fns,
    });
  }
  run.write();
});
