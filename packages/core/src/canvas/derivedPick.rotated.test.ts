import { describe, expect, it } from 'vitest';
import { linePath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { DerivedDep, Node, RectPose } from 'core/scene/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { pickWalk, scenePickSource } from './pickWalk';
import { scenePointQuery } from './SceneCanvas/scenePointQuery';

const STROKE = { stroke: { paint: { color: '#000' }, width: 4 } };

/** A 200×200 group turned 90° about its center (100, 100), holding `a` and
 *  `b` at local centers (25, 100) and (175, 100) and a connector between them,
 *  which paints from (100, 25) to (100, 175). */
function turnedConnector() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 200, height: 200, rotation: Math.PI / 2 } });
  const a = scene.add({ kind: 'mark', parent: box, layer: 'main', data: {}, pose: { x: 20, y: 95, width: 10, height: 10 } });
  const b = scene.add({ kind: 'mark', parent: box, layer: 'main', data: {}, pose: { x: 170, y: 95, width: 10, height: 10 } });
  const edge = scene.add({
    kind: 'mark', parent: box, layer: 'main', data: STROKE, pose: { x: 0, y: 0, width: 0, height: 0 },
    dependsOn: [a, b],
    derivePath: (_n: Node<unknown, string, RectPose>, deps: readonly (DerivedDep<RectPose> | undefined)[]) => {
      const [from, to] = deps.map((d) => d?.pose);
      return from && to
        ? linePath({ x: from.x + from.width / 2, y: from.y + from.height / 2 }, { x: to.x + to.width / 2, y: to.y + to.height / 2 })
        : null;
    },
  });
  return { scene, edge };
}

const pickAt = (scene: ReturnType<typeof turnedConnector>['scene'], x: number, y: number): string[] =>
  pickWalk(scenePickSource(scene), scenePointQuery(AUTO_POSE_DESCRIPTOR, true, 1)(x, y, { x: 1, y: 1 }));

describe('a connector inside a turned group', () => {
  it('is picked on its painted ink', () => {
    const { scene, edge } = turnedConnector();
    expect(pickAt(scene, 100, 60)).toContain(edge);
    expect(pickAt(scene, 100, 150)).toContain(edge);
  });

  it('is not picked where the group’s turn would put it a second time', () => {
    const { scene, edge } = turnedConnector();
    expect(pickAt(scene, 60, 100)).not.toContain(edge);
    expect(pickAt(scene, 150, 100)).not.toContain(edge);
  });
});

describe('a node deriving only its pose inside a turned group', () => {
  it('is picked where the group’s turn paints it', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 200, height: 200, rotation: Math.PI / 2 } });
    const a = scene.add({ kind: 'mark', parent: box, layer: 'main', data: {}, pose: { x: 0, y: 0, width: 4, height: 4 } });
    // A local bar along y = 100, which the quarter turn paints along x = 100.
    const bar = scene.add({
      kind: 'mark', parent: box, layer: 'main', data: {}, pose: { x: 0, y: 0, width: 0, height: 0 },
      dependsOn: [a], derivePose: () => ({ x: 50, y: 95, width: 100, height: 10 }),
    });
    expect(pickAt(scene, 100, 60)).toContain(bar);
    expect(pickAt(scene, 60, 100)).not.toContain(bar);
  });
});
