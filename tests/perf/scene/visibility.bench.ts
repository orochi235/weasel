/**
 * What render-time visibility costs and buys, on the CPU: the time to build a
 * frame's commands (`buildSceneViewCommands`, culled), the time an edit takes
 * and the frame after it, and the heap the index holds.
 *
 * Run on the fleet as a perf job, one at a time:
 *   onto do --kind bench -- npx vitest run --config tests/perf/vitest.scene-bench.config.ts tests/perf/scene/visibility.bench.ts
 * It prints a line per case as it finishes and writes every raw time to one
 * JSON file under `$WEASEL_PERF_OUT` (default `tests/perf/results/`).
 *
 * It reads only what the merge-base before the index had, so the same file
 * measures both sides; the index's own seams are loaded when present.
 */
import { it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg, release } from 'node:os';
import { dirname, join } from 'node:path';
import { buildSceneViewCommands, defaultDrawOne, defaultPaintBounds, type NodeId } from '@weasel-js/core';
import { flatGrid, nestedGrid, PITCH, type BenchScene, type Pose } from './visibilityScenes';

type View = { x: number; y: number; scale: { x: number; y: number } };
interface Seams { withoutCull?: <T>(fn: () => T) => T; builds?: () => number }

const OUT = process.env.WEASEL_PERF_OUT ?? 'tests/perf/results';
const WARMUP = 30;
const FRAMES = Number(process.env.VIS_FRAMES ?? 200);
/** The closing scenes' viewport: 316 × 316 world units at scale 1, a hundredth of the 3160-wide grid. */
const PORT = 316;

const records: Record<string, unknown>[] = [];
const fmt = (v: number) => v.toFixed(3).padStart(9);
const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
let step = 0;
const TOTAL = 33;

function report(name: string, times: readonly number[], extra: Record<string, unknown> = {}, unit = 'ms'): void {
  step++;
  records.push({ case: name, unit, times, ...extra });
  console.log(`${String(step).padStart(2)}/${TOTAL}  ${name.padEnd(48)} median ${fmt(median(times))} ${unit.padEnd(5)} n=${String(times.length).padStart(3)}${extra.builds !== undefined ? `  builds ${String(extra.builds)}` : ''}`);
}

function frame(scene: BenchScene, view: View, w: number, h: number, cull: boolean): number {
  const t0 = performance.now();
  buildSceneViewCommands(scene, view, defaultDrawOne, undefined, undefined, undefined, undefined,
    cull ? { width: w, height: h, dpr: 1, paintBounds: defaultPaintBounds as never } : undefined, 1);
  return performance.now() - t0;
}

function frames(scene: BenchScene, viewAt: (i: number) => View, w: number, h: number, cull: boolean, count = FRAMES): number[] {
  for (let i = 0; i < WARMUP; i++) frame(scene, viewAt(i), w, h, cull);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(frame(scene, viewAt(i), w, h, cull));
  return out;
}

/** A pan across the 3160-wide grid that keeps the viewport inside it. */
const panning = (i: number): View => {
  const span = 3160 - PORT;
  return { x: ((i * 397) % span), y: ((i * 211) % span), scale: { x: 1, y: 1 } };
};
const still: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function seams(): Promise<Seams> {
  const out: Seams = {};
  try {
    const vis = await import('../../../packages/core/src/canvas/reach/sceneVisibility');
    out.withoutCull = vis.__withoutSubtreeCullForTest;
    const tree = await import('../../../packages/core/src/canvas/reach/reachTree');
    out.builds = (tree as { reachTreeBuildCount?: () => number }).reachTreeBuildCount;
  } catch {
    // The merge-base has no index.
  }
  return out;
}

function smallScenes(): void {
  for (const n of [100, 1000, 10000]) {
    const side = Math.round(Math.sqrt(n));
    const { scene } = flatGrid(side, side, 1000 / side);
    report(`small ${n} all on screen, cull on`, frames(scene, () => still, 1000, 1000, true), { n, cull: true });
    report(`small ${n} all on screen, cull off`, frames(scene, () => still, 1000, 1000, false), { n, cull: false });
  }
}

function drag(name: string, scene: BenchScene, id: NodeId, s: Seams): void {
  const base = scene.get(id)!.pose;
  const before = s.builds?.();
  const times: number[] = [];
  for (let i = 0; i < 300; i++) {
    scene.overrides.set(id, { pose: { ...base, x: base.x + (i % 50) } });
    times.push(frame(scene, still, PORT, PORT, true));
  }
  scene.overrides.clear(id);
  report(name, times, { builds: before === undefined ? null : s.builds!() - before });
}

function closingScenes(s: Seams): void {
  const alone = flatGrid(32, 32);
  report('closing: 1k alone, all on screen', frames(alone.scene, () => still, PORT, PORT, true), { n: 1024 });
  const flat = flatGrid(316, 316);
  report('closing: 100k flat, 1% on screen', frames(flat.scene, panning, PORT, PORT, true), { n: flat.ids.length });
  drag('closing: 100k flat, one node dragged', flat.scene, flat.ids[5]!, s);
  const nested = nestedGrid();
  report('closing: 100k nested, 1% on screen', frames(nested.scene, panning, PORT, PORT, true), { n: nested.ids.length });
  drag('closing: 100k nested, one node dragged', nested.scene, nested.ids[5]!, s);
}

/** Time `edit` `count` times, and the culled frame after each. */
function editCost(label: string, scene: BenchScene, count: number, edit: (i: number) => void): void {
  const ops: number[] = [];
  const after: number[] = [];
  frame(scene, still, PORT, PORT, true);
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    edit(i);
    ops.push(performance.now() - t0);
    after.push(frame(scene, still, PORT, PORT, true));
  }
  report(`${label}: the edit`, ops);
  report(`${label}: the frame after`, after);
}

function edits(n: number): void {
  const side = Math.round(Math.sqrt(n));
  const { scene, ids } = flatGrid(side, side);
  const at = (id: NodeId) => scene.get(id)!.pose;
  editCost(`edit ${n}: setPose`, scene, 100, (i) => {
    const id = ids[i % 50]!;
    scene.setPose(id, { ...at(id), x: at(id).x + 1 });
  });
  editCost(`edit ${n}: 1k setPose batch`, scene, 10, () => {
    scene.batch('bench', () => { for (let k = 0; k < 1000; k++) scene.setPose(ids[k % ids.length]!, { ...at(ids[k % ids.length]!), y: at(ids[k % ids.length]!).y + 1 }); });
  });
  const added: NodeId[] = [];
  editCost(`edit ${n}: add`, scene, 50, (i) => {
    added.push(scene.add({ kind: 'mark', layer: 'main', pose: { x: i * PITCH, y: 5, width: 6, height: 6 } as Pose, data: { shape: 'rect' } }));
  });
  editCost(`edit ${n}: remove`, scene, 50, (i) => scene.remove(added[i]!));
  const group = scene.add({ kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} });
  editCost(`edit ${n}: reparent`, scene, 50, (i) => scene.move(ids[i]!, i % 2 === 0 ? group : null));
}

function heap(): number {
  (globalThis as { gc?: () => void }).gc?.();
  (globalThis as { gc?: () => void }).gc?.();
  return process.memoryUsage().heapUsed;
}

function memory(s: Seams): void {
  for (const [name, build] of [['flat', () => flatGrid(316, 316)], ['nested', () => nestedGrid()]] as const) {
    const { scene, ids } = build();
    const plain = (s.withoutCull ?? ((fn) => fn()))(() => { frame(scene, still, PORT, PORT, true); return heap(); });
    frame(scene, still, PORT, PORT, true);
    const indexed = heap();
    report(`memory ${name} 100k: index bytes per node`, [(indexed - plain) / ids.length], { plain, indexed, n: ids.length, gc: typeof (globalThis as { gc?: unknown }).gc === 'function' }, 'bytes');
  }
}

function machine(): Record<string, unknown> {
  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch { /* not a checkout */ }
  return { host: hostname(), cpu: cpus()[0]?.model, cores: cpus().length, os: release(), node: process.version, loadavg: loadavg(), sha };
}

it('render visibility: frame, edit and memory cost', async () => {
  const s = await seams();
  const started = machine();
  smallScenes();
  closingScenes(s);
  edits(1000);
  edits(100_000);
  memory(s);
  const file = OUT.endsWith('.json') ? OUT : join(OUT, `visibility-${Date.now()}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ schema: 'weasel-visibility-bench/1', started, ended: machine(), indexed: s.withoutCull !== undefined, frames: FRAMES, records }, null, 1));
  console.log(`wrote ${file}`);
}, 3_600_000);
