import { describe, expect, it } from 'vitest';
import { polygonFromPoints, type Path, type PolygonPath } from '@weasel-js/geom';
import { createScene } from '../../core/scene/scene';
import { effectivePose } from '../../core/scene/effectivePose';
import type { NodeId, RectPose } from '../../core/scene/types';
import { bindRig } from './bindRig';
import type { Skin } from '@weasel-js/animator';
import type { Skeleton } from '@weasel-js/animator';

type Data = { path?: Path; fill?: string; outline?: Path };

// A two-bone arm: shoulder at (100, 100) pointing +x, elbow 50 along it.
const ARM: Skeleton = {
  joints: [
    { name: 'upper', parent: null, bind: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'lower', parent: 'upper', bind: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
  ],
};
const BOX: RectPose = { x: 100, y: 95, width: 100, height: 10 };
/** The sleeve's corners clockwise from the top left: the left pair on `upper`, the right on `lower`. */
const SLEEVE: Skin = { upper: [1, 0, 0, 1], lower: [0, 1, 1, 0] };
const BENT = { lower: { rotation: Math.PI / 2 } };

function sleeveScene(pose: RectPose = BOX) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const sleeve = scene.add({
    kind: 'mark', layer: 'main', pose,
    data: { path: { kind: 'rect', x: 100, y: 95, width: 100, height: 10 }, fill: '#c33' },
  });
  return { scene, sleeve };
}

const shown = (scene: ReturnType<typeof sleeveScene>['scene'], id: NodeId): number[] => {
  const path = scene.overrides.read(id)?.path as PolygonPath;
  return Array.from(path.coords, (v) => Math.round(v * 1000) / 1000);
};

describe('bindRig with skins', () => {
  it('shows the path as it rests at the bind pose', () => {
    const { scene, sleeve } = sleeveScene();
    bindRig({ scene, skeleton: ARM, skins: { [sleeve]: SLEEVE } }).pose({});
    expect(shown(scene, sleeve)).toEqual([100, 95, 200, 95, 200, 105, 100, 105]);
    expect(effectivePose(scene, scene.get(sleeve)!)).toEqual(BOX);
  });

  it('bends the path with the joints, and poses the node at the bent path\'s bounds', () => {
    const { scene, sleeve } = sleeveScene();
    bindRig({ scene, skeleton: ARM, skins: { [sleeve]: SLEEVE } }).pose(BENT);
    expect(shown(scene, sleeve)).toEqual([100, 95, 155, 150, 145, 150, 100, 105]);
    expect(effectivePose(scene, scene.get(sleeve)!)).toEqual({ x: 100, y: 95, width: 55, height: 55 });
    expect(scene.get(sleeve)!.pose).toEqual(BOX);
  });

  it('skins a turned node from where it is drawn, and shows it with no turn left to apply', () => {
    const { scene, sleeve } = sleeveScene({ ...BOX, rotation: Math.PI / 2 });
    bindRig({ scene, skeleton: ARM, skins: { [sleeve]: SLEEVE } }).pose({});
    expect(shown(scene, sleeve)).toEqual([155, 50, 155, 150, 145, 150, 145, 50]);
    const pose = effectivePose(scene, scene.get(sleeve)!);
    expect(pose).toMatchObject({ x: 145, y: 50, width: 10, height: 100 });
    expect(pose.rotation ?? 0).toBe(0);
  });

  it('carries skinned and bound nodes in one rig', () => {
    const { scene, sleeve } = sleeveScene();
    const hand = scene.add({ kind: 'mark', layer: 'main', pose: { x: 190, y: 90, width: 20, height: 20 }, data: {} });
    bindRig({ scene, skeleton: ARM, bindings: { lower: hand }, skins: { [sleeve]: SLEEVE } }).pose(BENT);
    expect(shown(scene, sleeve)).toEqual([100, 95, 155, 150, 145, 150, 100, 105]);
    const at = effectivePose(scene, scene.get(hand)!);
    expect(at.x + at.width / 2).toBeCloseTo(150, 4);
    expect(at.y + at.height / 2).toBeCloseTo(150, 4);
  });

  it('moves with the rig when it is placed', () => {
    const { scene, sleeve } = sleeveScene();
    const rig = bindRig({ scene, skeleton: ARM, skins: { [sleeve]: SLEEVE } });
    rig.place(new Float32Array([1, 0, 0, 0, 1, 0, 10, 20, 1]));
    expect(shown(scene, sleeve)).toEqual([110, 115, 210, 115, 210, 125, 110, 125]);
  });

  it('drops the path with the overrides on release', () => {
    const { scene, sleeve } = sleeveScene();
    const rig = bindRig({ scene, skeleton: ARM, skins: { [sleeve]: SLEEVE } });
    rig.pose(BENT);
    rig.release();
    expect(scene.overrides.read(sleeve)).toBeUndefined();
  });

  it('bakes the bent path and its bounds into the document as one undo entry', () => {
    const { scene, sleeve } = sleeveScene();
    const rig = bindRig({ scene, skeleton: ARM, skins: { [sleeve]: SLEEVE } });
    rig.pose(BENT);
    rig.bake();
    expect(scene.overrides.read(sleeve)).toBeUndefined();
    const node = scene.get(sleeve)!;
    expect(node.pose).toEqual({ x: 100, y: 95, width: 55, height: 55 });
    expect(Array.from((node.data.path as PolygonPath).coords, Math.round)).toEqual([100, 95, 155, 150, 145, 150, 100, 105]);
    expect(node.data.fill).toBe('#c33');
    scene.undo();
    expect(scene.get(sleeve)!.pose).toEqual(BOX);
    expect(scene.get(sleeve)!.data.path).toEqual({ kind: 'rect', x: 100, y: 95, width: 100, height: 10 });
    // Later frames bend the path as it was bound, not the baked one.
    rig.pose(BENT);
    expect(shown(scene, sleeve)).toEqual([100, 95, 155, 150, 145, 150, 100, 105]);
  });

  it('reads the rest path through `restPath` where the data keeps it elsewhere', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const outline = polygonFromPoints([{ x: 100, y: 100 }, { x: 200, y: 100 }]);
    const id = scene.add({ kind: 'mark', layer: 'main', pose: BOX, data: { outline } });
    bindRig({
      scene, skeleton: ARM, skins: { [id]: { upper: [1, 0], lower: [0, 1] } },
      restPath: (node) => (node.data as Data).outline ?? null,
    }).pose(BENT);
    expect(shown(scene, id)).toEqual([100, 100, 150, 150]);
  });

  it('throws on a skin it cannot bind', () => {
    const { scene, sleeve } = sleeveScene();
    const bare = scene.add({ kind: 'mark', layer: 'main', pose: BOX, data: {} });
    const bind = (skins: Record<string, Skin>, bindings = {}) =>
      () => bindRig({ scene, skeleton: ARM, bindings, skins });
    expect(bind({ nope: SLEEVE })).toThrow(/"nope", which the scene lacks/);
    expect(bind({ [bare]: SLEEVE })).toThrow(/has no path to skin/);
    expect(bind({ [sleeve]: { knee: [1, 1, 1, 1] } })).toThrow(/no joint "knee"/);
    expect(bind({ [sleeve]: SLEEVE }, { upper: sleeve })).toThrow(/both bound to joint "upper" and skinned/);
  });
});

describe('a node that derives from a skinned one', () => {
  it('is handed the bent path, and the rest of what it reads once the rig lets go', () => {
    const { scene, sleeve } = sleeveScene();
    /** Sits on the second point of the path its dependency shows. */
    const tag = scene.add({
      kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 2, height: 2 }, data: {},
      dependsOn: [sleeve],
      derivePose: (_node, deps) => {
        const path = deps[0]?.path;
        return path?.kind === 'polygon' ? { x: path.coords[2], y: path.coords[3], width: 2, height: 2 } : null;
      },
    });
    const at = () => effectivePose(scene, scene.get(tag)!);
    const rig = bindRig({ scene, skeleton: ARM, skins: { [sleeve]: SLEEVE } });
    rig.pose(BENT);
    expect(at()).toMatchObject({ x: 155, y: 150 });
    rig.release();
    expect(at()).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });
});
