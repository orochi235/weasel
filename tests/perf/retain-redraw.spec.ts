/**
 * What redrawing retained surfaces costs by the side of the tile they are drawn
 * in, context by context: `N` world layers of `M` commands, each drawn again
 * with its pan margin every frame (the view jumps past it and back), as
 * `retain-pan.spec.ts`'s `retainedRedraw` draws them.
 *
 * Each of `WEASEL_PERF_CONTEXTS` fresh WebGL contexts (default 6) holds a
 * renderer per tile side in `WEASEL_PERF_TILES` (default `none,1024`) and times
 * them interleaved: the frame through a one-pixel read, `render()`'s own time,
 * and timer-query GPU time per sample. Then, per tile side, a CPU profile of
 * `PROFILED` frames summed by function, and with `WEASEL_PERF_TRACE=1` a
 * Chromium trace of as many, summed by thread and by event. A redraw at one
 * tile side has cost two different amounts in different contexts, so every
 * context's figures are kept apart. `WEASEL_PERF_LAYERS`, `WEASEL_PERF_CMDS`
 * and `WEASEL_PERF_BUDGET` (MiB) override the rest. This reports; it does not
 * gate.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isolate } from './lib/isolate';
import { metric, startRun } from './lib/result';
import { selfTimes, type Profile } from './lib/cpuProfile';
import { busy, parseTrace, selfTimeStats, type SelfTime } from './lib/trace';
import type { Setup, VariantTiming } from './lib/retainRedraw.page';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const W = 1280;
const H = 800;
const DPR = 2;
const num = (v: string | undefined, d: number) => (v ? Number(v) : d);
const LAYERS = num(process.env.WEASEL_PERF_LAYERS, 4);
const CMDS = num(process.env.WEASEL_PERF_CMDS, 1000);
const CONTEXTS = num(process.env.WEASEL_PERF_CONTEXTS, 6);
const TILES = (process.env.WEASEL_PERF_TILES ?? 'none,1024').split(',').map((t) => (t === 'none' ? 0 : Number(t)));
const BUDGET = Number(process.env.WEASEL_PERF_BUDGET) * 1024 * 1024 || null;
const TRACE = process.env.WEASEL_PERF_TRACE === '1';
const SAMPLES = 40;
const PROFILED = 30;
const TOP = 25;

const CATEGORIES = [
  'toplevel', 'blink.user_timing', 'gpu', 'gpu.service', 'disabled-by-default-gpu.service',
  'gpu.angle', 'disabled-by-default-gpu.angle', 'viz', 'ipc', 'mojom', 'v8',
];

const tileName = (t: number) => (t === 0 ? 'none' : String(t));
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const call = <T>(page: Page, fn: string, arg?: unknown) => page.evaluate(
  ([f, a]) => (globalThis as unknown as { __rr: Record<string, (x: unknown) => unknown> }).__rr[f](a),
  [fn, arg] as const,
) as Promise<T>;

/** Per-frame self time by event on each thread of renderer and GPU processes,
 *  and how busy each thread was, between the page's `rr-start` and `rr-end`. */
function traceSummary(buf: Buffer, frames: number): Record<string, unknown> {
  const trace = parseTrace(buf);
  const start = trace.events.find((e) => e.name === 'rr-start')?.ts;
  const end = trace.events.find((e) => e.name === 'rr-end')?.ts;
  if (start === undefined || end === undefined) return { error: 'no marks' };
  const out: Record<string, unknown> = {};
  for (const [k, list] of trace.byThread) {
    const pid = Number(k.split(':')[0]);
    const proc = trace.processName.get(pid) ?? String(pid);
    if (!/renderer|gpu/i.test(proc)) continue;
    const on = busy(list, start, end);
    if (on < 0.02 * (end - start)) continue;
    const self = selfTimeStats(list, start, end, new Map<string, SelfTime>());
    const rows = [...self].sort((a, b) => b[1].dur - a[1].dur).slice(0, 15)
      .map(([name, s]) => ({ name, usPerFrame: +(s.dur / frames).toFixed(1), cpuUsPerFrame: +(s.tdur / frames).toFixed(1), perFrame: +(s.count / frames).toFixed(2) }));
    out[`${proc} / ${trace.threadName.get(k) ?? k}`] = { busyUsPerFrame: +(on / frames).toFixed(1), self: rows };
  }
  return out;
}

test.setTimeout(3_600_000);

test('retained redraw by tile side, context by context', async ({ page, browser, browserName }) => {
  const run = startRun('retain-redraw', {
    viewport: `${W}x${H}`, dpr: DPR, layers: LAYERS, cmds: CMDS, contexts: CONTEXTS, tiles: TILES.map(tileName),
    budgetMiB: BUDGET ? BUDGET / 1024 / 1024 : 'default', samples: SAMPLES, profiled: PROFILED, trace: TRACE,
  });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');
  await page.evaluate(async (root) => {
    (globalThis as { __rr?: unknown }).__rr = await import(/* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/retainRedraw.page.ts`);
  }, repoRoot);
  const setup: Setup = { root: repoRoot, w: W, h: H, dpr: DPR, layers: LAYERS, cmds: CMDS, tiles: TILES, budget: BUDGET };
  const { glRenderer, timer } = await call<{ glRenderer: string; timer: boolean }>(page, 'init', setup);
  console.log(`\nRetained redraw — ${LAYERS} x ${CMDS} at ${W}x${H} dpr ${DPR}, on ${glRenderer}; timer query ${timer ? 'on' : 'absent'}`);
  console.log(`${CONTEXTS} contexts x tiles ${TILES.map(tileName).join(',')}\n`);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  const total = CONTEXTS * TILES.length;
  let index = 0;
  const rows: Array<{ context: number; tile: number; net: number; cpu: number; gpu: number | null }> = [];
  for (let c = 1; c <= CONTEXTS; c++) {
    await call(page, 'openContext');
    const timed = await call<VariantTiming[]>(page, 'timeContext', SAMPLES);
    for (const t of timed) {
      await cdp.send('Profiler.start');
      await call(page, 'runFrames', { tile: t.tile, n: PROFILED });
      const { profile } = await cdp.send('Profiler.stop') as unknown as { profile: Profile };
      const self = [...selfTimes(profile)].sort((a, b) => b[1] - a[1]).slice(0, TOP)
        .map(([fn, ms]) => ({ fn, msPerFrame: +(ms / PROFILED).toFixed(3) }));
      let traced: Record<string, unknown> | undefined;
      if (TRACE) {
        await browser.startTracing(page, { categories: CATEGORIES });
        await call(page, 'runFrames', { tile: t.tile, n: PROFILED });
        traced = traceSummary(await browser.stopTracing(), PROFILED);
      }
      const gpus = t.gpu.filter((x): x is number => x !== null);
      const row = { context: c, tile: t.tile, net: med(t.net), cpu: med(t.cpu), gpu: gpus.length ? med(gpus) : null };
      rows.push(row);
      index++;
      console.log(`  ${String(index).padStart(2)}/${total}  context ${c}  tile ${tileName(t.tile).padStart(4)}`
        + `  ${row.net.toFixed(3).padStart(7)} ms/frame  cpu ${row.cpu.toFixed(3).padStart(7)}`
        + `  gpu ${row.gpu === null ? '      -' : row.gpu.toFixed(3).padStart(7)}  draws ${String(t.drawCalls).padStart(4)}`
        + `  redrawn ${t.redrawn}  peak ${(t.peakBytes / 1024 / 1024).toFixed(1).padStart(6)} MiB`);
      console.log(`      profile, ms/frame: ${self.slice(0, 6).map((s) => `${s.msPerFrame.toFixed(2)} ${s.fn}`).join(' | ')}`);
      run.item(`c${c} tile ${tileName(t.tile)}`, {
        net: metric(row.net, 'ms', `median of ${SAMPLES} single-frame samples less the least frame that draws`, t.net),
        cpu: metric(row.cpu, 'ms', 'median renderer.render() time', t.cpu),
        ...(row.gpu === null ? {} : { gpu: metric(row.gpu, 'ms', 'median timer-query time of the frame', gpus) }),
        drawCalls: metric(t.drawCalls, 'count', 'draw calls in the last timed frame'),
        peakBytes: metric(t.peakBytes, 'bytes', 'most GPU memory retained surfaces held at the end of a timed frame'),
      }, { context: c, tile: tileName(t.tile), profile: self, ...(traced ? { trace: traced } : {}) });
    }
  }
  await call(page, 'closeContext');

  console.log('\n| context | ' + TILES.map((t) => `tile ${tileName(t)} ms | cpu | gpu`).join(' | ') + ' |');
  console.log('|---:|' + TILES.map(() => '---:|---:|---:').join('|') + '|');
  for (let c = 1; c <= CONTEXTS; c++) {
    const cells = TILES.map((t) => rows.find((r) => r.context === c && r.tile === t)!)
      .map((r) => `${r.net.toFixed(3).padStart(7)} | ${r.cpu.toFixed(3).padStart(7)} | ${r.gpu === null ? '      -' : r.gpu.toFixed(3).padStart(7)}`);
    console.log(`| ${String(c).padStart(2)} | ${cells.join(' | ')} |`);
  }
  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  run.write();
});
