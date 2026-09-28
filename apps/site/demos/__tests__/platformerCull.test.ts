import { describe, expect, it, vi } from 'vitest';
import {
  createScene, defaultDrawOne, getNodeShapes, RIGID_POSE_COMPOSITION, sceneToAdapter,
  type DrawCommand, type RectPose, type View,
} from '@weasel-js/core';
import { buildSceneLayer } from 'canvas/Canvas';
import { mergeLayersWithDefaults } from 'canvas/SceneCanvas';
import { WORLD } from '../platformer/worldLevel';
import { freshGame, POLE } from '../platformer/world';
import { cameraView } from '../platformer/camera';
import { TILE } from '../platformer/level';
import {
  boneNodes, entityNodes, flagpoleNodes, syncScene, tileNodes,
  type WorldData, type WorldLayer,
} from '../platformer/sceneWorld';

/** The demo's canvas size and scene, and its scene slot as `<SceneCanvas>`
 *  merges it. */
const DIMS = { width: 720, height: 405 };

function demoWorld() {
  const game = freshGame();
  const scene = createScene<WorldData, WorldLayer, RectPose>({
    systemLayers: [{ id: 'tiles' }, { id: 'entities' }, { id: 'player' }],
  });
  for (const spec of [
    ...tileNodes(WORLD), ...entityNodes(game.coins, game.enemies), ...flagpoleNodes(POLE), ...boneNodes(),
  ]) scene.add(spec);
  syncScene(scene, game);
  return { game, scene };
}

function paintCalls(cull: boolean, view: View): { calls: number; nodes: number } {
  const { scene } = demoWorld();
  const slot = mergeLayersWithDefaults<WorldData, WorldLayer, RectPose>({
    scene: { drawOne: defaultDrawOne as never, cull },
  }).scene;
  const layer = buildSceneLayer(
    slot as never,
    sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION }) as never,
    null, () => null, () => null,
  );
  const spies = getNodeShapes().map((p) => vi.spyOn(p, 'paint'));
  layer.draw(null, view, DIMS) as DrawCommand[];
  const calls = spies.reduce((n, s) => n + s.mock.calls.length, 0);
  for (const s of spies) s.mockRestore();
  return { calls, nodes: [...scene.renderOrder()].length };
}

describe('the side-scroller with view culling', () => {
  it('skips the painter for every node the camera cannot see', () => {
    const view = cameraView(demoWorld().game.camera, DIMS);
    const off = paintCalls(false, view);
    const on = paintCalls(true, view);
    expect(off.calls).toBe(off.nodes);
    expect(on.calls).toBeLessThan(off.calls / 2);
  });

  it('culls against wherever the camera is', () => {
    const at = { x: WORLD.cols * TILE * 0.6, y: WORLD.rows * TILE * 0.5 };
    const view = cameraView({ ...demoWorld().game.camera, ...at }, DIMS);
    const off = paintCalls(false, view);
    const on = paintCalls(true, view);
    expect(on.calls).toBeGreaterThan(0);
    expect(on.calls).toBeLessThan(off.calls);
  });
});
