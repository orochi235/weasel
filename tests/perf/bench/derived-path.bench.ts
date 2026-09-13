/**
 * What a frame of derived paths costs, and what value-comparing the
 * dependencies would add to it.
 *
 * Invalidation is pushed by the scene today: a `setPose` drops the dependent's
 * memo slot, and every other frame is a memo hit. That is closed only under
 * the triggers someone enumerated. Comparing the resolved dependency poses by
 * *value* would instead be closed under whatever `derivePath` actually read —
 * at the cost of resolving every dependency's pose on every frame, for every
 * derived node, whether anything moved or not.
 *
 * These two measure exactly that difference on the same scene: the frame as it
 * runs now, and the extra resolve-and-compare pass a value check would need
 * before it could decide to skip. The pass here is the *floor* on that cost —
 * it walks and compares and nothing else.
 */
import { bench, describe } from 'vitest';
import { derivedDepOf, effectivePose } from 'core/scene/effectivePose';
import { resolveDerivedPath } from 'core/scene/derivedPath';
import type { NodeId } from 'core/scene/types';
import { diagramScene, type BenchPose } from './fixtures';

/** Node counts a hand-authored diagram plausibly reaches, with edges at the
 *  1.5x a connected flowchart tends to run. */
const SHAPES: readonly [nodes: number, edges: number][] = [[20, 30], [100, 150], [500, 750]];

const FRAME = { time: 0, iterations: 200, warmupTime: 0, warmupIterations: 20 };

function frameOf(nodes: number, edges: number) {
  const { scene, edgeIds } = diagramScene(nodes, edges);
  const depOf = (id: NodeId) => derivedDepOf(scene as never, id);
  const childrenOf = (id: NodeId) => scene.childrenOf(id);
  return { scene, edgeIds, depOf, childrenOf };
}

describe('a frame of derived paths — memo hit, as it runs now', () => {
  for (const [nodes, edges] of SHAPES) {
    const { scene, edgeIds, depOf, childrenOf } = frameOf(nodes, edges);
    // Prime the memo, so the timed iterations are the steady state.
    for (const id of edgeIds) resolveDerivedPath(scene.get(id)! as never, depOf, childrenOf);
    bench(`${nodes} nodes, ${edges} edges`, () => {
      for (const id of edgeIds) resolveDerivedPath(scene.get(id)! as never, depOf, childrenOf);
    }, FRAME);
  }
});

describe('the same frame, plus resolving and value-comparing every dependency', () => {
  for (const [nodes, edges] of SHAPES) {
    const { scene, edgeIds, depOf, childrenOf } = frameOf(nodes, edges);
    for (const id of edgeIds) resolveDerivedPath(scene.get(id)! as never, depOf, childrenOf);
    // What a value check would hold from the previous frame.
    const last = new Map<NodeId, BenchPose[]>();
    bench(`${nodes} nodes, ${edges} edges`, () => {
      for (const id of edgeIds) {
        const node = scene.get(id)!;
        const deps = node.dependsOn as readonly NodeId[];
        const seen = last.get(id);
        let same = seen !== undefined;
        const now: BenchPose[] = [];
        for (let i = 0; i < deps.length; i++) {
          const d = scene.get(deps[i]);
          const p = (d === undefined
            ? { x: 0, y: 0, width: 0, height: 0 }
            : effectivePose(scene as never, d as never)) as BenchPose;
          now.push(p);
          if (same) {
            const was = seen![i];
            if (was === undefined
              || was.x !== p.x || was.y !== p.y
              || was.width !== p.width || was.height !== p.height) same = false;
          }
        }
        last.set(id, now);
        if (!same) resolveDerivedPath(node as never, depOf, childrenOf);
      }
    }, FRAME);
  }
});
