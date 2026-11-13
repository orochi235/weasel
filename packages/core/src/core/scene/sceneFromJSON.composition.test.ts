import { describe, expect, it } from 'vitest';
import { IDENTITY_POSE_COMPOSITION } from './composeFrame';
import { createScene, sceneFromJSON } from './scene';
import type { NodeId } from './types';

/** A pose the rigid default cannot fold: a 3D one, as kernel3d's `Pose3` is. */
type Solid = { position: { x: number; y: number; z: number }; rotation: number[]; scale: { x: number; y: number; z: number } };
const solid = (x: number): Solid => ({ position: { x, y: 0, z: 0 }, rotation: [0, 0, 0, 1], scale: { x: 1, y: 1, z: 1 } });

function saved(nested: boolean) {
  const g = 'g' as NodeId;
  return createScene<object, 'a', Solid>({
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'a' }],
    initial: [
      { id: g, kind: 'group', layer: 'a', pose: solid(1), data: {} },
      { id: 'c' as NodeId, kind: 'mark', layer: 'a', parent: nested ? g : null, pose: solid(2), data: {} },
    ],
  }).toJSON();
}

describe('sceneFromJSON without a composition', () => {
  it('refuses a nested pose the default composition cannot fold, and says to pass one', () => {
    expect(() => sceneFromJSON(saved(true))).toThrow(/node "c".*not a rect.*composition/s);
  });

  it('is refused by loadState into a scene on the default composition, which is left as it was', () => {
    const rect = createScene<object, 'a'>({ systemLayers: [{ id: 'a' }] });
    expect(() => rect.loadState(saved(true) as never)).toThrow(/not a rect/);
    expect(rect.renderOrderNodes()).toEqual([]);
  });

  it('loads it once told the composition', () => {
    const scene = sceneFromJSON(saved(true), { composition: IDENTITY_POSE_COMPOSITION });
    expect(scene.get('c' as NodeId)!.pose).toEqual(solid(2));
  });

  it('loads such poses at the top of the tree, where nothing composes them', () => {
    expect(sceneFromJSON(saved(false)).get('c' as NodeId)!.pose).toEqual(solid(2));
  });

  it('loads a nested rect scene as before', () => {
    const g = 'g' as NodeId;
    const json = createScene<object, 'a'>({
      systemLayers: [{ id: 'a' }],
      initial: [
        { id: g, kind: 'group', layer: 'a', pose: { x: 10, y: 10, width: 5, height: 5 }, data: {} },
        { id: 'c' as NodeId, kind: 'mark', layer: 'a', parent: g, pose: { x: 1, y: 1, width: 2, height: 2 }, data: {} },
      ],
    }).toJSON();
    expect(sceneFromJSON(json).get('c' as NodeId)!.pose).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  });
});
