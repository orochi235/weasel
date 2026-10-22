/**
 * The pick index rebuilds when anything it boxed from can have changed, and
 * not otherwise.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { applyOpsTo, createTransformOp } from 'core/ops';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { registerNodeShape } from 'canvas/NodeShape';
import { pickWalk, scenePickSource, type PickQuery } from 'canvas/pickWalk';
import { pointPick, regionPick } from './pickIndexFixture';
import { pickIndexBuildCount } from './scenePickIndex';

type AnyScene = Scene<unknown, string, unknown>;
type Box = { x: number; y: number; width: number; height: number };
const A = asNodeId('a');

function sceneWith(pose: Box, extra: Record<string, unknown> = {}, composed = false): AnyScene {
  const scene = createScene<unknown, string, unknown>({
    systemLayers: [{ id: 'main' }],
    ...(composed ? { composition: RIGID_POSE_COMPOSITION as never } : {}),
  });
  scene.add({ id: A, kind: 'leaf', layer: 'main', pose, data: null, ...extra } as never);
  return scene as AnyScene;
}

/** Both walks: the indexed one must agree with the full one, and is what is returned. */
function pick(scene: AnyScene, q: PickQuery<unknown>, d: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR): string[] {
  const got = pickWalk(scenePickSource(scene, { index: { descriptor: d } }), q);
  expect(got).toEqual(pickWalk(scenePickSource(scene), q));
  return got;
}

const at = (x: number, y: number) => pointPick(AUTO_POSE_DESCRIPTOR, x, y, { x: 1, y: 1 });

let drops: (() => void)[] = [];
afterEach(() => {
  for (const drop of drops) drop();
  drops = [];
});

describe('scenePickIndex freshness', () => {
  it('follows a pose op', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    expect(pick(scene, at(10, 10))).toEqual(['a']);
    applyOpsTo(scene, [createTransformOp({ id: A, from: scene.get(A)!.pose, to: { x: 500, y: 500, width: 20, height: 20 } })]);
    expect(pick(scene, at(510, 510))).toEqual(['a']);
    expect(pick(scene, at(10, 10))).toEqual([]);
  });

  it('follows an override write once committed', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    expect(pick(scene, at(10, 10))).toEqual(['a']);
    scene.overrides.set(A, { pose: { x: 300, y: 0, width: 20, height: 20 } });
    scene.overrides.commit();
    expect(pick(scene, at(310, 10))).toEqual(['a']);
    expect(pick(scene, at(10, 10))).toEqual([]);
  });

  it('follows a data change that moves the bounds a descriptor reads through forNode', () => {
    // The pose is a fixed anchor; the node's data says how far the shape reaches from it.
    const d: PoseDescriptor<unknown> = {
      ...AUTO_POSE_DESCRIPTOR,
      forNode: (node) => {
        const reach = ((node as { data?: { reach?: number } }).data?.reach) ?? 0;
        return { ...AUTO_POSE_DESCRIPTOR, getBounds: (p) => {
          const b = p as Box;
          return { x: b.x, y: b.y, width: b.width + reach, height: b.height };
        } };
      },
    };
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 }, { data: { reach: 0 } });
    // `centers` decides on the descriptor's box alone; `intersect` would go on to the painted outline.
    const reaches = regionPick(rectRegion({ x: 205, y: 5, width: 10, height: 10 }), 'centers', d);
    expect(pick(scene, reaches, d)).toEqual([]);
    scene.update(A, { data: { reach: 400 } });
    expect(pick(scene, reaches, d)).toEqual(['a']);
    scene.update(A, { data: { reach: 0 } });
    expect(pick(scene, reaches, d)).toEqual([]);
  });

  it('follows a reparent under a translated container when poses compose', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 }, {}, true);
    scene.add({ id: asNodeId('g'), kind: 'container', layer: 'main', pose: { x: 400, y: 0, width: 0, height: 0 }, data: null, clipFromPose: () => null } as never);
    expect(pick(scene, at(10, 10))).toEqual(['a']);
    scene.move(A, asNodeId('g'));
    expect(pick(scene, at(410, 10))).toEqual(['a']);
    expect(pick(scene, at(10, 10))).toEqual([]);
  });

  it('follows a painter registration that widens a node\'s ink', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 }, { data: { fat: true } });
    expect(pick(scene, at(60, 10))).toEqual([]);
    drops.push(registerNodeShape({
      id: 'test:fat',
      matches: (n) => (n.data as { fat?: boolean } | null)?.fat === true,
      paint: () => [],
      ink: () => ({ filled: true, outset: 50, inset: 0 }),
    }, { priority: 'high' }));
    expect(pick(scene, at(60, 10))).toEqual(['a']);
    drops.pop()!();
    expect(pick(scene, at(60, 10))).toEqual([]);
  });

  it('a still scene does not rebuild', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    pick(scene, at(10, 10));
    const before = pickIndexBuildCount();
    for (let i = 0; i < 10; i++) pick(scene, at(i * 3, 10));
    expect(pickIndexBuildCount()).toBe(before);
    scene.setPose(A, { x: 5, y: 0, width: 20, height: 20 });
    pick(scene, at(10, 10));
    expect(pickIndexBuildCount()).toBe(before + 1);
  });

  it('a query with no broad box walks everything', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    const src = scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } });
    expect(src.candidates!(() => undefined)).toBeNull();
    const { broad: _, ...bare } = at(10, 10);
    expect(pickWalk(src, bare)).toEqual(['a']);
  });
});
