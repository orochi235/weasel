import { describe, it, expect, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import type { View } from 'core/viewport/view';
import { deriveParallaxView } from 'core/viewport/parallax';
import { viewToMat3 } from '../renderer/math/viewToMat3';
import { mat3, type GlMat3 } from '../renderer/math/mat3';
import { buildSceneViewCommands } from './sceneViewRender';

type Pose = { x: number; y: number; width: number; height: number };
const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const CAMERA: View = { x: 200, y: 40, scale: { x: 2, y: 2 } };
const SKY = { pan: 0.25, zoom: 0.5 };

function makeScene() {
  const scene = createScene<unknown, 'sky' | 'main', Pose>({
    systemLayers: [{ id: 'sky', parallax: SKY }, { id: 'main' }],
  });
  scene.add({ kind: 'leaf', layer: 'sky', pose: POSE, data: {} });
  scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: {} });
  return scene;
}

function close(a: ArrayLike<number>, b: ArrayLike<number>) {
  for (let i = 0; i < 9; i++) expect(a[i]).toBeCloseTo(b[i], 3);
}

describe('buildSceneTree — parallax layers', () => {
  it('paints a parallax layer through its derived view, and the rest through the camera', () => {
    const scene = makeScene();
    const drawOne = vi.fn(() => []);
    buildSceneTree(sceneToAdapter(scene) as never, drawOne as never, CAMERA);
    const views = drawOne.mock.calls.map((c) => (c as unknown[])[2] as View);
    expect(views[0]).toEqual(deriveParallaxView(CAMERA, SKY));
    expect(views[1]).toBe(CAMERA);
  });

  it('wraps the plane in the transform that lands it where its own view would', () => {
    const scene = makeScene();
    const out = buildSceneTree(sceneToAdapter(scene) as never, (() => []) as never, CAMERA);
    const sky = out[0] as { transform?: GlMat3 };
    const main = out[1] as { transform?: GlMat3 };
    expect(main.transform).toBeUndefined();
    // The canvas adds the camera's transform on top; the two together must be
    // the plane's own view.
    close(mat3.multiply(viewToMat3(CAMERA), sky.transform!), viewToMat3(deriveParallaxView(CAMERA, SKY)));
  });

  it('culls a parallax layer against its own view', () => {
    const scene = makeScene();
    const culled = vi.fn(() => false);
    buildSceneTree(sceneToAdapter(scene) as never, (() => []) as never, CAMERA, undefined, undefined, culled as never);
    expect((culled.mock.calls[0] as unknown[])[2]).toEqual(deriveParallaxView(CAMERA, SKY));
    expect((culled.mock.calls[1] as unknown[])[2]).toBe(CAMERA);
  });

  it('carries into the headless walk', () => {
    const scene = makeScene();
    const out = buildSceneViewCommands(scene, CAMERA, () => []);
    const layers = (out[0] as { children: { transform?: GlMat3 }[] }).children;
    expect(layers[0].transform).toBeDefined();
    expect(layers[1].transform).toBeUndefined();
  });
});
