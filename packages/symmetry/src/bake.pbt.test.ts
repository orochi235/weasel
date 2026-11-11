/**
 * Property tests of baking: `carryPose` lands a box where the copy's transform takes it, and a baked group holds
 * exactly the shapes its live copies drew, each where it drew, as one undo step that puts the scene back.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { boxFrameOf, multiply, rotate, translate, type Affine } from '@weasel-js/geom';
import { asNodeId, createScene, type NodeId, type RectPose, type SceneRegistry } from '@weasel-js/core';
import { carryPose, bakeSymmetry, type BoxPose } from './bake';
import { createSymmetry } from './controller';
import { worldPoseOf } from './frames';
import { readGroup, symmetryRegistry } from './group';
import { symmetryTransforms } from './kinds';
import { angle, coord, near, point, runs, spec, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

const linear = fc.tuple(
  fc.double({ min: 0.3, max: 3, noNaN: true }), fc.double({ min: -1, max: 1, noNaN: true }),
  fc.double({ min: -1, max: 1, noNaN: true }), fc.double({ min: 0.3, max: 3, noNaN: true }), fc.boolean(),
).map(([a, b, c, d, flip]) => [flip ? -a : a, b, c, d] as const);

const boxPose: fc.Arbitrary<BoxPose> = fc.record({
  x: coord(500), y: coord(500),
  width: fc.double({ min: 0, max: 200, noNaN: true }), height: fc.double({ min: 0, max: 200, noNaN: true }),
  rotation: fc.option(angle, { nil: undefined }),
  transform: fc.option(linear, { nil: undefined, freq: 2 }),
}).map(({ rotation, transform, ...b }) => ({
  ...b, ...(rotation !== undefined ? { rotation } : {}), ...(transform !== undefined ? { transform } : {}),
}));

/** A rigid motion: a turn, mirrored or not, then a move. */
const rigid: fc.Arbitrary<Affine> = fc.tuple(angle, fc.boolean(), point()).map(([t, flip, v]) =>
  multiply(translate(v.x, v.y), multiply(rotate(t), flip ? [1, 0, 0, -1, 0, 0] : [1, 0, 0, 1, 0, 0])));

describe('carryPose', () => {
  it("lands the box where `m` takes it: the carried pose's frame is `m` after the pose's own", () => {
    const t = tally();
    fc.assert(fc.property(boxPose, rigid, (pose, m) => {
      const out = carryPose(pose, m);
      expect(out.width).toBe(pose.width);
      expect(out.height).toBe(pose.height);
      expect(near(boxFrameOf(out)!, multiply(m, boxFrameOf(pose)!), 1e-9)).toBe(true);
      t.count(out.rotation === undefined ? 'unturned' : out.transform ? 'turned and framed' : 'turned');
    }), runs(RUNS * 2));
    t.atLeast('unturned', 5);
    t.atLeast('turned', 30);
    t.atLeast('turned and framed', 30);
  }, timeoutFor(RUNS * 2, 2));
});

/** Each leaf's drawn frame, as a sortable key and its affine. */
function frames(scene: ReturnType<typeof setupScene>, ids: readonly NodeId[]): Affine[] {
  return ids.map((id) => boxFrameOf(worldPoseOf(scene as never, id))!);
}

function setupScene() {
  return createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: symmetryRegistry as SceneRegistry<RectPose> });
}

function leavesUnder(scene: ReturnType<typeof setupScene>, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const walk = (n: NodeId) => {
    for (const c of scene.childrenOf(n)) {
      if (scene.childrenOf(c).length === 0) out.push(c);
      walk(c);
    }
  };
  walk(id);
  return out;
}

/** Whether `got` and `want` hold the same affines, each matched once. */
function sameSet(got: Affine[], want: Affine[]): boolean {
  if (got.length !== want.length) return false;
  const left = [...got];
  for (const w of want) {
    const i = left.findIndex((g) => near(g, w, 1e-6));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

describe('bakeSymmetry', () => {
  const world = fc.record({
    s: spec({ maxCount: 6 }).filter((s) => symmetryTransforms(s, { x: 0, y: 0 }).length <= 40),
    center: point(300),
    parent: fc.option(point(300), { nil: null }),
    leaves: fc.array(boxPose, { minLength: 1, maxLength: 3 }),
    nest: fc.boolean(),
  });

  it('holds every shape the live copies drew, where they drew it, and one undo puts the scene back', () => {
    const t = tally();
    fc.assert(fc.property(world, ({ s, center, parent, leaves, nest }) => {
      const scene = setupScene();
      const sym = createSymmetry(scene as never);
      const host = parent === null ? null : scene.add({
        kind: 'group', layer: 'main', pose: { x: parent.x, y: parent.y, width: 0, height: 0 }, data: {},
      });
      const group = sym.create({ center, symmetry: s, parent: host });
      let into: NodeId = group;
      if (nest) {
        into = scene.add({ kind: 'mark', layer: 'main', parent: group, pose: { x: 5, y: -5, width: 20, height: 20 }, data: { path: null } });
      }
      leaves.forEach((pose, k) => {
        scene.add({ kind: 'mark', layer: 'main', parent: into, id: asNodeId(`leaf${k}`), pose: pose as RectPose, data: { k } });
      });
      const live = readGroup(scene as never, group)!;
      const copies = symmetryTransforms(live.spec, live.center);
      const before = leavesUnder(scene, group);
      const drawn = frames(scene, before);
      const want = [...drawn, ...copies.flatMap((m) => drawn.map((f) => multiply(m, f)))];
      const saved = JSON.stringify(scene.toJSON());

      const out = bakeSymmetry(scene as never, group)!;
      expect(out.skipped).toEqual([]);
      expect(scene.get(group)).toBeUndefined();
      const after = leavesUnder(scene, out.group);
      expect(sameSet(frames(scene, after), want)).toBe(true);
      for (const id of before) expect(near(boxFrameOf(worldPoseOf(scene as never, id))!, drawn[before.indexOf(id)]!, 1e-9)).toBe(true);
      t.count(s.kind);
      if (copies.length > 0) t.count('copies');
      if (host !== null) t.count('in a frame');

      scene.undo();
      expect(JSON.stringify(scene.toJSON())).toBe(saved);
    }), runs(RUNS));
    for (const k of ['mirror', 'radial', 'repeat', 'kaleidoscope', 'wallpaper']) t.atLeast(k, 6);
    t.atLeast('copies', 60);
    t.atLeast('in a frame', 30);
  }, timeoutFor(RUNS, 40));
});
