import { describe, expect, it } from 'vitest';
import { translate } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import type { NodeId, Scene } from 'core/scene/types';
import { sceneContentBounds } from './contentBounds';

const BOX: RectPose = { x: 0, y: 0, width: 0, height: 0 };
const box = (x: number, y: number, w: number, h: number): RectPose => ({ x, y, width: w, height: h });

/** Each node's box: a mark's own pose, a group's the union of what is under it. */
function boxOf(scene: Scene<unknown, 'main', RectPose>) {
  const of = (id: NodeId): RectPose | null => {
    const n = scene.get(id)!;
    const parts = [n.kind === 'mark' ? n.pose : null, ...scene.childrenOf(id).map(of)].filter((b): b is RectPose => b !== null);
    if (parts.length === 0) return null;
    const x0 = Math.min(...parts.map((b) => b.x));
    const y0 = Math.min(...parts.map((b) => b.y));
    const x1 = Math.max(...parts.map((b) => b.x + b.width));
    const y1 = Math.max(...parts.map((b) => b.y + b.height));
    return box(x0, y0, x1 - x0, y1 - y0);
  };
  return of;
}

const make = () => createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });

describe('sceneContentBounds', () => {
  it('is the union of the shown roots, null for an empty scene', () => {
    const scene = make();
    expect(sceneContentBounds(scene, boxOf(scene))).toBeNull();
    scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0, 10, 10), data: {} });
    scene.add({ kind: 'mark', layer: 'main', pose: box(20, 5, 10, 10), data: {} });
    scene.add({ kind: 'mark', layer: 'main', pose: box(500, 500, 10, 10), data: {}, hidden: true });
    expect(sceneContentBounds(scene, boxOf(scene))).toEqual(box(0, 0, 30, 15));
  });

  it('reaches every copy a group draws, and the copies of a group inside it', () => {
    const scene = make();
    const outer = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: {}, copiesFromPose: () => [translate(100, 0)] });
    const inner = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: {}, parent: outer, copiesFromPose: () => [translate(0, 50)] });
    scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0, 10, 10), data: {}, parent: inner });
    expect(sceneContentBounds(scene, boxOf(scene))).toEqual(box(0, 0, 110, 60));
  });

  it('leaves out the copies of a hidden group', () => {
    const scene = make();
    scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0, 10, 10), data: {} });
    const g = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: {}, hidden: true, copiesFromPose: () => [translate(100, 0)] });
    scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0, 10, 10), data: {}, parent: g });
    expect(sceneContentBounds(scene, boxOf(scene))).toEqual(box(0, 0, 10, 10));
  });

  it('computes copies from the pose `poseOf` answers', () => {
    const scene = make();
    const g = scene.add({
      kind: 'group', layer: 'main', pose: BOX, data: {},
      copiesFromPose: (pose) => [translate((pose as RectPose).x, 0)],
    });
    scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0, 10, 10), data: {}, parent: g });
    expect(sceneContentBounds(scene, boxOf(scene), () => box(40, 0, 0, 0))).toEqual(box(0, 0, 50, 10));
  });
});
