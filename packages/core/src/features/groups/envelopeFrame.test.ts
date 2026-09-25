/**
 * A container whose pose derives from its children, under a composing
 * strategy.
 *
 * Such a container is an envelope, not a frame: its children are stored in the
 * same frame it is, so `unionOfChildren` reads and writes one frame and nothing
 * is circular. Folding the derived pose in as the children's frame instead
 * moves every child by its own offset, which is what these tests catch.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Node, type RectPose, type Scene } from 'core/scene/types';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { buildSceneTree } from 'canvas/buildSceneTree';
import { pickWalk, scenePickSource } from 'canvas/pickWalk';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '../../renderer';
import { RIGID_POSE_COMPOSITION } from './composePose';
import { expectSamePose } from './frameFixture';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const ids = {
  frame: asNodeId('frame'),
  envelope: asNodeId('env'),
  inner: asNodeId('inner'),
  a: asNodeId('a'),
  b: asNodeId('b'),
};

const A: RectPose = { x: 10, y: 20, width: 20, height: 10 };
const B: RectPose = { x: 40, y: 60, width: 40, height: 20, rotation: Math.PI / 2 };
/** Union of `A` and `B`'s ink: B turned a quarter is 20 wide and 40 tall about
 *  its center (60,70), so it spans (50,50)-(70,90). */
const AB_UNION: RectPose = { x: 10, y: 20, width: 60, height: 70 };

type S = Scene<{ label: string }, 'main', RectPose>;

/** An envelope at the root, stored translated and turned — values its
 *  derivation must override — holding `A` and `B`. */
function envelopeAtRoot(): S {
  const scene = createScene<{ label: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: ids.envelope, kind: 'container', layer: 'main', data: { label: 'env' },
    pose: { x: 200, y: 100, width: 100, height: 100, rotation: Math.PI / 2 },
    dependsOn: 'children', derivePose: unionOfChildren,
  });
  scene.add({ id: ids.a, kind: 'leaf', layer: 'main', parent: ids.envelope, data: { label: 'a' }, pose: A });
  scene.add({ id: ids.b, kind: 'leaf', layer: 'main', parent: ids.envelope, data: { label: 'b' }, pose: B });
  return scene;
}

/** A turned frame holding an envelope holding an envelope holding `A`: the
 *  envelopes are transparent, so `A` is stored in the frame's frame. */
function envelopesInFrame(): S {
  const scene = createScene<{ label: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: ids.frame, kind: 'container', layer: 'main', data: { label: 'frame' },
    pose: { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 },
  });
  scene.add({
    id: ids.envelope, kind: 'container', layer: 'main', parent: ids.frame, data: { label: 'env' },
    pose: { x: 0, y: 0, width: 1, height: 1 },
    dependsOn: 'children', derivePose: unionOfChildren,
  });
  scene.add({
    id: ids.inner, kind: 'container', layer: 'main', parent: ids.envelope, data: { label: 'inner' },
    pose: { x: 0, y: 0, width: 1, height: 1 },
    dependsOn: 'children', derivePose: unionOfChildren,
  });
  scene.add({ id: ids.a, kind: 'leaf', layer: 'main', parent: ids.inner, data: { label: 'a' }, pose: A });
  return scene;
}

/** `A` composed into the frame by hand: its center (20,25) is (-30,-25) from
 *  the frame's center (50,50); a quarter turn sends that to (25,-30). */
const A_IN_FRAME: RectPose = { x: 65, y: 15, width: 20, height: 10, rotation: Math.PI / 2 };

function painterPoses(scene: S): Map<string, RectPose> {
  const adapter = sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION });
  const seen = new Map<string, RectPose>();
  buildSceneTree(
    adapter as unknown as Parameters<typeof buildSceneTree>[0],
    ((node: Node<unknown, string, RectPose>, pose: RectPose): DrawCommand[] => {
      seen.set(node.id, pose);
      return [];
    }) as unknown as Parameters<typeof buildSceneTree>[1],
    VIEW,
  );
  return seen;
}

describe('a derived container under a rigid strategy', () => {
  it('leaves its children where they are stored', () => {
    const scene = envelopeAtRoot();
    const adapter = sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION });
    expectSamePose(adapter.getWorldPose(ids.a), A);
    expectSamePose(adapter.getWorldPose(ids.b), B);
  });

  it('envelopes its children where they are drawn', () => {
    const scene = envelopeAtRoot();
    const adapter = sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION });
    expectSamePose(adapter.getWorldPose(ids.envelope), AB_UNION);
  });

  it('draws the same poses the adapter reports', () => {
    const seen = painterPoses(envelopeAtRoot());
    expectSamePose(seen.get(ids.a)!, A);
    expectSamePose(seen.get(ids.b)!, B);
    expectSamePose(seen.get(ids.envelope)!, AB_UNION);
  });

  it('is transparent inside a frame, however deeply nested', () => {
    const scene = envelopesInFrame();
    const adapter = sceneToAdapter(scene, { poseComposition: RIGID_POSE_COMPOSITION });
    expectSamePose(adapter.getWorldPose(ids.a), A_IN_FRAME);
    expectSamePose(adapter.getWorldPose(ids.inner), A_IN_FRAME);
    expectSamePose(adapter.getWorldPose(ids.envelope), A_IN_FRAME);
    const seen = painterPoses(scene);
    expectSamePose(seen.get(ids.a)!, A_IN_FRAME);
    expectSamePose(seen.get(ids.envelope)!, A_IN_FRAME);
  });

  it('resolves the same way for actions, and rebases writes into the right frame', () => {
    const scene = envelopesInFrame();
    const frame = scenePoseFrame(scene as never, RIGID_POSE_COMPOSITION);
    expectSamePose(frame.world(ids.a) as RectPose, A_IN_FRAME);
    expectSamePose(frame.parentWorld(ids.a) as RectPose, {
      x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2,
    });
    expectSamePose(frame.local(ids.a, A_IN_FRAME) as RectPose, A);
    expectSamePose(frame.localUnder(ids.envelope, A_IN_FRAME) as RectPose, A);
  });

  it('picks children where they are drawn', () => {
    const scene = envelopeAtRoot();
    const src = scenePickSource(scene, { poseComposition: RIGID_POSE_COMPOSITION });
    // A's center; the displaced reading would put A at (20,40)-(40,50).
    const hit = pickWalk<RectPose>(src, {
      includeContainers: false,
      clipAdmits: () => true,
      hits: (_n, p) => 20 >= p.x && 20 <= p.x + p.width && 25 >= p.y && 25 <= p.y + p.height,
    });
    expect(hit).toContain(ids.a);
  });
});

describe('a derived container with no strategy', () => {
  it('is unchanged', () => {
    const scene = envelopeAtRoot();
    const adapter = sceneToAdapter(scene);
    expectSamePose(adapter.getWorldPose(ids.a), A);
    expectSamePose(adapter.getWorldPose(ids.envelope), AB_UNION);
    const seen = new Map<string, RectPose>();
    buildSceneTree(
      adapter as unknown as Parameters<typeof buildSceneTree>[0],
      ((node: Node<unknown, string, RectPose>, pose: RectPose): DrawCommand[] => {
        seen.set(node.id, pose);
        return [];
      }) as unknown as Parameters<typeof buildSceneTree>[1],
      VIEW,
    );
    expectSamePose(seen.get(ids.b)!, B);
    expectSamePose(seen.get(ids.envelope)!, AB_UNION);
  });
});
