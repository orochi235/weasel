/**
 * Copy and paste against a scene whose container pose is a frame. A pasted
 * cluster must land where the copy was drawn, offset by the paste offset and
 * nothing else — so every assertion is on WORLD poses after re-inserting what
 * `commitPaste` minted.
 */
import { describe, expect, it } from 'vitest';
import { sceneToAdapter } from './sceneAdapter';
import { createScene } from 'core/scene/scene';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { asNodeId, type Node, type RectPose, type Scene } from 'core/scene/types';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import {
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_WORLD,
  expectSamePose,
  makeFrameFixture,
} from 'features/groups/frameFixture';

type D = { label: string };
type S = Scene<D, 'main', RectPose>;

const OFFSET = { dx: 12, dy: 12 };
const shifted = (p: RectPose): RectPose => ({ ...p, x: p.x + OFFSET.dx, y: p.y + OFFSET.dy });

/** Copy `ids`, paste them back into the same scene, and return the pasted
 *  nodes keyed by their source id's label. */
function copyPaste(scene: S, ids: string[]): Map<string, Node<D, 'main', RectPose>> {
  const adapter = sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION });
  const created = adapter.commitPaste(adapter.snapshotSelection(ids), OFFSET);
  const out = new Map<string, Node<D, 'main', RectPose>>();
  for (const n of created) {
    scene.add({
      id: n.id,
      kind: n.kind,
      layer: n.layer,
      parent: n.parent,
      pose: n.pose,
      data: n.data,
      ...(n.dependsOn !== undefined ? { dependsOn: n.dependsOn } : {}),
      ...(n.derivePose !== undefined ? { derivePose: n.derivePose } : {}),
    } as never);
    out.set(n.data.label, scene.get(n.id)!);
  }
  return out;
}

const worldOf = (scene: S, id: string): RectPose =>
  sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION }).getWorldPose(id);

describe('clipboard under a container frame', () => {
  it('pastes a frame container without offsetting its children twice', () => {
    const scene = makeFrameFixture();
    const pasted = copyPaste(scene, [FRAME_FIXTURE_IDS.group]);
    expectSamePose(worldOf(scene, pasted.get('upright')!.id), shifted(FRAME_FIXTURE_WORLD.a));
    expectSamePose(worldOf(scene, pasted.get('turned')!.id), shifted(FRAME_FIXTURE_WORLD.b));
  });

  it('pastes an envelope that still derives, with its children where they were drawn', () => {
    const scene = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const frame = scene.add({
      id: asNodeId('frame'), kind: 'container', layer: 'main', data: { label: 'frame' },
      pose: { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 },
    });
    const env = scene.add({
      id: asNodeId('env'), kind: 'container', layer: 'main', parent: frame, data: { label: 'env' },
      pose: { x: 0, y: 0, width: 1, height: 1 },
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    scene.add({
      id: asNodeId('a'), kind: 'leaf', layer: 'main', parent: env, data: { label: 'a' },
      pose: { x: 10, y: 20, width: 20, height: 10 },
    });
    // `a` composed into the frame: see `envelopeFrame.test.ts`.
    const aWorld: RectPose = { x: 65, y: 15, width: 20, height: 10, rotation: Math.PI / 2 };

    const pasted = copyPaste(scene, [env]);
    expect(pasted.get('env')!.derivePose).toBe(unionOfChildren);
    expectSamePose(worldOf(scene, pasted.get('a')!.id), shifted(aWorld));
    // Re-rooted, the envelope spans the ink of its turned member upright.
    expectSamePose(worldOf(scene, pasted.get('env')!.id), { x: 82, y: 22, width: 10, height: 20 });
  });
});
