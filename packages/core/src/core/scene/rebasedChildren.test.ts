/**
 * A group read from another frame still hands its derivation its children,
 * each in the reader's frame: nesting depth and where the group sits do not
 * change what a derivation reading `children` sees.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { effectivePose } from './effectivePose';
import type { DerivedDep, Node, NodeId, RectPose } from './types';

const rect = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });
type Deps = readonly (DerivedDep<RectPose> | undefined)[];

/** A reader at the root, deriving its pose from the first leaf `pick` finds under its one dependency. */
function readerOf(dependsOn: NodeId[] | 'children', pick: (deps: Deps) => DerivedDep<RectPose> | undefined) {
  return {
    kind: 'mark' as const, layer: 'main' as const, pose: rect(0, 0), data: {}, dependsOn,
    derivePose: (_n: Node<unknown, string, RectPose>, deps: Deps) => {
      const leaf = pick(deps);
      return leaf ? rect(leaf.pose.x, leaf.pose.y) : rect(-1, -1);
    },
  };
}

function sceneWithNesting() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const outer = scene.add({ kind: 'group', layer: 'main', pose: rect(100, 0), data: {} });
  const g1 = scene.add({ kind: 'group', layer: 'main', pose: rect(10, 0), data: {}, parent: outer });
  const g2 = scene.add({ kind: 'group', layer: 'main', pose: rect(20, 0), data: {}, parent: g1 });
  const leaf = scene.add({ kind: 'mark', layer: 'main', pose: rect(5, 7), data: {}, parent: g2 });
  return { scene, outer, g1, g2, leaf };
}

describe('a rebased dependency', () => {
  it('hands its children in the reader\'s frame', () => {
    const { scene, g2 } = sceneWithNesting();
    const r = scene.add(readerOf([g2], ([dep]) => dep?.children?.[0]));
    expect(effectivePose(scene, scene.get(r)!)).toMatchObject(rect(135, 7));
  });

  it('a group two deep under a read group still hands its children', () => {
    const { scene, outer } = sceneWithNesting();
    const r = scene.add(readerOf([outer], ([dep]) => dep?.children?.[0]?.children?.[0]?.children?.[0]));
    expect(effectivePose(scene, scene.get(r)!)).toMatchObject(rect(135, 7));
  });
});
