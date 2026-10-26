/**
 * The pick index rebuilds when anything it boxed from can have changed, and
 * not otherwise.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { rectPath } from '@weasel-js/geom';
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
  const scene = createScene<unknown, string, unknown>({ composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'main' }],
    ...(composed ? { composition: RIGID_POSE_COMPOSITION as never } : {}),
  });
  scene.add({ id: A, kind: 'mark', layer: 'main', pose, data: null, ...extra } as never);
  return scene as AnyScene;
}

/** The indexed walk, twice so the second reads a built index, must agree with the full one. */
function pick(scene: AnyScene, q: PickQuery<unknown>, d: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR): string[] {
  const want = pickWalk(scenePickSource(scene), q);
  for (let i = 0; i < 2; i++) expect(pickWalk(scenePickSource(scene, { index: { descriptor: d } }), q)).toEqual(want);
  return want;
}

const indexed = (scene: AnyScene, q: PickQuery<unknown>) =>
  pickWalk(scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } }), q);

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

  it('boxes the stroke a data override shows, as the full walk meets it', () => {
    const stroke = (width: number) => ({ paint: { color: '#000' }, width });
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 }, { data: { path: rectPath(0, 0, 20, 20), stroke: stroke(2) } });
    expect(pick(scene, at(28, 10))).toEqual([]);
    scene.overrides.set(A, { data: (d) => ({ ...(d as object), stroke: stroke(40) }) });
    expect(pick(scene, at(28, 10))).toEqual(['a']);
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
    scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', pose: { x: 400, y: 0, width: 0, height: 0 }, data: null, clipFromPose: () => null } as never);
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

  it('the first pick after a change walks, and the next one in a still scene builds', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    const before = pickIndexBuildCount();
    expect(indexed(scene, at(10, 10))).toEqual(['a']);
    expect(pickIndexBuildCount()).toBe(before);
    expect(indexed(scene, at(10, 10))).toEqual(['a']);
    expect(pickIndexBuildCount()).toBe(before + 1);
    scene.setPose(A, { x: 100, y: 0, width: 20, height: 20 });
    expect(indexed(scene, at(110, 10))).toEqual(['a']);
    expect(pickIndexBuildCount()).toBe(before + 1);
  });

  it('a pick after every change never builds', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    const before = pickIndexBuildCount();
    for (let i = 0; i < 20; i++) {
      scene.setPose(A, { x: i * 10, y: 0, width: 20, height: 20 });
      expect(indexed(scene, at(i * 10 + 5, 5))).toEqual(['a']);
      scene.overrides.set(A, { alpha: 1 });
      scene.overrides.commit();
      expect(indexed(scene, at(i * 10 + 5, 5))).toEqual(['a']);
    }
    expect(pickIndexBuildCount()).toBe(before);
  });

  it('a source with a custom getPose gets no candidates', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    const src = scenePickSource(scene, {
      getPose: (id) => scene.get(asNodeId(id))!.pose,
      index: { descriptor: AUTO_POSE_DESCRIPTOR },
    });
    expect(src.candidates).toBeUndefined();
  });

  it('a query with no broad box walks everything', () => {
    const scene = sceneWith({ x: 0, y: 0, width: 20, height: 20 });
    const src = scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } });
    expect(src.candidates!(() => undefined)).toBeNull();
    const { broad: _, ...bare } = at(10, 10);
    expect(pickWalk(src, bare)).toEqual(['a']);
  });

  it('reads candidates out in render order, and walks once they pass half the scene', () => {
    const scene = createScene<unknown, string, unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] }) as AnyScene;
    // Render order runs against the grid's reading order, so a sort by position would be wrong.
    for (let i = 99; i >= 0; i--) {
      const pose = { x: (i % 10) * 30, y: Math.floor(i / 10) * 30, width: 20, height: 20 };
      scene.add({ id: asNodeId(`n${i}`), kind: 'mark', layer: 'main', pose, data: null } as never);
    }
    const src = scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } });
    const ids = (box: Box) => {
      const broadFor = () => ({ box });
      src.candidates!(broadFor);
      return src.candidates!(broadFor)?.map((n) => n.id) ?? null;
    };
    const rank = (id: string) => [...scene.renderOrder()].indexOf(asNodeId(id));
    const byRank = (got: string[] | null) => [...got!].sort((a, b) => rank(a) - rank(b));
    const two = ids({ x: 0, y: 0, width: 40, height: 10 });
    expect(two).toEqual(['n1', 'n0']);
    const forty = ids({ x: 0, y: 0, width: 300, height: 100 });
    expect(forty).toHaveLength(40);
    expect(forty).toEqual(byRank(forty));
    expect(ids({ x: 0, y: 0, width: 300, height: 130 })).toHaveLength(50);
    expect(ids({ x: 0, y: 0, width: 300, height: 160 })).toBeNull();
  });
});
