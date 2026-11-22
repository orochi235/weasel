/**
 * What streaming a scene around a pan costs: 400 frames across an endless world of 36-node cells,
 * each frame landing what loaded and building the culled frame (`buildSceneViewCommands`). Against
 * it, the same loads applied the way a consumer on `onViewChange` could before `streamScene`: each
 * cell's arrival and departure a recorded edit, so the undo history and its memory grow with the pan.
 *
 *   onto do --kind bench -- npx vitest run --config tests/perf/vitest.scene-bench.config.ts tests/perf/scene/stream.bench.ts
 *
 * One line per case as it finishes; every frame's time goes to one JSON file under `$WEASEL_PERF_OUT`.
 */
import { it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg, release } from 'node:os';
import { dirname, join } from 'node:path';
import { asNodeId, buildSceneViewCommands, createScene, defaultDrawOne, defaultPaintBounds, streamScene, type AddNodeSpec, type NodeId, type SceneCell } from '@weasel-js/core';

type Pose = { x: number; y: number; width: number; height: number };
const OUT = process.env.WEASEL_PERF_OUT ?? 'tests/perf/results';
const FRAMES = 400;
const CELL = 200;
const DIMS = { width: 1280, height: 800 };
const records: Record<string, unknown>[] = [];
const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;

const cellNodes = (cell: SceneCell): AddNodeSpec<object, 'main', Pose>[] => Array.from({ length: 36 }, (_, i) => ({
  id: asNodeId(`n${cell.x}_${cell.y}_${i}`), kind: 'mark', layer: 'main',
  pose: { x: cell.box[0] + (i % 6) * 33, y: cell.box[1] + Math.floor(i / 6) * 33, width: 25, height: 25 }, data: {},
}));
const viewAt = (f: number) => ({ x: f * 61, y: f * 17, scale: { x: 1, y: 1 } });
const heap = () => {
  (globalThis as { gc?: () => void }).gc?.();
  return process.memoryUsage().heapUsed;
};
const draw = (scene: ReturnType<typeof createScene>, f: number) => buildSceneViewCommands(scene as never, viewAt(f), defaultDrawOne, undefined, undefined, undefined, undefined,
  { ...DIMS, dpr: 1, paintBounds: defaultPaintBounds as never }, 1);

function report(name: string, times: number[], extra: Record<string, unknown>): void {
  records.push({ case: name, unit: 'ms', times, ...extra });
  console.log(`${String(records.length).padStart(2)}/2  ${name.padEnd(44)} median ${median(times).toFixed(3).padStart(8)} ms  ${JSON.stringify(extra)}`);
}

async function streamed(): Promise<void> {
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const stream = streamScene(scene, { cellSize: CELL, load: async (cell) => cellNodes(cell) }, { maxCells: 64 });
  const before = heap();
  const times: number[] = [];
  for (let f = 0; f < FRAMES; f++) {
    const t0 = performance.now();
    stream.update(viewAt(f), DIMS);
    await Promise.resolve();
    await Promise.resolve();
    draw(scene, f);
    times.push(performance.now() - t0);
  }
  report('streamScene, untracked', times, { history: scene.historyEntries().length, nodes: scene.nodes.size, heapGrowth: heap() - before });
  stream.dispose();
}

async function recorded(): Promise<void> {
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const held = new Map<string, NodeId[]>();
  const before = heap();
  const times: number[] = [];
  for (let f = 0; f < FRAMES; f++) {
    const t0 = performance.now();
    const v = viewAt(f);
    const want = new Set<string>();
    for (let y = Math.floor(v.y / CELL) - 1; y <= Math.ceil((v.y + DIMS.height) / CELL); y++) {
      for (let x = Math.floor(v.x / CELL) - 1; x <= Math.ceil((v.x + DIMS.width) / CELL); x++) want.add(`${x}/${y}`);
    }
    for (const key of want) {
      if (held.has(key)) continue;
      const [x, y] = key.split('/').map(Number) as [number, number];
      const cell = { x, y, box: [x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL] as const };
      held.set(key, scene.batch('load cell', () => cellNodes(cell).map((spec) => scene.add(spec))));
    }
    for (const [key, ids] of held) {
      if (want.has(key) || held.size <= 64) continue;
      scene.batch('drop cell', () => scene.removeMany(ids));
      held.delete(key);
    }
    draw(scene, f);
    times.push(performance.now() - t0);
  }
  report('recorded adds and removes (before)', times, { history: scene.historyEntries().length, nodes: scene.nodes.size, heapGrowth: heap() - before });
}

it('streaming a scene through a pan', async () => {
  let sha = 'unknown';
  try { sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
  const machine = { host: hostname(), cpu: cpus()[0]?.model, cores: cpus().length, os: release(), node: process.version, loadavg: loadavg(), sha };
  await recorded();
  await streamed();
  const file = OUT.endsWith('.json') ? OUT : join(OUT, `stream-${Date.now()}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ schema: 'weasel-stream-bench/1', machine, frames: FRAMES, records }, null, 1));
  console.log(`wrote ${file}`);
}, 600_000);
