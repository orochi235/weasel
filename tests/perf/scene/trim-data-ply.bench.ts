/**
 * What showing an animated stroke trim through a node's data costs against showing it through the
 * paint context, the step that would fold `TrimOverrideRegistry` into the node-data target
 * (`docs/superpowers/plans/2026-11-25-node-data-target.md`, step 4).
 *
 * Each frame moves the trim's end on every path node and builds and renders the frame's commands
 * against a recording GL context. "registry" is how a trim shows now: `TrimOverrideRegistry.set`,
 * read back by `withPaintOverrides` into `NodePaintCtx.trim`, over a painter memo that keeps its
 * commands. "ply" shows it as `showDataField` over `stroke.trim`, which hands the painter new data
 * each frame, so its memo misses. "still" frames move nothing, for what each wiring costs a scene
 * nothing animates. The arms alternate round by round inside one job.
 *
 * Run on the fleet as a perf job, one at a time:
 *   onto do --kind bench -- npx vitest run --config tests/perf/vitest.scene-bench.config.ts tests/perf/scene/trim-data-ply.bench.ts
 * It prints a line per case as it finishes and appends one record per case to
 * `tests/perf/scene/trim-data-ply.runs.jsonl`.
 */
import { it } from 'vitest';
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { getHeapSpaceStatistics } from 'node:v8';
import { PATH_L, PATH_M, type PolygonPath } from '@weasel-js/geom';
import { createTrimOverrideRegistry } from '@weasel-js/animator';
import { buildSceneViewCommands, defaultDrawOne, showDataField, type DataLens, type NodeId } from '@weasel-js/core';
import { WeaselRenderer, type DrawCommand } from '@weasel-js/renderer';
import { wireSceneSlotToScene } from 'canvas/sceneSlotWiring';
import { createScene } from 'core/scene/scene';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createGLRecorder } from '../../../packages/renderer/src/testing/glRecorder';

type Data = { path: PolygonPath; stroke: { width: number; paint: { kind: 'solid'; color: string }; trim?: { start: number; end: number } } };
type View = { x: number; y: number; scale: { x: number; y: number } };

const OUT = 'tests/perf/scene/trim-data-ply.runs.jsonl';
const COUNTS = [1, 100, 1000];
const ROUNDS = Number(process.env.TRIM_ROUNDS ?? 5);
const FRAMES = Number(process.env.TRIM_FRAMES ?? 60);
const WARMUP = 20;
const ANCHORS = 64;
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const TRIM: DataLens<Data, { start: number; end: number }> = {
  key: 'trim',
  get: (d) => d.stroke.trim ?? { start: 0, end: 1 },
  with: (d, trim) => ({ ...d, stroke: { ...d.stroke, trim } }),
};

function wave(x: number, y: number): PolygonPath {
  const commands = new Uint8Array(ANCHORS).fill(PATH_L);
  commands[0] = PATH_M;
  const coords = new Float32Array(ANCHORS * 2);
  for (let i = 0; i < ANCHORS; i++) {
    coords[i * 2] = x + i * (60 / ANCHORS);
    coords[i * 2 + 1] = y + 20 + Math.sin(i / 6) * 18;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

function sceneOf(n: number) {
  const scene = createScene<Data, 'main', { x: number; y: number; width: number; height: number }>({
    composition: IDENTITY_POSE_COMPOSITION as never, systemLayers: [{ id: 'main' }],
  });
  const ids: NodeId[] = [];
  const side = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    const x = (i % side) * 70;
    const y = Math.floor(i / side) * 50;
    const path = wave(x, y);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let k = 1; k < path.coords.length; k += 2) { minY = Math.min(minY, path.coords[k]); maxY = Math.max(maxY, path.coords[k]); }
    ids.push(scene.add({
      kind: 'mark', layer: 'main',
      pose: { x, y: minY, width: path.coords[path.coords.length - 2] - x, height: maxY - minY },
      data: { path, stroke: { width: 2, paint: { kind: 'solid', color: '#204080' } } },
    }));
  }
  return { scene, ids };
}

type Arm = 'registry' | 'ply';

function rig(n: number, arm: Arm) {
  const { scene, ids } = sceneOf(n);
  const trims = createTrimOverrideRegistry();
  const slot = { drawOne: defaultDrawOne } as never;
  const wired = wireSceneSlotToScene(slot, scene as never, undefined, arm === 'registry' ? { trimOverrides: trims } : undefined);
  const recorder = createGLRecorder();
  const renderer = new WeaselRenderer({ gl: recorder.gl, width: 2400, height: 1800, dpr: 1 });
  let f = 0;
  const move = (): void => {
    const end = 0.2 + 0.8 * ((f++ % 60) + 1) / 60;
    for (const id of ids) {
      if (arm === 'registry') trims.set(id, { start: 0, end });
      else showDataField(scene, id, TRIM, { start: 0, end });
    }
    if (arm === 'ply') scene.overrides.commit();
  };
  const frame = (moving: boolean): { build: number; render: number; bytes: number | null } => {
    const before = newSpaceUsed();
    const t0 = performance.now();
    if (moving) move();
    const commands = buildSceneViewCommands(scene as never, VIEW as never, wired.drawOne as never) as DrawCommand[];
    const t1 = performance.now();
    recorder.reset();
    renderer.render(commands);
    const t2 = performance.now();
    const after = newSpaceUsed();
    return { build: t1 - t0, render: t2 - t1, bytes: after >= before ? after - before : null };
  };
  return { frame };
}

function newSpaceUsed(): number {
  return getHeapSpaceStatistics().find((s) => s.space_name === 'new_space')?.space_used_size ?? 0;
}

const median = (xs: readonly number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
const fmt = (v: number, w = 8, d = 3): string => v.toFixed(d).padStart(w);

const head = (() => {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { return null; }
})();
const machine = { host: hostname(), cpus: cpus().length, cpu: cpus()[0]?.model, load: loadavg() };

it('trim shown through data against through the paint context', () => {
  const cases = COUNTS.flatMap((n) => (['moving', 'still'] as const).map((mode) => ({ n, mode })));
  const total = cases.length * ROUNDS * 2;
  let step = 0;
  for (const { n, mode } of cases) {
    for (let round = 0; round < ROUNDS; round++) {
      // Alternate which arm goes first, so neither always runs on a warmer heap.
      const order: Arm[] = round % 2 === 0 ? ['registry', 'ply'] : ['ply', 'registry'];
      for (const arm of order) {
        const r = rig(n, arm);
        for (let i = 0; i < WARMUP; i++) r.frame(mode === 'moving');
        (globalThis as { gc?: () => void }).gc?.();
        const frames = Array.from({ length: FRAMES }, () => r.frame(mode === 'moving'));
        const record = {
          date: new Date().toISOString(), head, machine, n, mode, arm, round,
          build: frames.map((x) => x.build), render: frames.map((x) => x.render), bytes: frames.map((x) => x.bytes),
        };
        appendFileSync(OUT, `${JSON.stringify(record)}\n`);
        const bytes = frames.map((x) => x.bytes).filter((b): b is number => b !== null);
        step++;
        console.log(`${String(step).padStart(3)}/${total}  ${String(n).padStart(5)} nodes ${mode.padEnd(6)} ${arm.padEnd(8)} r${round}`
          + `  build ${fmt(median(record.build))} ms  render ${fmt(median(record.render))} ms  new-space ${fmt(median(bytes) / 1024, 9, 1)} KiB`);
      }
    }
  }
}, 30 * 60_000);
