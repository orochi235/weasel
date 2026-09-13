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

/**
 * The three ways a 60 Hz loop can move a node, against each other.
 *
 * `docs/TODO.md` carried a P1 saying the fresh pose object `setPose` demands
 * per node per frame was the GC bill, and proposed a scalar setter or an
 * in-place write to remove it. The bare-allocation row is what settles that:
 * minting the object is a rounding error next to recording the step, so
 * neither remedy would have moved the number. The override row is the write
 * that actually costs nothing — `PoseOverrides` is set once and mutated in
 * place, and `commit()` drops the pose-keyed memo slots the reference key can
 * no longer see.
 */
describe('per-frame pose write — one node, three paths', () => {
  const scene = emptyScene(60);
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { n: 0 } });

  let i = 0;
  bench('setPose, fresh object — records a step', () => {
    scene.setPose(id, { x: i++, y: 0, width: 3, height: 4 });
  }, FIXED);

  const entry = { pose: { x: 0, y: 0, width: 3, height: 4 } };
  scene.overrides.set(id, entry);
  bench('override, mutated in place — records nothing', () => {
    entry.pose.x = i++;
    scene.overrides.commit();
  }, FIXED);

  // No scene at all: the cost the two remedies above would have removed.
  const sink: { x: number; y: number; width: number; height: number }[] = [];
  bench('the pose object alone', () => {
    sink[0] = { x: i++, y: 0, width: 3, height: 4 };
  }, FIXED);
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

/**
 * Both walks are cached until something structural moves, so the three groups
 * above now report a **cached** read — the array is built once and the timed
 * body only drains it. This group is what separates the two costs: both benches
 * iterate the same 10,000 ids, and only the second rebuilds first.
 *
 * The rebuild is forced by a layer reorder in an untimed `beforeEach`. On four
 * layers that is a two-element splice, nothing next to a 10,000-node walk.
 */
describe('renderOrder — cached repeat vs cold rebuild (10k nodes, 4 layers)', () => {
  const scene = layeredScene(10000, 4);
  const drain = (): void => {
    let c = 0;
    for (const _ of scene.renderOrder()) c++;
    if (c !== 10000) throw new Error(`renderOrder yielded ${c}, expected 10000`);
  };
  // One layer, bounced between the first two slots. Alternating *which* layer
  // moves instead would ask the second call to put a layer where it already
  // is, and `moveLayer` returns early on that — leaving the cache valid and
  // the "cold" walk measuring a cache hit.
  let slot = 0;
  const reorderLayers = (): void => {
    slot = slot === 0 ? 1 : 0;
    scene.moveLayer('L0', slot);
  };

  // Vitest's bench `setup` hook does not run per iteration, so the
  // invalidation has to sit inside the timed body. It is measured on its own
  // so the walk can be recovered by subtraction:
  //   cold walk = (reorder + drain) - reorder - drain
  bench('drain only — cached', drain);
  bench('layer reorder only — the invalidation', reorderLayers);
  bench('layer reorder + drain — cold walk', () => {
    reorderLayers();
    drain();
  });
});

// Resolving ids back to nodes is what `renderOrderNodes()` exists to avoid.
// Every adapter's `getNodes` runs this on the render path, once a frame.
describe('renderOrder → nodes vs renderOrderNodes', () => {
  for (const n of NODE_COUNTS) {
    const scene = deepScene(n, 0);
    bench(`${n} nodes — via renderOrder + get`, () => {
      const out: unknown[] = [];
      for (const id of scene.renderOrder()) {
        const node = scene.get(id);
        if (node) out.push(node);
      }
      if (out.length !== n) throw new Error(`got ${out.length}, expected ${n}`);
    });
    bench(`${n} nodes — via renderOrderNodes`, () => {
      const out = [...scene.renderOrderNodes()];
      if (out.length !== n) throw new Error(`got ${out.length}, expected ${n}`);
    });
  }
});
