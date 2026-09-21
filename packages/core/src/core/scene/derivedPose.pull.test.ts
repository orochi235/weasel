/**
 * What `derivedPose` notices on its own, with no invalidation pushed at it.
 *
 * The memo is keyed on the deriving node's own authored pose, so every case
 * here moves a *dependency* behind the scene's back — leaving that key
 * untouched — and asks for the derived pose again. The mirror of
 * `derivedPath.test.ts`, for the pose half.
 */
import { describe, it, expect } from 'vitest';
import { derivedPose, type PosedNode, type PoseSource } from './effectivePose';
import type { DerivedDep, NodeId, RectPose } from './types';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

/**
 * A midpoint node depending on `a` and `b`, over a scene whose nodes are
 * mutable objects. `derives` counts the calls `derivePose` actually made.
 */
function midpointOver(nodes: Map<string, PosedNode<RectPose>>) {
  const derives = { count: 0 };
  const node: PosedNode<RectPose> = {
    id: 'mid' as NodeId,
    pose: box(0, 0),
    data: {},
    dependsOn: ['a', 'b'] as NodeId[],
    derivePose: (_n: never, deps: readonly (DerivedDep<RectPose> | undefined)[]): RectPose | null => {
      derives.count++;
      const [from, to] = deps;
      if (from === undefined || to === undefined) return null;
      return box((from.pose.x + to.pose.x) / 2, (from.pose.y + to.pose.y) / 2);
    },
  };
  const source: PoseSource<RectPose> = {
    overrides: { get: () => undefined },
    get: (id) => (id === 'mid' ? node : nodes.get(id)),
    childrenOf: () => [],
  };
  return { node, derives, resolve: () => derivedPose(source, node) };
}

const sceneOf = () =>
  new Map<string, PosedNode<RectPose>>([
    ['a', { id: 'a' as NodeId, pose: box(0, 0) }],
    ['b', { id: 'b' as NodeId, pose: box(100, 0) }],
  ]);

describe('derivedPose — value comparison of the resolved poses', () => {
  it('serves the memo when every dependency resolves to the same pose', () => {
    const nodes = sceneOf();
    const { resolve, derives } = midpointOver(nodes);
    expect(resolve()?.x).toBe(50);
    expect(resolve()?.x).toBe(50);
    expect(derives.count).toBe(1);
  });

  it('re-derives when a dependency pose is mutated in place', () => {
    const nodes = sceneOf();
    const { resolve, derives } = midpointOver(nodes);
    expect(resolve()?.x).toBe(50);
    // An override buffer mutates its pose in place, so the object the memo
    // recorded and the one the scene now holds are the same reference.
    nodes.get('b')!.pose.x = 200;
    expect(resolve()?.x).toBe(100);
    expect(derives.count).toBe(2);
  });

  it('re-derives when a dependency is swapped for another node', () => {
    const nodes = sceneOf();
    const { resolve, derives } = midpointOver(nodes);
    expect(resolve()?.x).toBe(50);
    // A restored clone carries the same pose and is a different node.
    nodes.set('b', { id: 'b' as NodeId, pose: box(100, 0) });
    resolve();
    expect(derives.count).toBe(2);
  });

  it('re-derives when a dependency disappears', () => {
    const nodes = sceneOf();
    const { resolve, derives } = midpointOver(nodes);
    expect(resolve()?.x).toBe(50);
    nodes.delete('b');
    expect(resolve()).toBeNull();
    expect(derives.count).toBe(2);
  });
});
