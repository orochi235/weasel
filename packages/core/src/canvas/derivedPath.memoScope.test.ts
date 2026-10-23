import { describe, it, expect } from 'vitest';
import { wireSceneSlotToScene } from './sceneSlotWiring';
import { defaultDrawOne } from './defaultDrawOne';
import { createScene } from 'core/scene/scene';
import { nodeMemoSlotCount } from 'core/scene/nodeMemo';
import type { DerivedDep, Node, RectPose } from 'core/scene/types';
import { linePath } from '@weasel-js/geom';

type Data = { lift?: number };
const pose = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });

/** Two anchors and an edge between them, raised by the first anchor's
 *  `data.lift` so the derivation reads something a pose compare cannot see. */
function makeEdgeScene() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: pose(0), data: {} });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: pose(100), data: {} });
  const edge = scene.add({
    kind: 'mark', layer: 'main', pose: pose(0), data: {},
    dependsOn: [a, b],
    derivePath: (_n: Node<unknown, string, RectPose>, deps: readonly (DerivedDep<RectPose> | undefined)[]) => {
      const from = deps[0];
      const to = deps[1];
      if (!from || !to) return null;
      const lift = (from.node.data as Data).lift ?? 0;
      return linePath({ x: from.pose.x, y: from.pose.y - lift }, { x: to.pose.x, y: to.pose.y - lift });
    },
  });
  return { scene, a, b, edge };
}

describe('a slot toPose and the derived-path memo', () => {
  it('keeps nothing on the node per toPose identity', () => {
    const { scene, edge } = makeEdgeScene();
    const node = scene.get(edge)!;
    for (let i = 0; i < 50; i++) {
      // A slot config rebuilt with an inline arrow: a new identity each time.
      const toPose = (n: Node<Data, 'main', RectPose>): RectPose => ({ ...n.pose, y: n.pose.y + 7 });
      const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne, toPose }, scene);
      expect(slot.derivedPathOf!(node, node.pose)).toEqual(linePath({ x: 0, y: 7 }, { x: 100, y: 7 }));
    }
    // The painter match and silhouette may sit here; fifty paths may not.
    expect(nodeMemoSlotCount(node)).toBeLessThan(5);
  });

  it('still drops a toPose reader\'s path when the scene pushes an invalidation', () => {
    const { scene, a, edge } = makeEdgeScene();
    const toPose = (n: Node<Data, 'main', RectPose>): RectPose => n.pose;
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne, toPose }, scene);
    const node = scene.get(edge)!;
    expect(slot.derivedPathOf!(node, node.pose)).toEqual(linePath({ x: 0, y: 0 }, { x: 100, y: 0 }));
    scene.update(a, { data: { lift: 5 } });
    expect(slot.derivedPathOf!(node, node.pose)).toEqual(linePath({ x: 0, y: -5 }, { x: 100, y: -5 }));
  });

  it('serves one toPose its cached path', () => {
    const { scene, edge } = makeEdgeScene();
    const toPose = (n: Node<Data, 'main', RectPose>): RectPose => n.pose;
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne, toPose }, scene);
    const node = scene.get(edge)!;
    expect(slot.derivedPathOf!(node, node.pose)).toBe(slot.derivedPathOf!(node, node.pose));
  });
});
