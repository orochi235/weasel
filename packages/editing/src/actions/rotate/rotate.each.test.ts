/** A rotate with pivot 'each' turns each selected item about its own center, a group whose pose derives from its
 *  children included, as flip 'each' mirrors one about its own box. */
import { describe, expect, it } from 'vitest';
import { createScene, defaultCommitAdapter, unionOfChildren } from '@weasel-js/core/engine';
import type { NodeId, RectPose } from '@weasel-js/core';
import { rotateSelectionOps } from './replay';

type Pose = RectPose & { rotation?: number };
const center = (p: Pose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

describe("rotate with pivot 'each'", () => {
  it("turns a selected derived group's children about the group's center", () => {
    const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const group = scene.add({
      kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 },
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    const a = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: { x: 0, y: 0, width: 20, height: 20 } });
    const b = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: { x: 60, y: 40, width: 20, height: 20 } });
    const lone = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 200, y: 0, width: 20, height: 20 } });
    const s = scene as never as Parameters<typeof rotateSelectionOps>[0];
    const ops = rotateSelectionOps(s, [group, lone], {}, Math.PI / 2, 'each', 'Rotate');
    scene.applyBatch(ops, 'Rotate', defaultCommitAdapter(s));
    const at = (id: NodeId) => center(scene.get(id)!.pose);
    // The group's box is centered on (40, 30): a quarter turn takes a from (10, 10) to (60, 0) and b from (70, 50) to (20, 60).
    expect(at(a).x).toBeCloseTo(60, 9);
    expect(at(a).y).toBeCloseTo(0, 9);
    expect(at(b).x).toBeCloseTo(20, 9);
    expect(at(b).y).toBeCloseTo(60, 9);
    expect(at(lone)).toEqual({ x: 210, y: 10 });
    expect(scene.get(lone)!.pose.rotation).toBeCloseTo(Math.PI / 2, 9);
  });
});
