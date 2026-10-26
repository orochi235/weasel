/**
 * Nudging a container on a real scene: its children have to come with it.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { makeFrameFixture, expectSamePose, FRAME_FIXTURE_IDS, FRAME_FIXTURE_LOCAL } from 'core/scene/frameFixture';
import { nudgeRightAction } from './nudge';

const G = asNodeId('g');
const A = asNodeId('a');
const B = asNodeId('b');

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: G, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 60, height: 20 } });
  scene.add({ id: A, kind: 'mark', layer: 'main', parent: G, data: {}, pose: { x: 0, y: 0, width: 20, height: 20 } });
  scene.add({ id: B, kind: 'mark', layer: 'main', parent: G, data: {}, pose: { x: 40, y: 0, width: 20, height: 20 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function nudgeRight(scene: Scene<unknown, string, unknown>, selected: NodeId[], extra: Record<string, unknown> = {}) {
  (nudgeRightAction.invoker as ImmediateInvoker).run(
    { scene, selection: { get: () => selected }, ...extra } as never,
    { magnitude: 'small' },
  );
}

const x = (scene: Scene<unknown, string, unknown>, id: NodeId) => (scene.get(id)!.pose as RectPose).x;

describe('nudge on a container', () => {
  it('carries the children in its frame, writing only its own pose', () => {
    const scene = makeScene();
    nudgeRight(scene, [G]);
    expect([x(scene, G), x(scene, A), x(scene, B)]).toEqual([1, 0, 40]);
  });

  it('moves a child once when it is selected along with its container', () => {
    const scene = makeScene();
    nudgeRight(scene, [G, A]);
    expect([x(scene, G), x(scene, A), x(scene, B)]).toEqual([1, 0, 40]);
  });

  it('undoes the whole subtree in one step', () => {
    const scene = makeScene();
    nudgeRight(scene, [G]);
    scene.undo();
    expect([x(scene, G), x(scene, A), x(scene, B)]).toEqual([0, 0, 40]);
  });

  it('writes only the container when its pose is the frame its children are stored in', () => {
    const scene = makeFrameFixture() as unknown as Scene<unknown, string, unknown>;
    nudgeRight(scene, [FRAME_FIXTURE_IDS.group]);
    expect(x(scene, FRAME_FIXTURE_IDS.group)).toBe(1);
    expectSamePose(scene.get(FRAME_FIXTURE_IDS.upright)!.pose as RectPose, FRAME_FIXTURE_LOCAL.a);
    expectSamePose(scene.get(FRAME_FIXTURE_IDS.turned)!.pose as RectPose, FRAME_FIXTURE_LOCAL.b);
  });
});
