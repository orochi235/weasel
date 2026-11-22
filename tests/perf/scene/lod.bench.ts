/**
 * What level of detail costs and buys on the CPU: the time to build a frame's commands
 * (`buildSceneViewCommands`, culled) for scenes with no ladders, where it can only add overhead, and
 * for 100k nodes in 1000 groups each about 10 px on screen, collapsed below 24 px.
 *
 * Run on the fleet as a perf job, one at a time:
 *   onto do --kind bench -- npx vitest run --config tests/perf/vitest.scene-bench.config.ts tests/perf/scene/lod.bench.ts
 * It prints a line per case as it finishes and writes every raw time to one JSON file under
 * `$WEASEL_PERF_OUT` (default `tests/perf/results/`). It reads only what the merge-base before level
 * of detail had, so the same file measures both sides: there the `lod` argument is ignored and the
 * grouped scene draws in full.
 */
import { it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg, release } from 'node:os';
import { dirname, join } from 'node:path';
import * as core from '@weasel-js/core';
import { flatGrid, nestedGrid, sceneOf, type BenchScene } from './visibilityScenes';

type View = { x: number; y: number; scale: { x: number; y: number } };

const OUT = process.env.WEASEL_PERF_OUT ?? 'tests/perf/results';
const WARMUP = 30;
const FRAMES = Number(process.env.LOD_FRAMES ?? 200);
const hasLod = typeof (core as { createLodState?: unknown }).createLodState === 'function';

const records: Record<string, unknown>[] = [];
const fmt = (v: number) => v.toFixed(3).padStart(9);
const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
const TOTAL = 6;
let step = 0;

function report(name: string, times: readonly number[], extra: Record<string, unknown> = {}): void {
  step++;
  records.push({ case: name, unit: 'ms', times, ...extra });
  console.log(`${String(step).padStart(2)}/${TOTAL}  ${name.padEnd(52)} median ${fmt(median(times))} ms  n=${String(times.length).padStart(3)}`);
}

type Lod = { options?: { collapseBelowPx?: number }; state?: unknown };

function frame(scene: BenchScene, view: View, w: number, h: number, lod?: Lod): number {
  const t0 = performance.now();
  (core.buildSceneViewCommands as (...a: unknown[]) => unknown)(scene, view, core.defaultDrawOne, undefined, undefined, undefined, undefined,
    { width: w, height: h, dpr: 1, paintBounds: core.defaultPaintBounds }, 1, view, lod);
  return performance.now() - t0;
}

function frames(scene: BenchScene, viewAt: (i: number) => View, w: number, h: number, lod?: Lod): number[] {
  for (let i = 0; i < WARMUP; i++) frame(scene, viewAt(i), w, h, lod);
  const out: number[] = [];
  for (let i = 0; i < FRAMES; i++) out.push(frame(scene, viewAt(i), w, h, lod));
  return out;
}

const still: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const PORT = 316;
const panning = (i: number): View => {
  const span = 3160 - PORT;
  return { x: ((i * 397) % span), y: ((i * 211) % span), scale: { x: 1, y: 1 } };
};

/** 1000 groups of 100 rects, 40 × 25 groups 10 world units wide at a pitch of 12. */
function groupedScene(): BenchScene {
  const specs: Record<string, unknown>[] = [];
  let n = 0;
  for (let gy = 0; gy < 25; gy++) {
    for (let gx = 0; gx < 40; gx++) {
      const id = `g${n++}`;
      specs.push({ id, kind: 'group', layer: 'main', pose: { x: gx * 12, y: gy * 12, width: 10, height: 10 }, data: {} });
      for (let k = 0; k < 100; k++) {
        specs.push({
          id: `m${n++}`, kind: 'mark', layer: 'main', parent: id,
          pose: { x: (k % 10), y: Math.floor(k / 10), width: 0.6, height: 0.6 }, data: { shape: 'rect' },
        });
      }
    }
  }
  return sceneOf(specs as never);
}

function machine(): Record<string, unknown> {
  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch { /* not a checkout */ }
  return { host: hostname(), cpu: cpus()[0]?.model, cores: cpus().length, os: release(), node: process.version, loadavg: loadavg(), sha };
}

it('level of detail: frame cost with and without ladders', () => {
  const started = machine();
  console.log(`level of detail ${hasLod ? 'present' : 'absent'} at ${String(started.sha)} on ${String(started.host)}`);
  for (const n of [1000, 10000]) {
    const side = Math.round(Math.sqrt(n));
    report(`no ladders: ${n} all on screen`, frames(flatGrid(side, side, 1000 / side).scene, () => still, 1000, 1000), { n });
  }
  report('no ladders: 100k nested, 1% on screen', frames(nestedGrid().scene, panning, PORT, PORT), { n: 100_000 });
  const grouped = groupedScene();
  const collapse = { options: { collapseBelowPx: 24 }, ...(hasLod ? { state: (core as unknown as { createLodState: () => unknown }).createLodState() } : {}) };
  report('100k in 1000 groups at 10 px, collapse below 24', frames(grouped, () => still, 480, 300, collapse), { n: 101_000 });
  report('100k in 1000 groups at 10 px, no collapse', frames(grouped, () => still, 480, 300), { n: 101_000 });
  report('1000 rects alone, all on screen', frames(flatGrid(40, 25, 12).scene, () => still, 480, 300), { n: 1000 });
  const file = OUT.endsWith('.json') ? OUT : join(OUT, `lod-${Date.now()}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ schema: 'weasel-lod-bench/1', started, ended: machine(), lod: hasLod, frames: FRAMES, records }, null, 1));
  console.log(`wrote ${file}`);
}, 3_600_000);
