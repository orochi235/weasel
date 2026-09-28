import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { hitTestArea, hitTestLassoPolygon, regionPickOptions } from './hitTestArea';

type Pose = { x: number; y: number; width: number; height: number };
const CAMERA: View = { x: 400, y: 0, scale: { x: 1, y: 1 } };

function makeScene() {
  // The backdrop has slid 100 while the camera slid 400, so `hill`, stored at
  // x=0, paints under camera-world x=300.
  return createScene<unknown, 'back' | 'main', Pose>({
    systemLayers: [{ id: 'back', parallax: { pan: 0.25 } }, { id: 'main' }],
    initial: [
      { id: asNodeId('hill'), kind: 'leaf', layer: 'back', pose: { x: 0, y: 0, width: 50, height: 50 }, data: {} },
      { id: asNodeId('crate'), kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 20, height: 20 }, data: {} },
    ],
  }) as never;
}

describe('region picks over parallax layers', () => {
  it('marquees a plane node where it is painted', () => {
    const scene = makeScene();
    const opts = { camera: CAMERA };
    expect(hitTestArea(scene, { x: 290, y: -10, width: 30, height: 30 }, opts)).toEqual(['hill']);
    expect(hitTestArea(scene, { x: -10, y: -10, width: 30, height: 30 }, opts)).toEqual(['crate']);
  });

  it('lassos through the plane too', () => {
    const scene = makeScene();
    const tri = [{ x: 280, y: -20 }, { x: 380, y: -20 }, { x: 330, y: 80 }];
    expect(hitTestLassoPolygon(scene, tri, 'intersect', { camera: CAMERA })).toEqual(['hill']);
  });

  it('reads the camera off the asking view', () => {
    const opts = regionPickOptions({ get: () => CAMERA }, undefined, undefined);
    expect(opts.camera).toBe(CAMERA);
  });
});
