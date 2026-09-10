/**
 * The render walk under a composing strategy. Every assertion here would pass
 * against the un-composed walk if the fixture used an identity composition —
 * see `frameFixture.ts` for why that matters.
 */
import { describe, expect, it } from 'vitest';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import {
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_LOCAL,
  FRAME_FIXTURE_WORLD,
  expectSamePose,
  makeFrameFixture,
  type FrameFixtureData,
  type FrameFixtureLayer,
} from 'features/groups/frameFixture';
import {
  RIGID_POSE_COMPOSITION,
  RECT_POSE_COMPOSITION,
} from 'features/groups/composePose';
import type { RectPose, Node } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '../renderer';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Run the walk and record the pose each node's painter was handed. */
function posesSeenByPainter(
  composition: typeof RIGID_POSE_COMPOSITION | undefined,
): Map<string, RectPose> {
  const scene = makeFrameFixture();
  const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(
    scene,
    composition ? { poseComposition: composition } : {},
  );
  const seen = new Map<string, RectPose>();
  const drawOne = (node: Node<FrameFixtureData, FrameFixtureLayer, RectPose>, pose: RectPose): DrawCommand[] => {
    seen.set(node.id, pose);
    return [];
  };
  buildSceneTree(
    adapter as unknown as Parameters<typeof buildSceneTree>[0],
    drawOne as unknown as Parameters<typeof buildSceneTree>[1],
    VIEW,
  );
  return seen;
}

describe('buildSceneTree composes the parent frame', () => {
  it('hands the painter world poses under a rigid strategy', () => {
    const seen = posesSeenByPainter(RIGID_POSE_COMPOSITION);
    expectSamePose(seen.get(FRAME_FIXTURE_IDS.upright)!, FRAME_FIXTURE_WORLD.a);
    expectSamePose(seen.get(FRAME_FIXTURE_IDS.turned)!, FRAME_FIXTURE_WORLD.b);
  });

  it('is the local pose when no strategy is configured', () => {
    const seen = posesSeenByPainter(undefined);
    expectSamePose(seen.get(FRAME_FIXTURE_IDS.upright)!, FRAME_FIXTURE_LOCAL.a);
    expectSamePose(seen.get(FRAME_FIXTURE_IDS.turned)!, FRAME_FIXTURE_LOCAL.b);
  });

  it('leaves the container itself alone — a root has no frame above it', () => {
    const seen = posesSeenByPainter(RIGID_POSE_COMPOSITION);
    expectSamePose(seen.get(FRAME_FIXTURE_IDS.group)!, {
      x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2,
    });
  });

  it('a translation-only strategy moves children but does not turn them', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(
      scene, { poseComposition: RECT_POSE_COMPOSITION },
    );
    const seen = new Map<string, RectPose>();
    buildSceneTree(
      adapter as unknown as Parameters<typeof buildSceneTree>[0],
      ((n: { id: string }, p: RectPose) => { seen.set(n.id, p); return []; }) as unknown as Parameters<typeof buildSceneTree>[1],
      VIEW,
    );
    // Group sits at (0,0), so translation-only leaves the child where it was
    // and never adds the group's quarter turn.
    expectSamePose(seen.get(FRAME_FIXTURE_IDS.upright)!, FRAME_FIXTURE_LOCAL.a);
  });
});

describe('the two world-pose resolvers agree', () => {
  it('getWorldPose matches what the walk hands the painter', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(
      scene, { poseComposition: RIGID_POSE_COMPOSITION },
    );
    const seen = posesSeenByPainter(RIGID_POSE_COMPOSITION);
    for (const id of Object.values(FRAME_FIXTURE_IDS)) {
      expectSamePose(adapter.getWorldPose(id), seen.get(id)!);
    }
  });

  it('getWorldPose is getPose when nothing composes', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(scene, {});
    for (const id of Object.values(FRAME_FIXTURE_IDS)) {
      expect(adapter.getWorldPose(id)).toEqual(adapter.getPose(id));
    }
  });
});

describe('a frame and the absolute-pose cascade contradict', () => {
  it('refuses both at once rather than moving descendants twice', () => {
    const scene = makeFrameFixture();
    expect(() =>
      sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(scene, {
        poseComposition: RIGID_POSE_COMPOSITION,
        cascadeContainerPose: 'rect',
      }),
    ).toThrow(/contradict/);
  });

  it('allows the cascade alongside an explicitly identity strategy', () => {
    const scene = makeFrameFixture();
    expect(() =>
      sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(scene, {
        poseComposition: { compose: (_p, c) => c, decompose: (_p, w) => w, closure: 'identity' },
        cascadeContainerPose: 'rect',
      }),
    ).not.toThrow();
  });
});

describe('the clipboard captures a framed root in world coordinates', () => {
  it('a copied child does not jump by its old parent frame', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(
      scene, { poseComposition: RIGID_POSE_COMPOSITION },
    );
    const snap = adapter.snapshotSelection([FRAME_FIXTURE_IDS.upright]);
    const item = (snap.items as { id: string; pose: RectPose }[])[0];
    // Pasting re-roots it, so the captured pose has to be where it was drawn.
    expectSamePose(item.pose, FRAME_FIXTURE_WORLD.a);
  });

  it('keeps the stored pose when nothing composes', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(scene, {});
    const snap = adapter.snapshotSelection([FRAME_FIXTURE_IDS.upright]);
    const item = (snap.items as { id: string; pose: RectPose }[])[0];
    expectSamePose(item.pose, FRAME_FIXTURE_LOCAL.a);
  });
});
