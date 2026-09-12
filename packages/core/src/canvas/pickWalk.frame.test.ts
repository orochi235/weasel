/**
 * Picking under a composing strategy. See `frameFixture.ts` for why these
 * assertions have to run against a rotated container: with an identity
 * composition a local pose and a world pose are the same value, so the same
 * test passes whether or not the pick source composes.
 */
import { describe, expect, it } from 'vitest';
import { pickWalk, scenePickSource, adapterPickSource } from './pickWalk';
import { sceneToAdapter } from './sceneAdapter';
import {
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_LOCAL,
  FRAME_FIXTURE_WORLD,
  makeFrameFixture,
  type FrameFixtureData,
  type FrameFixtureLayer,
} from 'features/groups/frameFixture';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import type { RectPose } from 'core/scene/types';

/** Center of node `a`: local (20,25), world (75,20). The two are far apart,
 *  which is the whole point of picking there. */
const A_LOCAL_CENTER = { x: 20, y: 25 };
const A_WORLD_CENTER = { x: 75, y: 20 };

function containsPoint(pose: RectPose, px: number, py: number): boolean {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const r = -(pose.rotation ?? 0);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const lx = cx + (px - cx) * c - (py - cy) * s;
  const ly = cy + (px - cx) * s + (py - cy) * c;
  return lx >= pose.x && lx <= pose.x + pose.width && ly >= pose.y && ly <= pose.y + pose.height;
}

function pickAt(compose: boolean, pt: { x: number; y: number }): string[] {
  const scene = makeFrameFixture();
  const src = scenePickSource<FrameFixtureData, FrameFixtureLayer, RectPose>(
    scene,
    compose ? { poseComposition: RIGID_POSE_COMPOSITION } : {},
  );
  return pickWalk<RectPose>(src, {
    includeContainers: false,
    // The fixture's container clips its children; this test is about where a
    // node is, not about clipping, so admit everything.
    clipAdmits: () => true,
    hits: (_n, pose) => containsPoint(pose as RectPose, pt.x, pt.y),
  });
}

describe('scenePickSource composes the parent frame', () => {
  it('hits the node where it is drawn', () => {
    expect(pickAt(true, A_WORLD_CENTER)).toContain(FRAME_FIXTURE_IDS.upright);
  });

  it('does not hit it where its own pose says', () => {
    expect(pickAt(true, A_LOCAL_CENTER)).not.toContain(FRAME_FIXTURE_IDS.upright);
  });

  it('without a strategy, picks at the stored pose — the absolute-pose model', () => {
    expect(pickAt(false, A_LOCAL_CENTER)).toContain(FRAME_FIXTURE_IDS.upright);
    expect(pickAt(false, A_WORLD_CENTER)).not.toContain(FRAME_FIXTURE_IDS.upright);
  });
});

describe('adapterPickSource composes through getWorldPose', () => {
  it('reports world poses in walk order', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(
      scene, { poseComposition: RIGID_POSE_COMPOSITION },
    );
    const src = adapterPickSource<RectPose>(adapter as never);
    const byId = new Map(src.order().map((n) => [n.id, n.pose as RectPose]));
    expect(byId.get(FRAME_FIXTURE_IDS.upright)!.x).toBeCloseTo(FRAME_FIXTURE_WORLD.a.x, 9);
    expect(byId.get(FRAME_FIXTURE_IDS.upright)!.rotation!).toBeCloseTo(FRAME_FIXTURE_WORLD.a.rotation!, 9);
  });

  it('reports stored poses when the adapter has no strategy', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(scene, {});
    const src = adapterPickSource<RectPose>(adapter as never);
    const byId = new Map(src.order().map((n) => [n.id, n.pose as RectPose]));
    expect(byId.get(FRAME_FIXTURE_IDS.upright)!.x).toBe(FRAME_FIXTURE_LOCAL.a.x);
  });
});

describe('the adapter area walk composes', () => {
  it('a marquee over the drawn position selects the node', () => {
    const scene = makeFrameFixture();
    const adapter = sceneToAdapter<FrameFixtureData, FrameFixtureLayer, RectPose>(
      scene, { poseComposition: RIGID_POSE_COMPOSITION },
    );
    // A box around the world center of `a`, nowhere near its local center.
    const hits = adapter.hitTestArea!({ x: 70, y: 15, width: 12, height: 12 });
    expect(hits).toContain(FRAME_FIXTURE_IDS.upright);
  });
});
