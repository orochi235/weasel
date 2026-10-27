/**
 * Every view-side reader folds a container's scroll offset the same way:
 * painting, picking, selection chrome, the preview ghost and an insert's
 * landing all put a scrolled container's child where the view shows it.
 */
import { describe, expect, it } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { expectSamePose } from 'core/scene/frameFixture';
import type { Node, RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { resolvePreviews } from 'interactions/actions/resolvePreviews';
import { buildSceneTree } from './buildSceneTree';
import { insertSite } from './deps/insertSite';
import { pickWalk, scenePickSource } from './pickWalk';
import { sceneToAdapter } from './sceneAdapter';
import { pickIndexBuildCount } from './pickIndex/scenePickIndex';
import { RECT_POSE_DESCRIPTOR } from 'core/geometry/poseDescriptor';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

function scrolled() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
  const c = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(100, 100, 100, 100) });
  const s = scene.add({ kind: 'mark', parent: c, layer: 'main', data: {}, pose: box(10, 160) });
  scene.scroll.set(c, { x: 0, y: 150 });
  return { scene, c, s };
}
/** Where the view shows `s`: stored 160 down, scrolled 150. */
const SHOWN = box(110, 110);

const inside = (pose: RectPose, x: number, y: number): boolean =>
  x >= pose.x && x <= pose.x + pose.width && y >= pose.y && y <= pose.y + pose.height;

describe('a scrolled container, as the view reads it', () => {
  it('paints its child moved by the offset, and itself unmoved', () => {
    const { scene, c, s } = scrolled();
    const seen = new Map<string, RectPose>();
    const drawOne = (node: Node<object, 'main', RectPose>, pose: RectPose): DrawCommand[] => {
      seen.set(node.id, pose);
      return [];
    };
    const view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    buildSceneTree(
      sceneToAdapter(scene) as unknown as Parameters<typeof buildSceneTree>[0],
      drawOne as unknown as Parameters<typeof buildSceneTree>[1],
      view,
    );
    expectSamePose(seen.get(s)!, SHOWN);
    expectSamePose(seen.get(c)!, box(100, 100, 100, 100));
  });

  it('picks its child where it is shown, and rebuilds the pick index on a scroll', () => {
    const { scene, c, s } = scrolled();
    const at = (x: number, y: number) => pickWalk<RectPose>(
      scenePickSource(scene, { index: { descriptor: RECT_POSE_DESCRIPTOR as never } }),
      {
        includeGroups: false,
        broad: { box: { x, y, width: 0, height: 0 } },
        clipAdmits: () => true,
        hits: (_n, pose) => inside(pose, x, y),
      },
    );
    expect(at(115, 115)).toEqual([s]);
    expect(at(115, 265)).toEqual([]);
    const before = pickIndexBuildCount();
    scene.scroll.set(c, null);
    expect(at(115, 265)).toEqual([s]);
    expect(at(115, 265)).toEqual([s]);
    expect(pickIndexBuildCount()).toBeGreaterThan(before);
  });

  it('puts selection chrome on the shown pose', () => {
    const { scene, s } = scrolled();
    expectSamePose(sceneToAdapter(scene).getWorldPose(s), SHOWN);
  });

  it('draws the preview ghost of a dragged child where the view shows it', () => {
    const { scene, s } = scrolled();
    const [entry] = resolvePreviews([{ previewIds: () => [s], previewPose: (id) => (id === s ? box(20, 160) : null) }], scene);
    expectSamePose(entry.pose, box(120, 110));
  });

  it('lands an insert at the content position under the pointer', () => {
    const { scene, c } = scrolled();
    const site = insertSite(scene as never, c);
    expect(site.local(box(130, 120))).toEqual(box(30, 170));
  });
});
