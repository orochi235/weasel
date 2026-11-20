/**
 * A cull never skips a node by a stored pose box it is not shown at: a derived node goes unmeasured, and a
 * pose override's path is measured, by the headless scene view and the `<SceneCanvas>` scene slot alike.
 */
import { describe, expect, it } from 'vitest';
import { linePath, polygonFromPoints, type Path } from '@weasel-js/geom';
import { solidStroke, type Stroke } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';
import { buildSceneViewCommands } from './sceneViewRender';
import { wireSceneSlotToScene } from './sceneSlotWiring';

type Data = { path?: Path; stroke?: Stroke };

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const OFF: RectPose = { x: 1000, y: 0, width: 50, height: 1 };

function edgeScene() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 1, height: 1 }, data: {} });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: { x: 60, y: 10, width: 1, height: 1 }, data: {} });
  const edge = scene.add({
    kind: 'mark', layer: 'main', pose: OFF,
    data: { path: linePath({ x: 0, y: 0 }, { x: 50, y: 0 }), stroke: solidStroke('#000', 2) },
    dependsOn: [a, b],
    derivePath: (_node, deps) => linePath(
      { x: deps[0]!.pose.x, y: deps[0]!.pose.y }, { x: deps[1]!.pose.x, y: deps[1]!.pose.y }),
  });
  return { scene, edge };
}

describe('the headless scene view\'s cull', () => {
  it('paints a node whose derived path is on screen, wherever its stored pose is', () => {
    const { scene, edge } = edgeScene();
    const drawn: string[] = [];
    const drawOne: typeof defaultDrawOne = (node, pose, view, ctx) => {
      drawn.push(node.id);
      return defaultDrawOne(node, pose, view, ctx);
    };
    buildSceneViewCommands(scene, VIEW, drawOne, undefined, undefined, undefined, undefined, {
      width: 100, height: 100, dpr: 1, paintBounds: defaultPaintBounds,
    });
    expect(drawn).toContain(edge);
  });
});

describe('the scene slot\'s paintBounds', () => {
  const slotOf = (scene: ReturnType<typeof edgeScene>['scene']) =>
    wireSceneSlotToScene({ drawOne: defaultDrawOne, paintBounds: defaultPaintBounds, cull: true }, scene);

  it('leaves a derived node unmeasured, so it is never culled', () => {
    const { scene, edge } = edgeScene();
    expect(slotOf(scene).paintBounds!(scene.get(edge)!, OFF, VIEW)).toBeNull();
  });

  it('measures a pose override\'s path', () => {
    const { scene } = edgeScene();
    const plain = scene.add({
      kind: 'mark', layer: 'main', pose: OFF,
      data: { path: linePath({ x: 0, y: 0 }, { x: 50, y: 0 }), stroke: solidStroke('#000', 2) },
    });
    scene.overrides.set(plain, { path: polygonFromPoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 20 }]) });
    const b = slotOf(scene).paintBounds!(scene.get(plain)!, OFF, VIEW);
    expect(b!.x).toBeLessThan(100);
  });
});
