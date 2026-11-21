import { describe, expect, it } from 'vitest';
import { PathBuilder, boundsOfPath, type Path, type PolygonPath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import { reshapeOps } from 'canvas/deps/pathEditCommits';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { liveEditablePath, resolveEditablePathOf } from './editablePath';
import { drawnNodeOf, nodeFrameOf, shownNodeOf } from './nodeFrame';
import { createSceneSnapIndexer } from './pathSnap/sceneIndex';
import type { AnyScene } from 'core/scene/anyScene';

const line = (x0: number, y0: number, x1: number, y1: number): PolygonPath =>
  new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build() as PolygonPath;

/** A vertical line at world x=100 stored in a group at (90, 0), turned `rotation`. */
function framed(rotation = 0) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 90, y: 0, width: 20, height: 100, rotation } });
  const inner = scene.add({ kind: 'mark', parent: group, layer: 'main', data: { path: line(0, 0, 0, 100) }, pose: { x: 10, y: 0, width: 0, height: 100 } });
  return { scene: scene as unknown as AnyScene, group, inner };
}

const box = (p: Path | null) => {
  const b = boundsOfPath(p!);
  return [b.x, b.y, b.x + b.width, b.y + b.height].map((v) => Math.round(v * 1000) / 1000 + 0);
};

describe('nodeFrameOf', () => {
  it('is null at the root and for a polygon pose', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const root = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 } });
    const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 5, y: 5, width: 10, height: 10 } });
    const poly = scene.add({ kind: 'mark', parent: group, layer: 'main', data: {}, pose: line(0, 0, 1, 1) as unknown as RectPose });
    expect(nodeFrameOf(scene as unknown as AnyScene, scene.get(root))).toBeNull();
    expect(nodeFrameOf(scene as unknown as AnyScene, scene.get(poly))).toBeNull();
  });

  it('shows the path edit chrome where the node draws, previews included', () => {
    const { scene, inner } = framed();
    const node = scene.get(inner)!;
    expect(box(liveEditablePath(inner, node, [], null))).toEqual([10, 0, 10, 100]);
    expect(box(liveEditablePath(inner, node, [], null, [], nodeFrameOf(scene, node)))).toEqual([100, 0, 100, 100]);
    const moving = {
      previewIds: () => [inner],
      previewPose: () => ({ x: 15, y: 0, width: 0, height: 100 }),
    };
    expect(box(liveEditablePath(inner, node, [moving as never], null, [], nodeFrameOf(scene, node)))).toEqual([105, 0, 105, 100]);
  });

  it('commits a path edit in world back into the node’s frame', () => {
    const { scene, inner } = framed(Math.PI / 6);
    scene.applyBatch(reshapeOps(scene, inner, line(0, 0, 40, 40), 'Edit', null, []), 'Edit', defaultCommitAdapter(scene));
    expect(box(resolveEditablePathOf(shownNodeOf(scene, inner)))).toEqual([0, 0, 40, 40]);
  });

  it('snaps to a framed node where it draws', () => {
    const { scene } = framed();
    const { index } = createSceneSnapIndexer(scene)();
    expect(box(index.paths[0])).toEqual([100, 0, 100, 100]);
  });
});

/** A vertical line stored at world x=10, drawn at x=60 by an override. */
function overridden() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', data: { path: line(0, 0, 0, 100) }, pose: { x: 10, y: 0, width: 0, height: 100 } });
  scene.overrides.set(id, { pose: { x: 60, y: 0, width: 0, height: 100 } });
  scene.overrides.commit();
  return { scene: scene as unknown as AnyScene, id };
}

describe('a node drawn away from its stored pose', () => {
  it('shows the path edit chrome on the drawn outline', () => {
    const { scene, id } = overridden();
    const node = drawnNodeOf(scene, scene.get(id)!);
    expect(box(liveEditablePath(id, node, [], null, [], nodeFrameOf(scene, node)))).toEqual([60, 0, 60, 100]);
    expect(box(resolveEditablePathOf(shownNodeOf(scene, id)))).toEqual([60, 0, 60, 100]);
  });

  it('follows a derived pose', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const anchor = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 30, y: 0, width: 5, height: 5 } });
    const id = scene.add({
      kind: 'mark', layer: 'main', data: { path: line(0, 0, 0, 100) }, pose: { x: 10, y: 0, width: 0, height: 100 },
      dependsOn: [anchor], derivePose: (_n, [dep]) => ({ x: dep!.pose.x, y: 0, width: 0, height: 100 }),
    });
    expect(box(resolveEditablePathOf(shownNodeOf(scene as unknown as AnyScene, id)))).toEqual([30, 0, 30, 100]);
  });

  it('stores an edit where it was shown', () => {
    const { scene, id } = overridden();
    scene.applyBatch(reshapeOps(scene, id, line(60, 0, 80, 100), 'Edit', null, []), 'Edit', defaultCommitAdapter(scene));
    scene.overrides.clear(id);
    scene.overrides.commit();
    expect(box(resolveEditablePathOf(shownNodeOf(scene, id)))).toEqual([60, 0, 80, 100]);
  });
});
