/**
 * Metamorphic property tests of the pick walk against the view it is asked through. Moving the scene, the
 * camera, and every parallax plane's anchor by one offset changes nothing on screen, so it changes no pick.
 * A marquee grown to cover more takes no fewer nodes, in every mode, and what it encloses it also meets.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { LassoHitMode } from 'core/adapters/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { fromPlane, planeMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import { pickWalk, scenePickSource, type PickQuery } from './pickWalk';
import { mixedScene, pointPick, regionPick } from './pickIndex/pickIndexFixture';
import { LAYERS, buildScene, intBox, runs, sceneSpec, timeoutFor, type Box, type BoxScene, type SceneSpec } from './pbt.fixture';

const RUNS = 200;
const d = AUTO_POSE_DESCRIPTOR;

const planes = fc.tuple(...LAYERS.map(() => fc.option(fc.record({
  pan: fc.constantFrom(0, 0.25, 0.5, 2),
  anchor: fc.record({ x: fc.integer({ min: -300, max: 300 }), y: fc.integer({ min: -300, max: 300 }) }),
}), { nil: undefined, freq: 2 })));
type Planes = readonly ({ pan: number; anchor: { x: number; y: number } } | undefined)[];

function sceneIn(spec: SceneSpec, ps: Planes, t: number): BoxScene {
  const scene = buildScene(spec, t, t);
  LAYERS.forEach((l, i) => {
    const p = ps[i];
    if (p) scene.setLayerParallax(l, { pan: p.pan, anchor: { x: p.anchor.x + t, y: p.anchor.y + t } });
  });
  return scene;
}

const walk = (scene: BoxScene, camera: View, q: PickQuery<unknown>, indexed: boolean): string[] =>
  pickWalk(scenePickSource(scene as never, { camera, ...(indexed ? { index: { descriptor: d } } : {}) }), q);

describe('pickWalk under a view moved with its scene', () => {
  it('moving the scene, the camera, and every plane anchor together picks the same nodes', () => {
    let hit = 0, onPlane = 0;
    const offset = fc.oneof(fc.integer({ min: -5000, max: 5000 }), fc.constantFrom(2 ** 30, -(2 ** 30), 123456789));
    const half = fc.integer({ min: 0, max: 200 }).map((n) => n + 0.5);
    fc.assert(fc.property(
      sceneSpec, planes, offset, fc.nat(), half, half, intBox, fc.constantFrom(0.25, 0.5, 1, 2, 4), fc.integer({ min: -200, max: 200 }),
      (spec, ps, t, at, hx, hy, m, k, c) => {
        // Inside one node's box most of the time, so the picks have something to agree on.
        const camA: View = { x: c, y: -c, scale: { x: k, y: k } };
        const node = spec.nodes[at % spec.nodes.length]!;
        const plane = ps[LAYERS.indexOf(node.layer)];
        const within = { x: node.pose.x + (hx % node.pose.width), y: node.pose.y + (hy % node.pose.height) };
        // Where the node is on screen: through its plane when its layer is one.
        const shown = plane ? fromPlane(planeMap(camA, plane), within) : within;
        const px = at % 4 === 0 ? hx : shown.x, py = at % 4 === 0 ? hy : shown.y;
        const a = sceneIn(spec, ps, 0);
        const b = sceneIn(spec, ps, t);
        const camB: View = { x: c + t, y: -c + t, scale: { x: k, y: k } };
        for (const indexed of [false, true]) {
          const here = walk(a, camA, pointPick(d, px, py, { x: k, y: k }), indexed);
          expect(walk(b, camB, pointPick(d, px + t, py + t, { x: k, y: k }), indexed)).toEqual(here);
          const marquee = (dx: number) => regionPick(rectRegion({ ...m, x: m.x + dx + 0.5, y: m.y + dx + 0.5 }), 'intersect', d);
          expect(walk(b, camB, marquee(t), indexed)).toEqual(walk(a, camA, marquee(0), indexed));
          if (here.length > 0) hit++;
          if (here.some((id) => ps[LAYERS.indexOf(spec.nodes[Number(id.slice(1))]!.layer)] !== undefined)) onPlane++;
        }
      },
    ), runs(RUNS));
    expect(hit).toBeGreaterThan(40);
    expect(onPlane).toBeGreaterThan(20);
  }, timeoutFor(RUNS, 30));
});

const MODES: readonly LassoHitMode[] = ['intersect', 'enclosed', 'centers'];

describe('a marquee grown', () => {
  it('takes no fewer nodes in any mode, and meets every node it encloses', () => {
    let grew = 0, enclosed = 0;
    const scenes = new Map<number, ReturnType<typeof mixedScene>>();
    // Quarters, so a side can land on a node's edge or between.
    const q = (min: number, max: number) => fc.integer({ min: min * 4, max: max * 4 }).map((n) => n / 4);
    const rect = fc.record({ x: q(-100, 1100), y: q(-100, 1100), width: q(0, 400), height: q(0, 400) });
    const grow = fc.tuple(...[0, 1, 2, 3].map(() => fc.oneof(fc.constant(0), q(0, 300))));
    fc.assert(fc.property(fc.integer({ min: 1, max: 6 }), rect, grow, fc.boolean(), (seed, r, [l, t, rr, bb], groups) => {
      let scene = scenes.get(seed);
      if (!scene) scenes.set(seed, scene = mixedScene(seed, seed % 2 === 0));
      const big: Box = { x: r.x - l, y: r.y - t, width: r.width + l + rr, height: r.height + t + bb };
      const src = scenePickSource(scene as never, { index: { descriptor: d } });
      const take = (b: Box, mode: LassoHitMode) => pickWalk(src, regionPick(rectRegion(b), mode, d, groups));
      for (const mode of MODES) {
        const small = take(r, mode);
        const large = new Set(take(big, mode));
        expect(small.filter((id) => !large.has(id)), mode).toEqual([]);
        if (large.size > small.length) grew++;
      }
      const meets = new Set(take(r, 'intersect'));
      const inside = take(r, 'enclosed');
      expect(inside.filter((id) => !meets.has(id))).toEqual([]);
      if (inside.length > 0) enclosed++;
    }), runs(RUNS));
    expect(grew).toBeGreaterThan(100);
    expect(enclosed).toBeGreaterThan(20);
  }, timeoutFor(RUNS, 60));
});

describe('a marquee', () => {
  it('is the same rect however its corners are named', () => {
    // A zero-size marquee is a line or a point, and still a marquee.
    const scene = mixedScene(3, false);
    const src = scenePickSource(scene as never, { index: { descriptor: d } });
    fc.assert(fc.property(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 200 }), (x, y, w, h) => {
      for (const mode of MODES) {
        const a = pickWalk(src, regionPick(rectRegion({ x, y, width: w, height: h }), mode, d));
        expect(pickWalk(src, regionPick(rectRegion({ x: x + w, y: y + h, width: -w, height: -h }), mode, d)), mode).toEqual(a);
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 30));
});
