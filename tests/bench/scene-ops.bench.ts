/**
 * Scene mutations against tree depth, and `renderOrder()` against node count.
 *
 * Every mutation on a `Scene` is routed through the history engine, so what
 * these measure is "one undoable step", not a bare `Map.set`. That is the
 * cost a consumer actually pays.
 *
 * Mutating benchmarks are pinned to an explicit iteration count rather than
 * tinybench's default "run for 500ms": `add` grows the scene it is measuring,
 * and an open-ended run would measure a scene of unknowable size and allocate
 * proportionally. `historyLimit` is likewise small, so the undo log does not
 * become the thing under test.
 */
import { bench, describe } from 'vitest';
import type { NodeId } from 'core/scene/types';
import { containerChain, deepScene, emptyScene, layeredScene, type BenchScene } from './fixtures';

const DEPTHS = [0, 4, 16];
const NODE_COUNTS = [100, 1000, 10000];
const LAYER_COUNTS = [1, 4, 16, 64];
const POSE = { x: 1, y: 2, width: 3, height: 4 };

/** Bounded run: N timed iterations, no wall-clock floor. These ops are
 *  sub-microsecond, so the count has to be high enough that timer resolution
 *  and JIT warmup are not what is being reported. */
const FIXED = { time: 0, iterations: 20000, warmupTime: 0, warmupIterations: 2000 };

function chainAt(depth: number): { scene: BenchScene; parent: NodeId | null } {
  const scene = emptyScene(2);
  return { scene, parent: containerChain(scene, depth) };
}

describe('scene.add — leaf, by tree depth', () => {
  for (const depth of DEPTHS) {
    const { scene, parent } = chainAt(depth);
    bench(`depth ${depth}`, () => {
      scene.add({
        kind: 'leaf', layer: 'main', pose: POSE, data: { n: 0 },
        ...(parent !== null ? { parent } : {}),
      });
    }, FIXED);
  }
});

describe('scene.add + scene.remove — round trip, by tree depth', () => {
  // Paired so the scene stays the same size across iterations. `remove`
  // snapshots the subtree for undo, so this is the honest cost of an insert
  // the user immediately deletes.
  for (const depth of DEPTHS) {
    const { scene, parent } = chainAt(depth);
    bench(`depth ${depth}`, () => {
      const id = scene.add({
        kind: 'leaf', layer: 'main', pose: POSE, data: { n: 0 },
        ...(parent !== null ? { parent } : {}),
      });
      scene.remove(id);
    }, FIXED);
  }
});

describe('scene.setPose — by tree depth', () => {
  for (const depth of DEPTHS) {
    const { scene, parent } = chainAt(depth);
    const id = scene.add({
      kind: 'leaf', layer: 'main', pose: POSE, data: { n: 0 },
      ...(parent !== null ? { parent } : {}),
    });
    let i = 0;
    bench(`depth ${depth}`, () => {
      scene.setPose(id, { x: i++, y: 0, width: 3, height: 4 });
    }, FIXED);
  }
});

describe('scene.setPose — 10k-node scene, one node', () => {
  // Isolates "does scene size cost anything per mutation" from tree depth.
  const scene = deepScene(10000, 0);
  const id = [...scene.renderOrder()][0];
  let i = 0;
  bench('10000 nodes', () => {
    scene.setPose(id, { x: i++, y: 0, width: 3, height: 4 });
  }, FIXED);
});

describe('renderOrder — flat scene, fully drained', () => {
  for (const n of NODE_COUNTS) {
    const scene = deepScene(n, 0);
    bench(`${n} nodes`, () => {
      let c = 0;
      for (const _ of scene.renderOrder()) c++;
      if (c !== n) throw new Error(`renderOrder yielded ${c}, expected ${n}`);
    });
  }
});

describe('renderOrder — 10k nodes, by layer count', () => {
  // The other renderOrder benchmarks use a one-layer fixture, which hides any
  // per-layer term. Node count is fixed here so only the layer axis moves.
  for (const layers of LAYER_COUNTS) {
    const scene = layeredScene(10000, layers);
    bench(`${layers} layers`, () => {
      let c = 0;
      for (const _ of scene.renderOrder()) c++;
      if (c !== 10000) throw new Error(`renderOrder yielded ${c}, expected 10000`);
    });
  }
});

describe('renderOrder — 1000 leaves under a container chain', () => {
  for (const depth of DEPTHS) {
    const scene = deepScene(1000, depth);
    const expected = 1000 + depth;
    bench(`depth ${depth}`, () => {
      let c = 0;
      for (const _ of scene.renderOrder()) c++;
      if (c !== expected) throw new Error(`renderOrder yielded ${c}, expected ${expected}`);
    });
  }
});
