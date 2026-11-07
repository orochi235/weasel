/**
 * Element targets animated by one weasel animator, shown from the main thread against handed to
 * `Element.animate`: the frame rate each holds as the count of concurrent animations grows.
 *
 * **Two frame rates per cell.** The page's own (rAF intervals, from an untraced window) is the
 * main thread's. The compositor's is the `DrawFrame` events a Chromium trace records in the page's
 * renderer over a second window: a compositor animation draws frames the main thread never sees,
 * so the page's own rate cannot speak for it. On the main-thread path the two agree, since every
 * frame there waits on the main thread.
 *
 * **ABBA order.** Each count runs `main compositor compositor main`, reversed on the next pass.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserFingerprint } from './lib/fingerprint';
import { metric, rounds, startRun } from './lib/result';
import { markWindow, parseTrace } from './lib/trace';
import type { Approach, Cell, FrameStats } from './lib/compositorHandoff.page';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const ALL_COUNTS = [500, 1000, 2000, 4000, 6000];
/** `CH_COUNTS=2000,6000` narrows the sweep. */
const only = process.env.CH_COUNTS?.split(',').map(Number).filter(Number.isFinite);
const COUNTS = only?.length ? only : ALL_COUNTS;
const FRAMES = Number(process.env.CH_FRAMES ?? 120);
const WARMUP = 30;
const PASSES = rounds(2);
const CATEGORIES = ['toplevel', 'blink.user_timing', 'devtools.timeline', 'disabled-by-default-devtools.timeline.frame'];

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>compositor handoff</title>
<style>
  html, body { margin: 0; background: #101418; overflow: hidden; }
  #stage { position: absolute; left: 0; top: 0; width: 1280px; height: 800px; }
  .dot { position: absolute; width: 10px; height: 10px; border-radius: 5px; background: #8ecae6; }
</style></head>
<script type="module">
  import RefreshRuntime from '/weasel/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
  window.__vite_plugin_react_preamble_installed__ = true;
</script>
<body><div id="stage"></div></body></html>`;

interface Sample extends Cell {
  pass: number;
  /** Mean rAF interval of the untraced window, ms. */
  rafInterval: number;
  /** Intervals over 25 ms in it: a 60 Hz vsync skipped. */
  rafMissed: number;
  /** DrawFrame events a second in the traced window. */
  drawFps: number;
  drawFrames: number;
  traceMs: number;
  onCompositor: number;
  live: number;
  load1: number;
  intervals: number[];
}

type PageApi = {
  setup(c: Cell): Promise<{ painted: boolean }>;
  measure(n: number, mark: string | null): Promise<FrameStats>;
  teardown(): void;
};
const call = <K extends keyof PageApi>(page: Page, k: K, ...args: Parameters<PageApi[K]>) => page.evaluate(
  ([key, a]) => ((globalThis as unknown as { __ch: Record<string, (...x: unknown[]) => unknown> }).__ch[key as string]!)(...(a as unknown[])),
  [k, args] as const,
) as Promise<Awaited<ReturnType<PageApi[K]>>>;

/** DrawFrame events in the marked window, in the renderer that made the marks. */
function drawFrames(buf: Buffer): { frames: number; ms: number } {
  const trace = parseTrace(buf);
  const { t0, t1, pid } = markWindow(trace, 'ch-start', 'ch-end');
  const frames = trace.events.filter((e) => e.name === 'DrawFrame' && e.pid === pid && e.ts >= t0 && e.ts <= t1).length;
  return { frames, ms: (t1 - t0) / 1000 };
}

async function traced(page: Page, browser: Browser) {
  await browser.startTracing(page, { categories: CATEGORIES });
  const stats = await call(page, 'measure', FRAMES, 'ch');
  const buf = await browser.stopTracing();
  return { stats, ...drawFrames(buf) };
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const fmt = (x: number, w = 6, d = 1) => x.toFixed(d).padStart(w);

test('compositor handoff: frame rate against concurrent count', async ({ page, browser, browserName }) => {
  const plan: (Cell & { pass: number })[] = [];
  for (let pass = 1; pass <= PASSES; pass++) {
    for (const count of COUNTS) {
      const ab: Approach[] = pass % 2 ? ['main', 'compositor'] : ['compositor', 'main'];
      for (const approach of [...ab, ...[...ab].reverse()]) plan.push({ approach, count, pass });
    }
  }
  test.setTimeout(120_000 + plan.length * 30_000);
  const run = startRun('compositor-handoff', {
    counts: COUNTS, frames: FRAMES, warmup: WARMUP, passes: PASSES, viewport: '1280x800', order: 'ABBA per count, reversed on alternate passes',
  });
  const errors: string[] = [];
  const hmrNoise = /websocket|\[vite\]/i;
  page.on('console', (m) => { if (m.type() === 'error' && !hmrNoise.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await page.route('**/weasel/__perf/compositor-handoff', (r) => r.fulfill({ contentType: 'text/html', body: PAGE }));
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto('/weasel/__perf/compositor-handoff');
      await page.evaluate(async (root) => {
        (globalThis as { __ch?: unknown }).__ch = await import(/* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/compositorHandoff.page.ts`);
      }, repoRoot);
      break;
    } catch (e) {
      if (attempt === 5 || !/Execution context was destroyed|interrupted by another navigation/.test((e as Error).message)) throw e;
      await page.waitForTimeout(2000);
    }
  }
  console.log(`compositor handoff — ${plan.length} measurements, ${FRAMES} frames each; load ${os.loadavg().map((x) => x.toFixed(1)).join(' ')} on ${os.cpus().length} cores`);

  const samples: Sample[] = [];
  const unpainted: string[] = [];
  for (const [i, cell] of plan.entries()) {
    const { painted } = await call(page, 'setup', { approach: cell.approach, count: cell.count });
    if (!painted) unpainted.push(`${cell.approach} ${cell.count}`);
    await call(page, 'measure', WARMUP, null);
    const free = await call(page, 'measure', FRAMES, null);
    const t = await traced(page, browser);
    const s: Sample = {
      ...cell,
      rafInterval: mean(free.intervals),
      rafMissed: free.intervals.filter((x) => x > 25).length,
      drawFps: t.frames / (t.ms / 1000),
      drawFrames: t.frames,
      traceMs: t.ms,
      onCompositor: t.stats.onCompositor,
      live: t.stats.live,
      load1: os.loadavg()[0]!,
      intervals: free.intervals.map((x) => +x.toFixed(3)),
    };
    samples.push(s);
    console.log(
      `  ${String(i + 1).padStart(3)}/${plan.length}  pass ${cell.pass}  ${cell.approach.padEnd(10)} ${String(cell.count).padStart(5)}`
      + `  page ${fmt(1000 / s.rafInterval)} fps (missed ${String(s.rafMissed).padStart(3)})  drawn ${fmt(s.drawFps)} fps`
      + `  on compositor ${String(s.onCompositor).padStart(5)}/${String(s.live).padStart(5)}  load ${fmt(s.load1, 5)}`,
    );
    console.log(`onto: progress ${i + 1}/${plan.length}`);
  }
  await call(page, 'teardown');

  expect(errors).toEqual([]);
  expect(unpainted, 'a cell that paints nothing measures free').toEqual([]);
  for (const s of samples) {
    expect(s.drawFrames, `${s.approach} ${s.count}: the trace recorded no DrawFrame`).toBeGreaterThan(0);
    expect(s.onCompositor, `${s.approach} ${s.count}: runs on the compositor`).toBe(s.approach === 'compositor' ? s.count : 0);
  }

  run.machine(await browserFingerprint(page, browser, browserName));
  const lines = ['', '| count | main: page / drawn fps | compositor: page / drawn fps |', '|---:|---:|---:|'];
  for (const count of COUNTS) {
    const cells = (['main', 'compositor'] as const).map((approach) => {
      const ss = samples.filter((s) => s.count === count && s.approach === approach);
      const page = ss.map((s) => +(1000 / s.rafInterval).toFixed(2));
      const drawn = ss.map((s) => +s.drawFps.toFixed(2));
      run.item(`${approach} ${count}`, {
        pageFps: metric(med(page), 'fps', `median of ${ss.length} untraced windows of ${FRAMES} frames, 1000 / mean rAF interval`, page),
        drawnFps: metric(med(drawn), 'fps', `median of ${ss.length} traced windows, DrawFrame events a second in the page's renderer`, drawn),
        missed: metric(med(ss.map((s) => s.rafMissed)), 'count', 'median of untraced windows, rAF intervals over 25 ms', ss.map((s) => s.rafMissed)),
        load1: metric(med(ss.map((s) => +s.load1.toFixed(2))), 'load', 'median 1-minute load as each sample finished', ss.map((s) => +s.load1.toFixed(2))),
      }, { approach, count, intervals: ss.map((s) => s.intervals) });
      return `${fmt(med(page))} / ${fmt(med(drawn))}`;
    });
    lines.push(`| ${String(count).padStart(5)} | ${cells[0]} | ${cells[1]} |`);
  }
  console.log(lines.join('\n'));
  run.write();
});
