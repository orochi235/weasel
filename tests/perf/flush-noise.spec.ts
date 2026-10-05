/**
 * Where the run-to-run spread in a per-flush figure comes from.
 *
 * `clip-cost.spec.ts` and `flush-anatomy.spec.ts` time a block of frames with
 * one `gl.finish()` at the end and divide. That wall time is whichever of
 * three things is slowest: the page's JS issuing the frame, the GPU process
 * decoding the command buffer into Metal, or the GPU itself. This spec times
 * the same 512-flush frame those two do, four ways, so the spread can be
 * pinned to one of them:
 *
 *   - `block`: the existing method, repeated, to reproduce the spread.
 *   - `split`: one frame at a time, `render()` and `finish()` timed apart —
 *     the first is the page's share, the second what it waits on.
 *   - `gpu`: `EXT_disjoint_timer_query_webgl2` around single frames.
 *   - `trace`: a Chromium trace of blocks, for the GPU process's own busy
 *     time and where it goes.
 *
 * `WEASEL_NOISE_PHASES` picks phases (comma-separated); all run by default.
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const N = 512;
const RUNS = rounds(8);
const PHASES = (process.env.WEASEL_NOISE_PHASES ?? 'block,split,gpu,trace').split(',');
const VARIANTS = ['rect-plain', 'rect-cmbreak'] as const;

interface TraceEvent {
  ph: string; name: string; pid: number; tid: number; ts: number; dur?: number;
  args?: Record<string, unknown>;
}

function busy(events: TraceEvent[], t0: number, t1: number): number {
  const spans = events
    .map((e) => [Math.max(e.ts, t0), Math.min(e.ts + (e.dur ?? 0), t1)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let sum = 0; let a0 = -1; let b0 = -1;
  for (const [a, b] of spans) {
    if (a > b0) { if (b0 > a0) sum += b0 - a0; a0 = a; b0 = b; } else if (b > b0) b0 = b;
  }
  if (b0 > a0) sum += b0 - a0;
  return sum;
}

function selfTimes(events: TraceEvent[], t0: number, t1: number): Map<string, number> {
  const inside = events
    .filter((e) => e.ts >= t0 && e.ts + (e.dur ?? 0) <= t1)
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  const self = new Map<string, number>();
  const stack: Array<{ e: TraceEvent; end: number; child: number }> = [];
  const close = (f: { e: TraceEvent; child: number }) => {
    self.set(f.e.name, (self.get(f.e.name) ?? 0) + Math.max(0, (f.e.dur ?? 0) - f.child));
  };
  for (const e of inside) {
    const end = e.ts + (e.dur ?? 0);
    while (stack.length && stack[stack.length - 1].end <= e.ts) close(stack.pop()!);
    if (stack.length) stack[stack.length - 1].child += e.dur ?? 0;
    stack.push({ e, end, child: 0 });
  }
  while (stack.length) close(stack.pop()!);
  return self;
}

interface ThreadBusy { name: string; busyUs: number; top: [string, number][] }

function analyzeTrace(buf: Buffer): { wallUs: number; threads: ThreadBusy[] } {
  const parsed = JSON.parse(buf.toString('utf8')) as { traceEvents?: TraceEvent[] } | TraceEvent[];
  const events = Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
  const tname = new Map<string, string>();
  const pname = new Map<number, string>();
  for (const e of events) {
    if (e.ph !== 'M') continue;
    const n = String((e.args as { name?: string } | undefined)?.name ?? '');
    if (e.name === 'thread_name') tname.set(`${e.pid}:${e.tid}`, n);
    if (e.name === 'process_name') pname.set(e.pid, n);
  }
  const start = events.find((e) => e.name === 'noise-start');
  const end = events.find((e) => e.name === 'noise-end');
  if (!start || !end) throw new Error('trace holds no noise-start / noise-end marks');
  const t0 = start.ts; const t1 = end.ts;
  const byThread = new Map<string, TraceEvent[]>();
  for (const e of events) {
    if (e.ph !== 'X' || e.dur === undefined) continue;
    const k = `${e.pid}:${e.tid}`;
    (byThread.get(k) ?? byThread.set(k, []).get(k)!).push(e);
  }
  const threads: ThreadBusy[] = [];
  for (const [k, list] of byThread) {
    const pid = Number(k.split(':')[0]);
    const b = busy(list, t0, t1);
    if (b < (t1 - t0) * 0.02) continue;
    const top = [...selfTimes(list, t0, t1)].sort((x, y) => y[1] - x[1]).slice(0, 8);
    threads.push({ name: `${pname.get(pid) ?? pid}/${tname.get(k) ?? k}`, busyUs: b, top });
  }
  threads.sort((a, b) => b.busyUs - a.busyUs);
  return { wallUs: t1 - t0, threads };
}

test.setTimeout(1_800_000);

test('flush noise: which side of the command buffer the spread lives on', async ({ page, browser, browserName }) => {
  const run = startRun('flush-noise', { viewport: '800x600', dpr: 1, flushesPerFrame: N, runs: RUNS, phases: PHASES });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const header = await page.evaluate(async ({ root, n }) => {
    const { WeaselRenderer } = await import(
      /* @vite-ignore */ `/weasel/@fs${root}/packages/core/src/renderer/index.ts`
    );
    const W = 800; const H = 600;
    const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const renderer = new WeaselRenderer({ gl, canvas, width: W, height: H, dpr: 1 });
    const px = (i: number) => 20 + ((i * 37) % (W - 160));
    const py = (i: number) => 20 + ((i * 53) % (H - 160));
    const leaf = (i: number) => ({
      kind: 'path',
      path: { kind: 'rect', x: px(i), y: py(i), width: 36, height: 36 },
      fill: { fill: 'solid', color: i % 2 ? '#3366cc' : '#cc6633' },
    });
    const cm = (i: number) => {
      const b = i % 2 === 0 ? 0.002 : 0.004;
      return [1, 0, 0, 0, b, 0, 1, 0, 0, b, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
    };
    const leaves: unknown[] = [];
    for (let i = 0; i < n; i++) leaves.push(leaf(i));
    const frames: Record<string, unknown[]> = {
      'rect-plain': leaves,
      'rect-cmbreak': leaves.map((l, i) => ({ kind: 'group', colorMatrix: cm(i), children: [l] })),
    };
    const collect = (globalThis as { gc?: (o?: unknown) => void }).gc;
    const gcNow = () => { if (collect) { collect({ type: 'major', execution: 'sync' }); collect({ type: 'major', execution: 'sync' }); } };
    const render = (id: string) => renderer.render(frames[id], identity);
    for (const id of Object.keys(frames)) for (let i = 0; i < 5; i++) render(id);
    gl.finish();
    renderer.render(frames['rect-cmbreak'], identity);
    const draws = renderer.lastFrameStats().drawCalls;

    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as
      { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;

    const api = {
      /** The existing method: a ~150 ms block, one finish at the end. */
      block(id: string): number {
        for (let i = 0; i < 3; i++) render(id);
        gl.finish();
        const timeBlock = (f: number) => {
          gcNow();
          render(id); gl.finish();
          const t0 = performance.now();
          for (let k = 0; k < f; k++) render(id);
          gl.finish();
          return (performance.now() - t0) / f;
        };
        const rough = timeBlock(4);
        return timeBlock(Math.min(80, Math.max(4, Math.round(150 / Math.max(rough, 0.05)))));
      },
      /** One frame at a time: issue, then wait. */
      split(id: string, count: number): { js: number[]; wait: number[] } {
        gcNow();
        render(id); gl.finish();
        const js: number[] = []; const wait: number[] = [];
        for (let k = 0; k < count; k++) {
          const t0 = performance.now();
          render(id);
          const t1 = performance.now();
          gl.finish();
          const t2 = performance.now();
          js.push(t1 - t0); wait.push(t2 - t1);
        }
        return { js, wait };
      },
      gpu(id: string, count: number): number[] {
        if (!timer) return [];
        const out: number[] = [];
        for (let k = 0; k < count; k++) {
          const q = gl.createQuery()!;
          gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
          render(id);
          gl.endQuery(timer.TIME_ELAPSED_EXT);
          gl.finish();
          let tries = 0;
          while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && tries++ < 1000) gl.finish();
          const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
          if (!disjoint && tries < 1000) out.push((gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6);
          gl.deleteQuery(q);
        }
        return out;
      },
      /** Median of short blocks, each ending in a finish, so one stall
       *  costs one block rather than the mean. */
      shortBlocks(id: string, blocks: number, per: number): number[] {
        gcNow();
        render(id); gl.finish();
        const out: number[] = [];
        for (let b = 0; b < blocks; b++) {
          const t0 = performance.now();
          for (let k = 0; k < per; k++) render(id);
          gl.finish();
          out.push((performance.now() - t0) / per);
        }
        return out;
      },
      /** Single frames under a condition that removes one suspect. */
      mech(cond: string, count: number): number[] {
        const g = gl as unknown as Record<string, unknown>;
        const saved = new Map<string, unknown>();
        const drop = (m: string) => { saved.set(m, g[m]); g[m] = () => undefined; };
        const batch = (renderer as unknown as { _drawBatch(): { rings: unknown[][]; nextInRing: number[] } })._drawBatch();
        const ring0 = batch.rings[0];
        if (cond === 'ring4096') { batch.rings[0] = new Array(4096).fill(undefined); batch.nextInRing[0] = 0; }
        if (cond === 'nosubdata' || cond === 'nodraw+nosubdata') drop('bufferSubData');
        if (cond === 'nodraw' || cond === 'nodraw+nosubdata') drop('drawElements');
        try {
          render('rect-cmbreak'); gl.finish();
          const out: number[] = [];
          for (let k = 0; k < count; k++) {
            const t0 = performance.now();
            render('rect-cmbreak'); gl.finish();
            out.push(performance.now() - t0);
          }
          return out;
        } finally {
          for (const [m] of saved) delete g[m];
          if (cond === 'ring4096') { batch.rings[0] = ring0; batch.nextInRing[0] = 0; }
        }
      },
      stallTrace(id: string, count: number): { frames: number[]; starts: number[] } {
        render(id); gl.finish();
        performance.mark('noise-start');
        const frames: number[] = []; const starts: number[] = [];
        for (let k = 0; k < count; k++) {
          const t0 = performance.now();
          performance.mark(`f${k}`);
          render(id); gl.finish();
          frames.push(performance.now() - t0); starts.push(t0);
        }
        performance.mark('noise-end');
        return { frames, starts };
      },
      traced(id: string, f: number): number {
        render(id); gl.finish();
        performance.mark('noise-start');
        const t0 = performance.now();
        for (let k = 0; k < f; k++) render(id);
        gl.finish();
        const ms = (performance.now() - t0) / f;
        performance.mark('noise-end');
        return ms;
      },
    };
    (globalThis as unknown as { __noise: typeof api }).__noise = api;
    return { glRenderer, draws, gpuTimer: !!timer, gcAvailable: typeof collect === 'function' };
  }, { root: repoRoot, n: N });

  console.log('');
  console.log(`Flush noise — ${N} one-rect flushes per frame, on ${header.glRenderer}`);
  console.log(`draws per cmbreak frame: ${header.draws}; GPU timer: ${header.gpuTimer}; gc: ${header.gcAvailable}`);
  run.params({ gcAvailable: header.gcAvailable, gpuTimer: header.gpuTimer });
  expect(header.draws).toBe(N);

  const ev = <T>(fn: string, ...args: unknown[]) =>
    page.evaluate(({ fn, args }) => {
      const api = (globalThis as unknown as { __noise: Record<string, (...a: unknown[]) => unknown> }).__noise;
      return api[fn](...args);
    }, { fn, args }) as Promise<T>;

  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
  const usPer = (ms: number) => (ms * 1000) / N;

  if (PHASES.includes('block')) {
    console.log('\nblock: the existing method, per-flush = (cmbreak - plain) / N');
    const flushUs: number[] = [];
    const series: Record<string, number[]> = { 'rect-plain': [], 'rect-cmbreak': [] };
    for (let r = 1; r <= RUNS; r++) {
      const plain = await ev<number>('block', 'rect-plain');
      const brk = await ev<number>('block', 'rect-cmbreak');
      series['rect-plain'].push(plain); series['rect-cmbreak'].push(brk);
      flushUs.push(usPer(brk - plain));
      console.log(`  ${String(r).padStart(2)}/${RUNS}  plain ${plain.toFixed(3).padStart(7)} ms  cmbreak ${brk.toFixed(3).padStart(7)} ms  `
        + `per flush ${usPer(brk - plain).toFixed(2).padStart(6)} us`);
    }
    run.item('block per flush', { perFlush: metric(med(flushUs), 'us', `median of ${RUNS} rounds`, flushUs) });
    for (const v of VARIANTS) run.item(`block ${v}`, { perFrame: metric(med(series[v]), 'ms', `median of ${RUNS} rounds`, series[v]) });
  }

  if (PHASES.includes('split')) {
    console.log('\nsplit: one frame at a time; js = render(), wait = finish()');
    for (let r = 1; r <= Math.min(RUNS, 4); r++) {
      for (const v of VARIANTS) {
        const { js, wait } = await ev<{ js: number[]; wait: number[] }>('split', v, 120);
        const tot = js.map((x, i) => x + wait[i]);
        console.log(`  run ${r}  ${v.padEnd(13)} js p10/p50/p90 ${pct(js, 0.1).toFixed(3)}/${pct(js, 0.5).toFixed(3)}/${pct(js, 0.9).toFixed(3)} ms  `
          + `wait ${pct(wait, 0.1).toFixed(3)}/${pct(wait, 0.5).toFixed(3)}/${pct(wait, 0.9).toFixed(3)} ms  `
          + `total ${pct(tot, 0.1).toFixed(3)}/${pct(tot, 0.5).toFixed(3)}/${pct(tot, 0.9).toFixed(3)} ms`);
        run.item(`split ${v} run ${r}`, {
          js: metric(med(js), 'ms', 'median of 120 frames', js),
          wait: metric(med(wait), 'ms', 'median of 120 frames', wait),
        });
      }
    }
  }

  if (PHASES.includes('gpu') && header.gpuTimer) {
    console.log('\ngpu: EXT_disjoint_timer_query, one frame per query');
    for (let r = 1; r <= Math.min(RUNS, 4); r++) {
      for (const v of VARIANTS) {
        const g = await ev<number[]>('gpu', v, 60);
        if (!g.length) { console.log(`  run ${r}  ${v}: no results`); continue; }
        console.log(`  run ${r}  ${v.padEnd(13)} p10/p50/p90 ${pct(g, 0.1).toFixed(3)}/${pct(g, 0.5).toFixed(3)}/${pct(g, 0.9).toFixed(3)} ms (${g.length})`);
        run.item(`gpu ${v} run ${r}`, { gpu: metric(med(g), 'ms', `median of ${g.length} frames`, g) });
      }
    }
  }

  if (PHASES.includes('trace')) {
    console.log('\ntrace: busy time per thread over a block of 40 frames');
    for (let r = 1; r <= Math.min(RUNS, 4); r++) {
      for (const v of VARIANTS) {
        const { ms, t } = await traceBlock(page, browser, v);
        console.log(`  run ${r}  ${v}: ${ms.toFixed(3)} ms/frame wall`);
        for (const th of t.threads.slice(0, 5)) {
          console.log(`      ${((th.busyUs / t.wallUs) * 100).toFixed(0).padStart(3)}% busy  ${th.name}`);
          for (const [name, us] of th.top.slice(0, 5)) console.log(`            ${(us / 40).toFixed(1).padStart(8)} us/frame  ${name}`);
        }
        const metrics: Record<string, ReturnType<typeof metric>> = { wall: metric(ms, 'ms', 'per frame, 40-frame block') };
        t.threads.slice(0, 6).forEach((th, i) => {
          metrics[`busy${i}`] = metric(th.busyUs / 40 / 1000, 'ms', `per frame: ${th.name}`);
        });
        run.item(`trace ${v} run ${r}`, metrics, { top: t.threads.slice(0, 4).map((th) => ({ thread: th.name, top: th.top })) });
      }
    }
  }

  if (PHASES.includes('short')) {
    console.log('\nshort: per flush from the median of 24 blocks of 8 frames, each block ending in finish');
    const flushUs: number[] = [];
    for (let r = 1; r <= RUNS; r++) {
      const plain = await ev<number[]>('shortBlocks', 'rect-plain', 24, 8);
      const brk = await ev<number[]>('shortBlocks', 'rect-cmbreak', 24, 8);
      const us = usPer(med(brk) - med(plain));
      flushUs.push(us);
      console.log(`  ${String(r).padStart(2)}/${RUNS}  plain ${med(plain).toFixed(3).padStart(7)} ms  cmbreak ${med(brk).toFixed(3).padStart(7)} ms `
        + `(max ${Math.max(...brk).toFixed(1).padStart(6)})  per flush ${us.toFixed(2).padStart(6)} us`);
    }
    run.item('short per flush', { perFlush: metric(med(flushUs), 'us', `median of ${RUNS} rounds`, flushUs) });
  }

  if (PHASES.includes('mech')) {
    console.log('\nmech: 150 single frames of rect-cmbreak per condition; ms p10/p50/p90, and frames over 2x p10');
    const conds = ['baseline', 'ring4096', 'nosubdata', 'nodraw', 'nodraw+nosubdata'];
    for (let r = 1; r <= Math.min(RUNS, 3); r++) {
      for (const c of conds) {
        const f = await ev<number[]>('mech', c, 150);
        const p10 = pct(f, 0.1);
        const slow = f.filter((x) => x > 2 * p10).length;
        console.log(`  run ${r}  ${c.padEnd(17)} ${p10.toFixed(2).padStart(6)} ${pct(f, 0.5).toFixed(2).padStart(6)} ${pct(f, 0.9).toFixed(2).padStart(7)}  max ${Math.max(...f).toFixed(1).padStart(7)}  slow ${String(slow).padStart(3)}/150`);
        run.item(`mech ${c} run ${r}`, { frame: metric(med(f), 'ms', 'median of 150 single frames', f) });
      }
    }
  }

  if (PHASES.includes('cpu')) {
    console.log('\ncpu: GPU-process PutChanged wall (dur) against thread CPU (tdur), per condition, 150 traced single frames');
    for (const c of ['baseline', 'nosubdata', 'nodraw']) {
      await browser.startTracing(page, { categories: CATEGORIES.split(',') });
      const f = await ev<number[]>('mech', c, 150);
      const buf = await browser.stopTracing();
      const parsed = JSON.parse(buf.toString('utf8')) as { traceEvents?: (TraceEvent & { tdur?: number })[] };
      const events = parsed.traceEvents ?? [];
      const put = events.filter((e) => e.ph === 'X' && e.name === 'CommandBufferService:PutChanged');
      const dur = put.reduce((a, e) => a + (e.dur ?? 0), 0);
      const tdur = put.reduce((a, e) => a + (e.tdur ?? 0), 0);
      const withT = put.filter((e) => e.tdur !== undefined).length;
      console.log(`  ${c.padEnd(10)} frame p50 ${pct(f, 0.5).toFixed(2)} p90 ${pct(f, 0.9).toFixed(2)} ms;  PutChanged ${put.length} events, `
        + `wall ${(dur / 1000).toFixed(1)} ms, thread CPU ${(tdur / 1000).toFixed(1)} ms (${withT} with tdur)`);
      run.item(`cpu ${c}`, {
        frame: metric(med(f), 'ms', 'median of 150 traced frames', f),
        putWall: metric(dur / 1000, 'ms', 'sum of PutChanged dur'),
        putCpu: metric(tdur / 1000, 'ms', 'sum of PutChanged tdur'),
      });
    }
  }

  if (PHASES.includes('stall')) {
    console.log('\nstall: 240 single frames under a trace; what the GPU process does in the slowest');
    await browser.startTracing(page, { categories: CATEGORIES.split(',') });
    const st = await ev<{ frames: number[]; starts: number[] }>('stallTrace', 'rect-cmbreak', 240);
    const buf = await browser.stopTracing();
    const sorted = st.frames.map((f, i) => [f, i] as const).sort((a, b) => b[0] - a[0]);
    console.log(`  median ${med(st.frames).toFixed(2)} ms; slowest ${sorted.slice(0, 5).map(([f, i]) => `#${i} ${f.toFixed(1)}`).join(', ')}`);
    const parsed = JSON.parse(buf.toString('utf8')) as { traceEvents?: TraceEvent[] } | TraceEvent[];
    const events = Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
    const marks = new Map<string, number>();
    for (const e of events) if (/^f\d+$/.test(e.name) && !marks.has(e.name)) marks.set(e.name, e.ts);
    const tname = new Map<string, string>(); const pname = new Map<number, string>();
    for (const e of events) {
      if (e.ph !== 'M') continue;
      const n = String((e.args as { name?: string } | undefined)?.name ?? '');
      if (e.name === 'thread_name') tname.set(`${e.pid}:${e.tid}`, n);
      if (e.name === 'process_name') pname.set(e.pid, n);
    }
    const stalls: unknown[] = [];
    for (const [f, i] of sorted.slice(0, 3)) {
      const a = marks.get(`f${i}`); const b = marks.get(`f${i + 1}`) ?? (a ?? 0) + f * 1000;
      if (a === undefined) continue;
      const inside = events.filter((e) => e.ph === 'X' && e.dur !== undefined && e.dur > 2000 && e.ts < b && e.ts + e.dur! > a);
      inside.sort((x, y) => y.dur! - x.dur!);
      console.log(`  frame #${i}: ${f.toFixed(1)} ms; events over 2 ms overlapping it:`);
      const rows = inside.slice(0, 14).map((e) => ({ thread: `${pname.get(e.pid) ?? e.pid}/${tname.get(`${e.pid}:${e.tid}`) ?? e.tid}`, name: e.name, ms: e.dur! / 1000, args: e.args }));
      for (const r of rows) console.log(`      ${r.ms.toFixed(1).padStart(7)} ms  ${r.thread}  ${r.name}  ${JSON.stringify(r.args ?? {}).slice(0, 160)}`);
      stalls.push({ frame: i, ms: f, rows });
    }
    run.item('stall frames', { median: metric(med(st.frames), 'ms', '240 single frames', st.frames) }, { stalls });
  }

  expect(errors).toEqual([]);
  run.machine({ glRenderer: header.glRenderer, browser: `${browserName} ${browser.version()}` });
  run.write();
});

const CATEGORIES = [
  'toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing',
  'gpu', 'gpu.service', 'disabled-by-default-gpu.service', 'gpu.angle', 'disabled-by-default-gpu.angle',
  'mojom', 'ipc', 'v8', 'disabled-by-default-v8.gc', 'viz', 'cc',
].join(',');

async function traceBlock(page: Page, browser: Browser, id: string) {
  await browser.startTracing(page, { categories: CATEGORIES.split(',') });
  const ms = await page.evaluate((id) =>
    (globalThis as unknown as { __noise: { traced(id: string, f: number): number } }).__noise.traced(id, 40), id);
  const buf = await browser.stopTracing();
  return { ms, t: analyzeTrace(buf) };
}
