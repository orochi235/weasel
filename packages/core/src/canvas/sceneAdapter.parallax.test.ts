/**
 * A bare scene adapter's region picks cross into a parallax plane when told
 * the camera the region was drawn under.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { sceneToAdapter } from './sceneAdapter';

type Pose = { x: number; y: number; width: number; height: number };

// Camera at 2x over a plane that does not zoom: plane = 2 * camera, so `sun`
// paints over camera 20..30.
const view = { get: () => ({ x: 0, y: 0, scale: { x: 2, y: 2 } }) };

function adapter() {
  const scene = createScene<unknown, 'sky', Pose>({
    systemLayers: [{ id: 'sky', parallax: { pan: 1, zoom: 0 } }],
    initial: [{ id: asNodeId('sun'), kind: 'leaf', layer: 'sky', pose: { x: 40, y: 40, width: 20, height: 20 }, data: {} }],
  });
  return sceneToAdapter(scene);
}

describe('sceneToAdapter — region picks on a parallax layer', () => {
  it('marquees a plane node where the asking camera draws it', () => {
    const a = adapter();
    expect(a.hitTestArea!({ x: 18, y: 18, width: 4, height: 4 }, view)).toEqual(['sun']);
    expect(a.hitTestArea!({ x: 45, y: 45, width: 10, height: 10 }, view)).toEqual([]);
  });

  it('lassos a plane node where the asking camera draws it', () => {
    const a = adapter();
    const around = (c: number) => [{ x: c - 3, y: c - 3 }, { x: c + 3, y: c - 3 }, { x: c, y: c + 3 }];
    expect(a.hitTestLasso!(around(25), 'intersect', view)).toEqual(['sun']);
    expect(a.hitTestLasso!(around(50), 'intersect', view)).toEqual([]);
  });
});
