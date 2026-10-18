/**
 * Why frames drawn back to back in one task slow down after about eight
 * (`README.md`, "Timing a frame"), on raw WebGL2 with no weasel in the page.
 * Each cell draws `frames` frames of `draws` one-rect draws and varies one
 * thing; it reports the median frame over the first eight (`early`) and from
 * the 24th on (`late`), and where the slowdown starts (`knee`).
 *
 * `WEASEL_B2B_BACKENDS` (default `metal,gl,swiftshader`) picks ANGLE backends;
 * every phase but `shape` runs on the first one only. `WEASEL_B2B_PHASES`
 * picks phases. This reports; it does not gate.
 */
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { metric, rounds, startRun, type Metric, type PerfRun } from './lib/result';
import { perfLaunchArgs } from './lib/launchArgs';
import { busy, byThread, parseTrace, selfTimes, threadNames, type SelfTime } from './lib/trace';
import type { Cell, CellResult } from './lib/backToBack.page';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNS = rounds(3);
const BACKENDS = (process.env.WEASEL_B2B_BACKENDS ?? 'metal,gl,swiftshader').split(',');
const PHASES = (process.env.WEASEL_B2B_PHASES ?? 'shape,sync,fill,gap,buffer,size,discard,timer,trace').split(',');

const BASE: Cell = {
  kind: 'subdata', draws: 512, perTask: 0, yieldBy: 'message', sync: 'read', spinMs: 0,
  preserveDrawingBuffer: true, target: 'default', attached: false, discard: false, gpuTimer: false,
  frames: 120, settleMs: 300,
};

const cells = (phase: string): Array<[string, Partial<Cell>]> => {
  switch (phase) {
    case 'shape': return (['subdata', 'uniform'] as const).flatMap((kind) => [
      [`${kind} 1/task timeout`, { kind, perTask: 1, yieldBy: 'timeout' }],
      [`${kind} 1/task message`, { kind, perTask: 1 }],
      [`${kind} 8/task message`, { kind, perTask: 8 }],
      [`${kind} all in one task`, { kind }],
    ] as Array<[string, Partial<Cell>]>);
    case 'sync': return (['finish', 'flush', 'none'] as const).map((sync) => [`sync ${sync}`, { sync }]);
    case 'gap': return [1, 3, 8].map((spinMs) => [`spin ${spinMs} ms`, { spinMs }]);
    case 'buffer': return [
      ['preserveDrawingBuffer false', { preserveDrawingBuffer: false }],
      ['fbo target', { target: 'fbo' }],
      ['fbo, preserveDrawingBuffer false', { target: 'fbo', preserveDrawingBuffer: false }],
      ['canvas in the document', { attached: true }],
      ['ring offsets', { kind: 'ring' }],
    ];
    case 'size': return [64, 2048].map((draws) => [`${draws} draws`, { draws }]);
    case 'fill': return [
      ...[64, 128, 512, 2048].map((draws): [string, Partial<Cell>] => [`flush, ${draws} draws`, { sync: 'flush', draws }]),
      ['flush, 1/task timeout', { sync: 'flush', perTask: 1, yieldBy: 'timeout' }],
      ['flush, 4/task timeout', { sync: 'flush', perTask: 4, yieldBy: 'timeout' }],
    ];
    case 'discard': return [['rasterizer discard', { discard: true }]];
    case 'timer': return [['timer 1/task message', { gpuTimer: true, perTask: 1 }], ['timer all in one task', { gpuTimer: true }]];
    default: return [];
  }
};

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** First frame past the opening few that costs over 3x their median; -1 if none. */
function knee(frames: number[]): number {
  const base = med(frames.slice(0, 4));
  for (let i = 4; i < frames.length; i++) if (frames[i] > 3 * base && frames[i + 1] > 3 * base) return i;
  return -1;
}

function summarize(r: CellResult): Record<string, Metric> {
  const early = r.frames.slice(0, 8); const late = r.frames.slice(24);
  const k = knee(r.frames);
  const out: Record<string, Metric> = {
    early: metric(med(early), 'ms', 'median of frames 0-7', r.frames),
    late: metric(med(late), 'ms', 'median of frames 24 on'),
    knee: metric(k, 'count', 'first frame over 3x the opening median, -1 for none'),
    kneeAt: metric(k < 0 ? -1 : r.frames.slice(0, k).reduce((a, b) => a + b, 0), 'ms', 'frame time summed before the knee'),
    perFrame: metric(r.totalMs / r.frames.length, 'ms', 'wall from first frame to last task end, per frame'),
    jsEarly: metric(med(r.js.slice(0, 8)), 'ms', 'fixed JS loop before each frame, frames 0-7', r.js),
    jsLate: metric(med(r.js.slice(24)), 'ms', 'fixed JS loop before each frame, frames 24 on'),
  };
  const gpu = r.gpu?.filter((x): x is number => x !== null) ?? [];
  if (r.gpu && gpu.length === r.gpu.length) {
    out.gpuEarly = metric(med(r.gpu.slice(0, 8) as number[]), 'ms', 'timer query, frames 0-7', gpu);
    out.gpuLate = metric(med(r.gpu.slice(24) as number[]), 'ms', 'timer query, frames 24 on');
  }
  return out;
}

const f = (x: number, w = 6) => x.toFixed(2).padStart(w);

function line(label: string, m: Record<string, Metric>): string {
  const g = m.gpuEarly ? `  gpu ${f(m.gpuEarly.value)} → ${f(m.gpuLate.value)}` : '';
  return `${label.padEnd(36)} early ${f(m.early.value)}  late ${f(m.late.value)}  knee ${String(m.knee.value).padStart(4)}`
    + ` @${f(m.kneeAt.value, 7)} ms  per frame ${f(m.perFrame.value)}  js ${f(m.jsEarly.value, 5)} → ${f(m.jsLate.value, 5)}${g}`;
}

async function openPage(browser: Browser, baseURL: string): Promise<Page> {
  const page = await browser.newPage({ baseURL });
  await page.route((url) => url.pathname === '/__b2b/', (route) => route.fulfill({
    status: 200, contentType: 'text/html',
    headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'credentialless' },
    body: '<!doctype html><meta charset="utf-8"><title>b2b</title><body style="margin:0"></body>',
  }));
  await page.goto('/__b2b/');
  const isolated = await page.evaluate(async (root) => {
    (globalThis as { __b2b?: unknown }).__b2b = await import(/* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/backToBack.page.ts`);
    return globalThis.crossOriginIsolated;
  }, repoRoot);
  expect(isolated).toBe(true);
  return page;
}

const runCell = (page: Page, cell: Cell) => page.evaluate((c) =>
  (globalThis as unknown as { __b2b: { runCell(c: Cell): Promise<CellResult> } }).__b2b.runCell(c), cell);

const CATEGORIES = [
  'toplevel', 'blink.user_timing', 'gpu', 'gpu.service', 'disabled-by-default-gpu.service',
  'gpu.angle', 'disabled-by-default-gpu.angle', 'viz', 'cc', 'ipc', 'mojom',
];

/** Per-name self time on the threads of processes `proc` matches, per frame, over frames [a, b). */
function threadSelf(buf: Buffer, proc: RegExp, a: number, b: number): { perFrame: Map<string, SelfTime>; busyFrac: Map<string, number> } {
  const events = parseTrace(buf);
  const names = threadNames(events);
  const marks = new Map<number, number>();
  for (const e of events) {
    const m = /^b2b-f(\d+)$/.exec(e.name);
    if (m && !marks.has(Number(m[1]))) marks.set(Number(m[1]), e.ts);
  }
  const end = events.find((e) => e.name === 'b2b-end')?.ts;
  const edge = (k: number) => marks.get(k) ?? end!;
  const perFrame = new Map<string, SelfTime>(); const busyFrac = new Map<string, number>();
  for (const [k, list] of byThread(events)) {
    if (!proc.test(names.process.get(Number(k.split(':')[0])) ?? '')) continue;
    const thread = names.thread.get(k) ?? k;
    let wall = 0; let on = 0;
    for (let i = a; i < b; i++) {
      selfTimes(list, edge(i), edge(i + 1), perFrame);
      wall += edge(i + 1) - edge(i); on += busy(list, edge(i), edge(i + 1));
    }
    if (on > 0.02 * wall) busyFrac.set(thread, on / wall);
  }
  for (const s of perFrame.values()) { s.dur /= b - a; s.tdur /= b - a; s.count /= b - a; }
  return { perFrame, busyFrac };
}

function printSelf(buf: Buffer, proc: RegExp): Record<string, unknown> {
  const fast = threadSelf(buf, proc, 1, 7); const slow = threadSelf(buf, proc, 40, 79);
  for (const [t, frac] of slow.busyFrac) console.log(`      ${(frac * 100).toFixed(0).padStart(3)}% busy late (${((fast.busyFrac.get(t) ?? 0) * 100).toFixed(0)}% early)  ${t}`);
  const rows = [...slow.perFrame].sort((x, y) => y[1].dur - x[1].dur).slice(0, 10)
    .map(([name, late]) => ({ name, early: fast.perFrame.get(name) ?? { dur: 0, tdur: 0, count: 0 }, late }));
  console.log('      self us/frame early → late (cpu early → late) [calls/frame]');
  for (const { name, early, late } of rows) {
    console.log(`      ${early.dur.toFixed(0).padStart(6)} → ${late.dur.toFixed(0).padStart(6)}  (${early.tdur.toFixed(0).padStart(6)} → ${late.tdur.toFixed(0).padStart(6)})`
      + `  [${early.count.toFixed(0)} → ${late.count.toFixed(0)}]  ${name}`);
  }
  return { self: rows, busyLate: Object.fromEntries(slow.busyFrac), busyEarly: Object.fromEntries(fast.busyFrac) };
}

const TRACED: Array<[string, Partial<Cell>]> = [
  ['all in one task', {}], ['1/task message', { perTask: 1 }], ['flush, all in one task', { sync: 'flush' }],
];

async function tracePhase(page: Page, browser: Browser, run: PerfRun, backend: string): Promise<void> {
  for (const [label, over] of TRACED) {
    await browser.startTracing(page, { categories: CATEGORIES });
    const r = await runCell(page, { ...BASE, ...over, frames: 80 });
    const buf = await browser.stopTracing();
    const m = summarize(r);
    console.log(`  trace ${line(label, m)}`);
    console.log('    GPU process');
    const gpu = printSelf(buf, /gpu/i);
    console.log('    renderer');
    const renderer = printSelf(buf, /renderer/i);
    run.item(`${backend} trace ${label}`, m, { gpu, renderer });
  }
}

async function measureBackend(backend: string, baseURL: string, first: boolean): Promise<void> {
  const args = perfLaunchArgs.filter((a) => !a.startsWith('--use-angle='));
  args.push(`--use-angle=${backend}`);
  if (backend === 'swiftshader') args.push('--enable-unsafe-swiftshader');
  const browser = await chromium.launch({ headless: true, args });
  try {
    const page = await openPage(browser, baseURL);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const glRenderer = await page.evaluate(() => (globalThis as unknown as { __b2b: { rendererName(): string } }).__b2b.rendererName());
    console.log(`\n${backend}: ${glRenderer}`);
    const phases = first ? PHASES : PHASES.filter((p) => p === 'shape');
    const run = startRun('back-to-back', { backend, phases, runs: RUNS, base: BASE });
    for (let r = 1; r <= RUNS; r++) {
      for (const phase of phases.filter((p) => p !== 'trace')) {
        for (const [label, over] of cells(phase)) {
          const m = summarize(await runCell(page, { ...BASE, ...over }));
          console.log(`  ${r}/${RUNS} ${phase.padEnd(7)} ${line(label, m)}`);
          run.item(`${backend} ${phase} ${label} r${r}`, m, over);
        }
      }
    }
    if (phases.includes('trace')) await tracePhase(page, browser, run, backend);
    expect(errors).toEqual([]);
    run.machine({ glRenderer, browser: `chromium ${browser.version()}` });
    console.log(`  wrote ${run.write()}`);
  } finally {
    await browser.close();
  }
}

test.setTimeout(3_600_000);

test('back-to-back frames: what slows a frame drawn in the same task as the last', async ({}, info) => {
  const baseURL = String(info.project.use.baseURL);
  for (const [i, backend] of BACKENDS.entries()) await measureBackend(backend, baseURL, i === 0);
});
