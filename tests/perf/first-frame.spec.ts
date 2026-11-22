/**
 * What a weasel canvas's first frame costs on a cold GPU process: the time from a renderer being made
 * to its first frame being on screen, and how much of it is shader compiles.
 *
 * Every round launches its own browser, so no program the driver or Chromium cached in an earlier
 * round is there to be found, then times on one page:
 *
 *   - `frame/cold`   — `new WeaselRenderer` and its first `render` of a treemap-like scene (filled and
 *                      stroked rects, circles, a gradient, text labels), each frame followed by a
 *                      one-pixel readback so its time includes the GPU's. `ready` is how long after the
 *                      renderer was made the scene first drew in full; `block` is the longest task the
 *                      main thread ran meanwhile, from a `longtask` observer, as a page would see it.
 *   - `frame/reload` — the same, after reloading the page in that browser.
 *   - `frame/held`   — `frame/cold` in a browser of its own, the page holding each frame until the
 *                      renderer's `programsReady()`, as a host can so its first frame does not wait on compiles.
 *   - `program/<n>`  — each built-in program compiled alone, synchronously, on a fresh context:
 *                      the wait on its compile status and on its link status.
 *
 * Every GL call the renderer makes on the paths that build programs is timed at the context, so a
 * frame item says which of them the time went to (`gl.<call>`).
 *
 * macOS keeps every Metal library it compiles in a per-user cache that outlives the browser and its profile,
 * so on a machine that has drawn weasel before, a fresh browser still links its programs from that cache.
 * `WEASEL_PERF_COLD_METAL=1` gives every shader a `main` renamed for the round, wrapped by a real `main`,
 * so no source the driver sees has been compiled before: what a first visit, or a browser update, pays.
 *
 * Knobs: `WEASEL_PERF_ROUNDS` (default 5), `WEASEL_PERF_ITEMS` (`frame`, `program`), `WEASEL_PERF_COLD_METAL`.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { metric, rounds, startRun, type Metric } from './lib/result';
import { perfLaunchArgs } from './lib/launchArgs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { FIRST_FRAME_PAGE, type FrameSample, type ProgramSample } from './lib/firstFrame.page';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNS = rounds(5);
const ITEMS = (process.env.WEASEL_PERF_ITEMS ?? 'frame,program').split(',');
const URL_PATH = '/weasel/__perf/first-frame';
const COLD_METAL = process.env.WEASEL_PERF_COLD_METAL === '1';


test.setTimeout(1_800_000);

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Under `COLD_METAL`, rename every shader's `main` for this page's browser; a reload keeps the name, so it
 *  finds what the load before it compiled. */
const nonces = new WeakMap<object, string>();
async function coldShaders(page: Page): Promise<void> {
  if (!COLD_METAL) return;
  const key = page.context();
  if (!nonces.has(key)) nonces.set(key, Math.random().toString(36).slice(2));
  await page.evaluate((n) => (globalThis as unknown as { __coldShaders(n: string): void }).__coldShaders(n), nonces.get(key)!);
}

async function openPage(context: BrowserContext, errors: string[]): Promise<Page> {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));
  await page.route(`**${URL_PATH}`, (r) => r.fulfill({
    contentType: 'text/html',
    body: FIRST_FRAME_PAGE,
    headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'credentialless' },
  }));
  await page.goto(URL_PATH);
  await coldShaders(page);
  return page;
}

const frame = (page: Page, hold = false): Promise<FrameSample> => page.evaluate(
  ({ root, hold }) => (globalThis as unknown as { __firstFrame(r: string, h: boolean): Promise<FrameSample> }).__firstFrame(root, hold),
  { root: repoRoot, hold },
);

function log(r: number, samples: ReadonlyArray<readonly [string, FrameSample]>): void {
  for (const [label, s] of samples) {
    console.log(
      `  ${r + 1}/${RUNS}  frame/${label.padEnd(6)}  create ${s.createMs.toFixed(1).padStart(7)} ms`
      + `  first ${s.firstMs.toFixed(1).padStart(7)} ms  ready ${s.readyMs.toFixed(1).padStart(7)} ms`
      + `  block ${s.blockMs.toFixed(0).padStart(5)} ms  second ${s.secondMs.toFixed(1).padStart(6)} ms`
      + `  frames ${String(s.frames).padStart(3)}  links ${s.links} ${JSON.stringify(s.linked)}  parallel ${s.parallel}  held ${s.held}`,
    );
    console.log(`    gl ${JSON.stringify(Object.fromEntries(Object.entries(s.gl).map(([k, v]) => [k, +v.toFixed(1)])))}`);
  }
}

test('first frame: shader compiles on a cold GPU process', async ({ browser: fixture, baseURL }) => {
  const run = startRun('first-frame', { runs: RUNS, items: ITEMS, coldMetal: COLD_METAL });
  const errors: string[] = [];
  const frames: Record<'cold' | 'reload' | 'held', FrameSample[]> = { cold: [], reload: [], held: [] };
  const programs = new Map<string, ProgramSample[]>();

  /** A browser of its own, so nothing an earlier one compiled is cached in its GPU process. */
  const fresh = async (body: (page: Page, browser: Browser) => Promise<void>): Promise<void> => {
    const browser = await fixture.browserType().launch({ args: perfLaunchArgs, headless: true });
    try {
      const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await body(await openPage(context, errors), browser);
    } finally {
      await browser.close();
    }
  };

  for (let r = 0; r < RUNS; r++) {
    if (ITEMS.includes('frame')) {
      await fresh(async (page, browser) => {
        const cold = await frame(page);
        run.machine({ glRenderer: cold.glRenderer, browser: browser.version() });
        frames.cold.push(cold);
        await page.reload();
        await coldShaders(page);
        const reload = await frame(page);
        frames.reload.push(reload);
        log(r, [['cold', cold], ['reload', reload]]);
      });
      await fresh(async (page) => {
        const held = await frame(page, true);
        frames.held.push(held);
        log(r, [['held', held]]);
      });
    }
    if (ITEMS.includes('program')) {
      await fresh(async (page) => {
        const sample = await page.evaluate(
          (root) => (globalThis as unknown as { __programs(r: string): Promise<ProgramSample[]> }).__programs(root),
          repoRoot,
        );
        for (const p of sample) {
          if (!programs.has(p.name)) programs.set(p.name, []);
          programs.get(p.name)!.push(p);
          console.log(
            `  ${r + 1}/${RUNS}  program/${p.name.padEnd(18)}  compile ${p.compileMs.toFixed(1).padStart(7)} ms`
            + `  link ${p.linkMs.toFixed(1).padStart(7)} ms  total ${p.totalMs.toFixed(1).padStart(7)} ms  frag ${p.fragLength}`,
          );
        }
      });
    }
  }

  for (const [label, samples] of Object.entries(frames)) {
    if (samples.length === 0) continue;
    const m = (pick: (s: FrameSample) => number): Metric => {
      const xs = samples.map(pick);
      return metric(median(xs), 'ms', `median of ${xs.length} rounds`, xs);
    };
    const calls = new Set(samples.flatMap((s) => Object.keys(s.gl)));
    const gl = Object.fromEntries([...calls].map((c) => [`gl.${c}`, m((s) => s.gl[c] ?? 0)]));
    run.item(`frame/${label}`, {
      create: m((s) => s.createMs), first: m((s) => s.firstMs), ready: m((s) => s.readyMs),
      block: m((s) => s.blockMs), second: m((s) => s.secondMs),
      links: metric(median(samples.map((s) => s.links)), 'count', 'median', samples.map((s) => s.links)),
      ...gl,
    });
  }
  for (const [name, samples] of programs) {
    const m = (pick: (s: ProgramSample) => number): Metric => {
      const xs = samples.map(pick);
      return metric(median(xs), 'ms', `median of ${xs.length} rounds`, xs);
    };
    run.item(`program/${name}`, { compile: m((s) => s.compileMs), link: m((s) => s.linkMs), total: m((s) => s.totalMs) });
  }
  run.write();
  expect(errors).toEqual([]);
});
