/**
 * A 3D world over an editing session picks what that session previews, while a world over the
 * scene, or over another session, picks the document; a commit reaches them all.
 */
import { describe, expect, it } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, createEditingSession, createScene } from '@weasel-js/core';
import { createCamera } from './camera';
import { createNodeAtPoint3dDep } from './deps';
import { pose3, type Pose3 } from './pose3';
import type { Viewport3d } from './project';
import { boundsOfTestNode, type TestData, type TestLayer, type TestScene } from './testScene';
import type { World3d } from './world';

const WIDTH = 800;
const HEIGHT = 600;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const AWAY = pose3({ x: 40, y: 0, z: 0 });

function worldOver(scene: TestScene): World3d<TestData, TestLayer> {
  const vp: Viewport3d = { camera: createCamera({ distance: 10 }), width: WIDTH, height: HEIGHT };
  return { scene, viewport: () => vp, bounds: boundsOfTestNode };
}

describe('kernel3d over editing sessions', () => {
  it('picks through the previews of the session its world was handed', () => {
    const scene = createScene<TestData, TestLayer, Pose3>({ composition: IDENTITY_POSE_COMPOSITION,
      systemLayers: [{ id: 'solids' }],
      initial: [{ kind: 'mark', layer: 'solids', pose: pose3({ x: 0, y: 0, z: 0 }), data: {} }],
    });
    const [id] = [...scene.renderOrder()];
    const dragging = createEditingSession(scene);
    const watching = createEditingSession(scene);
    const pickDragging = createNodeAtPoint3dDep(worldOver(dragging));
    const pickWatching = createNodeAtPoint3dDep(worldOver(watching));
    const pickScene = createNodeAtPoint3dDep(worldOver(scene));

    dragging.overrides.set(id!, { pose: AWAY });
    expect(pickDragging(CENTER)).toBeNull();
    expect(pickWatching(CENTER)).toBe(id);
    expect(pickScene(CENTER)).toBe(id);

    dragging.overrides.clear(id!);
    dragging.setPose(id!, AWAY);
    expect(pickWatching(CENTER)).toBeNull();
    expect(pickScene(CENTER)).toBeNull();
  });
});
