/**
 * A selection holding a frame-defining group and a node inside it: the
 * group's write carries the node, so the node is not written again.
 */
import { describe, it, expect } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { makeFrameFixture, expectSamePose, FRAME_FIXTURE_IDS, FRAME_FIXTURE_LOCAL } from 'core/scene/frameFixture';
import { IDENTITY_POSE_COMPOSITION, type PoseComposition } from 'core/scene/composePose';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { alignRightAction } from './align/action';
import { distributeHorizontalAction } from './distribute/action';
import { flipAction } from './flip/action';
import { rotateSelectionOps } from './rotate/replay';
import { scenePoseFrame } from './poseFrame';
import { shapeSources } from './selectionSubtree';

type AnyScene = Scene<unknown, string, unknown>;
const { group, upright, turned } = FRAME_FIXTURE_IDS;
const r = asNodeId('r');
const s = asNodeId('s');

function makeScene(composition?: PoseComposition<RectPose>): AnyScene {
  const scene = makeFrameFixture(composition);
  scene.add({ id: r, kind: 'mark', layer: 'main', data: { label: 'r' }, pose: { x: 200, y: 0, width: 10, height: 10 } });
  scene.add({ id: s, kind: 'mark', layer: 'main', data: { label: 's' }, pose: { x: 300, y: 0, width: 10, height: 10 } });
  return scene as unknown as AnyScene;
}

function run(action: { invoker?: unknown }, scene: AnyScene, ids: NodeId[], params?: Record<string, unknown>) {
  (action.invoker as ImmediateInvoker).run({ selection: { get: () => ids }, scene } as never, params as never);
}

const localOf = (scene: AnyScene, id: NodeId) => scene.get(id)!.pose as RectPose;

describe('a selected node inside a selected frame', () => {
  it('rides along with the group when aligned', () => {
    const scene = makeScene();
    run(alignRightAction, scene, [group, upright, r]);
    // The group moves right by 110 to meet r's right edge at 210; its child keeps its place in it.
    expect(scenePoseFrame(scene).world(group)).toMatchObject({ x: 110, y: 0 });
    expectSamePose(localOf(scene, upright), FRAME_FIXTURE_LOCAL.a);
  });

  it('rides along with the group when distributed', () => {
    const scene = makeScene();
    run(distributeHorizontalAction, scene, [group, turned, r, s]);
    expectSamePose(localOf(scene, turned), FRAME_FIXTURE_LOCAL.b);
  });

  it('rides along with the group when flipped', () => {
    const scene = makeScene();
    run(flipAction, scene, [group, upright], { axis: 'x', pivot: 'union' });
    expectSamePose(localOf(scene, upright), FRAME_FIXTURE_LOCAL.a);
  });

  it('is left out of a rotation, which turns the group alone', () => {
    const scene = makeScene();
    const ops = rotateSelectionOps(scene, [group, upright, turned], {}, Math.PI / 6, 'union', 'Rotate');
    expect(ops.map((op) => (op.args as { id: string }).id)).toEqual([group]);
  });

  it('is still written where the scene composes nothing', () => {
    const scene = makeScene(IDENTITY_POSE_COMPOSITION as PoseComposition<RectPose>);
    expect(shapeSources(scene, [group, upright])).toEqual([group, upright]);
  });
});
