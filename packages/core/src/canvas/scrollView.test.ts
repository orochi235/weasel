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
import type { DerivedDep, Node, RectPose } from 'core/scene/types';
import { linePath, type Path } from '@weasel-js/geom';
import type { View } from 'core/viewport/view';
import { resolvePreviews } from 'interactions/actions/resolvePreviews';
import { buildSceneTree } from './buildSceneTree';
import { insertSite } from './deps/insertSite';
import { pickWalk, scenePickSource } from './pickWalk';
import { sceneToAdapter } from './sceneAdapter';
import { pickIndexBuildCount } from './pickIndex/scenePickIndex';
import { RECT_POSE_DESCRIPTOR } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { defaultDrawOne } from './defaultDrawOne';
import { buildSceneViewCommands } from './sceneViewRender';
import { scenePointQuery } from './SceneCanvas/scenePointQuery';
import { hitTestArea } from './deps/hitTestArea';

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

/** `scrolled()` plus a root `a` level with where `s` is shown, and a root
 *  connector deriving a line from `a`'s corner to `s`'s. */
function connected(aY = 110) {
  const { scene, c, s } = scrolled();
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, aY) });
  const edge = scene.add({
    kind: 'mark', layer: 'main', data: {}, pose: box(0, 0, 0, 0),
    dependsOn: [a, s],
    derivePath: (_n: Node<unknown, string, RectPose>, deps: readonly (DerivedDep<RectPose> | undefined)[]) => {
      const [from, to] = [deps[0]?.pose, deps[1]?.pose];
      return from && to ? linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y }) : null;
    },
  });
  return { scene, c, s, edge };
}

function paths(cmds: readonly DrawCommand[]): Path[] {
  const out: Path[] = [];
  for (const cmd of cmds) {
    if (cmd.kind === 'path') out.push((cmd as { path: Path }).path);
    else if (cmd.kind === 'group') out.push(...paths(cmd.children));
  }
  return out;
}

describe('a connector into a scrolled container', () => {
  const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  /** From `a` to where `s` is shown; the document has `s` at (110, 260). */
  const SHOWN_LINE = linePath({ x: 0, y: 110 }, { x: 110, y: 110 });
  const pickAt = (scene: ReturnType<typeof connected>['scene'], x: number, y: number) => pickWalk<RectPose>(
    scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR as never } }),
    scenePointQuery<RectPose>(AUTO_POSE_DESCRIPTOR as never, true, 2)(x, y, { x: 1, y: 1 }),
  );

  it('is painted and picked on one path, ending where the scrolled node is drawn', () => {
    const { scene, edge } = connected();
    expect(paths(buildSceneViewCommands(scene, VIEW, defaultDrawOne))).toContainEqual(SHOWN_LINE);
    expect(scenePickSource(scene).derivedPathOf!(scene.get(edge)! as never)).toEqual(SHOWN_LINE);
  });

  it('takes a click on the painted line and none on the line to the document position', () => {
    const { scene, edge } = connected();
    expect(pickAt(scene, 60, 110)).toContain(edge);
    expect(pickAt(scene, 55, 185)).not.toContain(edge);
  });

  it('is found by the pick index where the painted line leaves the document line\'s box', () => {
    // Painted from (0, 300) to (110, 110); the document's line keeps to y 260..300.
    const { scene, edge } = connected(300);
    expect(pickAt(scene, 55, 205)).toContain(edge);
  });

  it('takes a marquee over the painted end and none over the document end', () => {
    const { scene, edge } = connected();
    const area = (x: number, y: number) => hitTestArea(scene as never, { x, y, width: 6, height: 10 });
    expect(area(104, 105)).toContain(edge);
    expect(area(107, 255)).not.toContain(edge);
  });

  it('follows a scroll in both painting and picking', () => {
    const { scene, c, edge } = connected();
    scene.scroll.set(c, { x: 0, y: 100 });
    const line = linePath({ x: 0, y: 110 }, { x: 110, y: 160 });
    expect(paths(buildSceneViewCommands(scene, VIEW, defaultDrawOne))).toContainEqual(line);
    expect(pickAt(scene, 55, 135)).toContain(edge);
    expect(pickAt(scene, 60, 110)).not.toContain(edge);
  });
});
