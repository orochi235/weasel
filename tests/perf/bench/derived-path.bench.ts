/**
 * What a frame of derived paths costs now that the resolver value-compares its
 * dependencies.
 *
 * `resolveDerivedPath` re-resolves every dependency on a memo hit and compares
 * the poses against the ones the cached path was drawn from, so a dependency
 * that moved with nothing pushed behind it is still noticed. The first suite
 * is that frame: the steady state, where nothing moved and every node keeps
 * its path.
 *
 * The second is the floor the same pass could reach — it reads each pose
 * straight off the scene and compares four named fields, where the resolver
 * builds a `DerivedDep` per dependency and compares an opaque `TPose`
 * structurally. The gap between them is what generality over the pose type
 * costs.
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

describe('a frame of derived paths — memo hit, value-comparing the deps', () => {
  for (const [nodes, edges] of SHAPES) {
    const { scene, edgeIds, depOf, childrenOf } = frameOf(nodes, edges);
    // Prime the memo, so the timed iterations are the steady state.
    for (const id of edgeIds) resolveDerivedPath(scene.get(id)! as never, depOf, childrenOf);
    bench(`${nodes} nodes, ${edges} edges`, () => {
      for (const id of edgeIds) resolveDerivedPath(scene.get(id)! as never, depOf, childrenOf);
    }, FRAME);
  }
});

describe('the floor: the same frame, comparing named fields off the scene', () => {
  for (const [nodes, edges] of SHAPES) {
    const { scene, edgeIds, depOf, childrenOf } = frameOf(nodes, edges);
    for (const id of edgeIds) resolveDerivedPath(scene.get(id)! as never, depOf, childrenOf);
    // What the check holds from the previous frame.
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
