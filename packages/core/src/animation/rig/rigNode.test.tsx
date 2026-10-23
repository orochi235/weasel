import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Path, PolygonPath } from '@weasel-js/geom';
import { createScene } from '../../core/scene/scene';
import type { RectPose } from '../../core/scene/types';
import type { Rig } from './bindRig';
import { placeSkeleton, rigFromNode, unplaceSkeleton, useRigNode } from './rigNode';
import type { Skin } from '@weasel-js/animator';
import type { Skeleton } from '@weasel-js/animator';

type Data = { skeleton?: Skeleton; skin?: Skin; joint?: string; path?: Path };

/** Joints relative to the rig node's box: the shoulder 0 in and 50 down, the elbow 50 along. */
const ARM: Skeleton = {
  joints: [
    { name: 'upper', parent: null, bind: { x: 0, y: 50, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'lower', parent: 'upper', bind: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
  ],
};
const SLEEVE: Skin = { upper: [1, 0, 0, 1], lower: [0, 1, 1, 0] };
const BOX: RectPose = { x: 100, y: 50, width: 100, height: 100 };

function rigScene(pose: RectPose = BOX) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const rig = scene.add({ kind: 'group', layer: 'main', pose, data: { skeleton: ARM } });
  const sleeve = scene.add({
    kind: 'mark', layer: 'main', parent: rig, pose: { x: 100, y: 95, width: 100, height: 10 },
    data: { path: { kind: 'rect', x: 100, y: 95, width: 100, height: 10 }, skin: SLEEVE },
  });
  const inner = scene.add({ kind: 'group', layer: 'main', parent: rig, pose: BOX, data: {} });
  const hand = scene.add({
    kind: 'mark', layer: 'main', parent: inner, pose: { x: 190, y: 90, width: 20, height: 20 }, data: { joint: 'lower' },
  });
  const cuff = scene.add({
    kind: 'mark', layer: 'main', parent: rig, pose: { x: 180, y: 90, width: 5, height: 20 }, data: { joint: 'lower' },
  });
  return { scene, rig, sleeve, hand, cuff };
}

describe('rigFromNode', () => {
  it('places the skeleton at the node\'s box, leaving child joints as they are', () => {
    const { scene, rig } = rigScene();
    const { skeleton } = rigFromNode(scene, rig);
    expect(skeleton.joints[0].bind).toMatchObject({ x: 100, y: 100, rotation: 0 });
    expect(skeleton.joints[1]).toBe(ARM.joints[1]);
  });

  it('turns the root joints with a turned node', () => {
    const { scene, rig } = rigScene({ ...BOX, rotation: Math.PI / 2 });
    const root = rigFromNode(scene, rig).skeleton.joints[0].bind;
    // (100, 100) a quarter turn about the box's center, (150, 100).
    expect(root.x).toBeCloseTo(150, 4);
    expect(root.y).toBeCloseTo(50, 4);
    expect(root.rotation).toBeCloseTo(Math.PI / 2, 6);
  });

  it('gathers skins and joint bindings from every node under it', () => {
    const { scene, rig, sleeve, hand, cuff } = rigScene();
    const parts = rigFromNode(scene, rig);
    expect(parts.skins).toEqual({ [sleeve]: SLEEVE });
    expect(parts.bindings).toEqual({ lower: [hand, cuff] });
  });

  it('throws on a node with no skeleton', () => {
    const { scene, sleeve } = rigScene();
    expect(() => rigFromNode(scene, sleeve)).toThrow(/has no skeleton/);
    expect(() => rigFromNode(scene, 'nope' as never)).toThrow(/which the scene lacks/);
  });
});

describe('unplaceSkeleton', () => {
  it('undoes placeSkeleton, turned node included', () => {
    const pose = { ...BOX, rotation: 0.7 };
    const back = unplaceSkeleton(placeSkeleton(ARM, pose), pose);
    expect(back.joints[0].bind.x).toBeCloseTo(0, 4);
    expect(back.joints[0].bind.y).toBeCloseTo(50, 4);
    expect(back.joints[0].bind.rotation).toBeCloseTo(0, 6);
    expect(back.joints[1]).toBe(ARM.joints[1]);
  });
});

describe('useRigNode', () => {
  function mount(scene: ReturnType<typeof rigScene>['scene'], node: ReturnType<typeof rigScene>['rig']) {
    const seen: Rig[] = [];
    function Probe() {
      seen.push(useRigNode({ scene, node }));
      return null;
    }
    return { seen, ...render(<Probe />) };
  }

  it('skins the paths under the node', () => {
    const { scene, rig, sleeve } = rigScene();
    const { seen } = mount(scene, rig);
    seen[0].pose({ lower: { rotation: Math.PI / 2 } });
    const path = scene.overrides.read(sleeve)?.path as PolygonPath;
    expect(Array.from(path.coords, Math.round)).toEqual([100, 95, 155, 150, 145, 150, 100, 105]);
  });

  it('keeps its rig through an edit elsewhere, and binds again when what it read changes', () => {
    const { scene, rig, sleeve } = rigScene();
    const { seen } = mount(scene, rig);
    act(() => { scene.add({ kind: 'mark', layer: 'main', pose: BOX, data: {} }); });
    expect(seen[seen.length - 1]).toBe(seen[0]);
    act(() => { scene.update(sleeve, { data: { ...scene.get(sleeve)!.data, skin: { upper: [1, 1, 1, 1] } } }); });
    expect(seen[seen.length - 1]).not.toBe(seen[0]);
    act(() => { scene.setPose(rig, { ...BOX, x: 300 }); });
    expect(seen[seen.length - 1].skeleton.joints[0].bind.x).toBe(300);
  });
});
