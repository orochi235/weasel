/**
 * The line-jump pass against its performance budget. Run on the fleet:
 * `onto do --kind bench -in weasel -- npm run bench:hops`, which runs it as one
 * vitest test (`tests/perf/vitest.scene-bench.config.ts`). Prints each case as
 * it finishes. Times the pass alone, between two passes ordered either side
 * of it.
 */
import { it } from 'vitest';
import { createScene, createTransformOp, type RectPose, type Scene } from '@weasel-js/core';
import { seeded } from '../avoid/avoidFixture';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { DIAGRAM_PASS_ORDER } from '../passOrder';
import { installHops } from './install';
import { HOPS_DOC_KEY } from './types';

type BenchScene = Scene<unknown, 'main', RectPose>;

const SHAPES = 200;
const CONNECTORS = 300;
const PITCH = 180;
const CASES = 2;

const fmt = (v: number) => v.toFixed(2).padStart(7);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/** 200 shapes on a jittered grid and 300 connectors between near pairs, most of them crossing others. */
function build(seed: number): BenchScene {
  const rand = seeded(seed);
  const cols = Math.ceil(Math.sqrt(SHAPES));
  const nodes: unknown[] = [];
  for (let k = 0; k < SHAPES; k++) {
    const x = (k % cols) * PITCH + Math.round(rand() * 60);
    const y = Math.floor(k / cols) * PITCH + Math.round(rand() * 60);
    nodes.push({ id: `s${k}`, kind: 'mark', layer: 'main', pose: { x, y, width: 60, height: 40 }, data: { diagram: {} } });
  }
  for (let k = 0; k < CONNECTORS; k++) {
    const a = Math.floor(rand() * SHAPES);
    const step = [1, cols, cols + 1, cols - 1, 2][Math.floor(rand() * 5)]!;
    const b = (a + step) % SHAPES;
    nodes.push({
      id: `e${k}`, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, router: k % 2 === 0 ? 'orthogonal' : 'straight' } },
      dependsOn: [`s${a}`, `s${b}`], derivePath: EDGE_DERIVE_PATH,
    });
  }
  return createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), initial: nodes as never });
}

/** A stopwatch around the hop pass: the time from the pass before it to the pass after. */
function stopwatch(scene: BenchScene): { last(): number } {
  let t0 = 0;
  let took = 0;
  scene.addEditPass(() => { t0 = performance.now(); return null; }, { order: DIAGRAM_PASS_ORDER.hops - 1 });
  scene.addEditPass(() => { took = performance.now() - t0; return null; }, { order: DIAGRAM_PASS_ORDER.hops + 1 });
  return { last: () => took };
}

/** The connectors on any of `ids`. */
function attached(scene: BenchScene, ids: ReadonlySet<string>): number {
  return scene.renderOrderNodes().filter((n) => Array.isArray(n.dependsOn) && n.dependsOn.some((id) => ids.has(id))).length;
}

function commits(): void {
  const scene = build(1);
  installHops(scene);
  const watch = stopwatch(scene);
  scene.doc.set(HOPS_DOC_KEY, { size: 5 });
  const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose) };
  const times: number[] = [];
  const dirty: number[] = [];
  for (let c = 0; c < 10; c++) {
    // Six shapes carry about twenty connectors between them.
    const ids = new Set(Array.from({ length: 6 }, (_, i) => `s${(c * 17 + i * 31) % SHAPES}`));
    const ops = [...ids].map((id) => {
      const from = scene.get(id as never)!.pose;
      return createTransformOp({ id, from, to: { ...from, x: from.x + 23, y: from.y + 11 } });
    });
    scene.applyBatch(ops, 'Move', adapter);
    times.push(watch.last());
    dirty.push(attached(scene, ids));
  }
  process.stdout.write(`1/${CASES} commit  ${SHAPES} shapes  ${CONNECTORS} connectors  dirty ${String(Math.round(median(dirty))).padStart(3)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget    3.00 ms\n`);
}

function full(): void {
  const times: number[] = [];
  let hops = 0;
  for (let run = 0; run < 5; run++) {
    const scene = build(2 + run);
    installHops(scene);
    const watch = stopwatch(scene);
    scene.doc.set(HOPS_DOC_KEY, { size: 5 });
    times.push(watch.last());
    hops = scene.renderOrderNodes().reduce((n, node) => n + ((node.data as { diagram?: { hops?: unknown[] } }).diagram?.hops?.length ?? 0), 0);
  }
  process.stdout.write(`2/${CASES} full    ${SHAPES} shapes  ${CONNECTORS} connectors  hops ${String(hops).padStart(4)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget   25.00 ms\n`);
}

it('line-jump pass budget', () => {
  commits();
  full();
}, 300_000);
