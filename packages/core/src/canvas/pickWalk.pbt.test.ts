/**
 * Property tests of the pick walk over generated scenes of boxes: nested groups that clip to their own box,
 * three layers that may be hidden or locked, and nodes hidden, locked, unpickable, or faded to alpha 0. A point
 * pick and a marquee are checked against a brute-force walk of the same spec, the indexed walk against the full
 * one, and both against the scene moved by a whole-number offset.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { pickWalk, scenePickSource, type PickQuery } from './pickWalk';
import { pointPick, regionPick } from './pickIndex/pickIndexFixture';
import {
  ancestorsOf, buildScene, clipBox, inside, intBox, modelHidden, modelLocked, nodeIdOf, runs, sceneSpec, timeoutFor,
  type Box, type BoxScene, type SceneSpec,
} from './pbt.fixture';

const RUNS = 200;
const d = AUTO_POSE_DESCRIPTOR;

/** A half-integer point in and around the scene. */
const halfPoint = fc.record({ x: fc.integer({ min: -5, max: 240 }), y: fc.integer({ min: -5, max: 240 }) })
  .map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));

/** A half-integer point inside one of `spec`'s boxes most of the time, anywhere otherwise. */
const pointIn = (spec: SceneSpec) => fc.oneof(
  { weight: 3, arbitrary: fc.record({ k: fc.nat(), fx: fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), fy: fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }) })
    .map(({ k, fx, fy }) => {
      const b = spec.nodes[k % spec.nodes.length]!.pose;
      return { x: b.x + Math.floor(fx * b.width) + 0.5, y: b.y + Math.floor(fy * b.height) + 0.5 };
    }) },
  { weight: 1, arbitrary: halfPoint },
);

/** A marquee with half-integer corners. */
const halfBox: fc.Arbitrary<Box> = intBox.map((b) => ({ x: b.x + 0.5, y: b.y + 0.5, width: b.width, height: b.height }));

const withPoints = sceneSpec.chain((spec) => fc.tuple(fc.constant(spec), fc.array(pointIn(spec), { minLength: 1, maxLength: 6 })));

const walk = (scene: BoxScene, q: PickQuery<unknown>, indexed: boolean): string[] =>
  pickWalk(scenePickSource(scene as never, indexed ? { index: { descriptor: d } } : {}), q);

/** The scene's own back-to-front order, which the model takes as given. */
const orderOf = (scene: BoxScene, spec: SceneSpec): number[] => {
  const byId = new Map(spec.nodes.map((_, i) => [nodeIdOf(i) as string, i]));
  return scene.renderOrderNodes().map((n) => byId.get(n.id)!);
};

/** Whether node `i` passes every gate but its own shape: painted, opaque, pickable, unlocked unless asked. */
function gated(spec: SceneSpec, i: number, includeLocked: boolean, includeGroups: boolean): boolean {
  const n = spec.nodes[i]!;
  if (!includeGroups && n.group) return false;
  if (n.unpickable || n.faded || modelHidden(spec, i)) return false;
  return includeLocked || !modelLocked(spec, i);
}

const clipsAbove = (spec: SceneSpec, i: number): Box[] =>
  ancestorsOf(spec, i).filter((k) => spec.nodes[k]!.group && spec.nodes[k]!.clip).map((k) => clipBox(spec.nodes[k]!.pose));

function modelPoint(spec: SceneSpec, order: number[], x: number, y: number, includeLocked: boolean): string[] {
  return order.filter((i) => gated(spec, i, includeLocked, true)
    && inside(spec.nodes[i]!.pose, x, y)
    && clipsAbove(spec, i).every((c) => inside(c, x, y))).map((i) => nodeIdOf(i) as string);
}

/** The open boxes' common part, or null when they share no area. */
function common(boxes: readonly Box[]): Box | null {
  const x0 = Math.max(...boxes.map((b) => b.x)), y0 = Math.max(...boxes.map((b) => b.y));
  const x1 = Math.min(...boxes.map((b) => b.x + b.width)), y1 = Math.min(...boxes.map((b) => b.y + b.height));
  return x0 < x1 && y0 < y1 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** A leaf is taken where the marquee meets what is drawn of it: its box inside every ancestor clip. */
function modelMarquee(spec: SceneSpec, order: number[], m: Box): string[] {
  return order.filter((i) => gated(spec, i, false, false)
    && common([spec.nodes[i]!.pose, m, ...clipsAbove(spec, i)]) !== null).map((i) => nodeIdOf(i) as string);
}

const tally = { picked: 0, missed: 0, clipped: 0, locked: 0, gated: 0, marquee: 0 };

describe('pickWalk against a brute-force walk', () => {
  it('a point pick returns every gated node whose box and ancestor clips hold the point, back to front', () => {
    fc.assert(fc.property(withPoints, ([spec, points]) => {
      const scene = buildScene(spec);
      const order = orderOf(scene, spec);
      for (const p of points) {
        const q = pointPick(d, p.x, p.y, { x: 1, y: 1 }, 0);
        const want = modelPoint(spec, order, p.x, p.y, false);
        expect(walk(scene, q, false)).toEqual(want);
        expect(walk(scene, q, true)).toEqual(want);
        const withLocked = modelPoint(spec, order, p.x, p.y, true);
        expect(walk(scene, { ...q, includeLocked: true }, true)).toEqual(withLocked);
        if (want.length > 0) tally.picked++; else tally.missed++;
        if (withLocked.length > want.length) tally.locked++;
        if (order.some((i) => inside(spec.nodes[i]!.pose, p.x, p.y) && clipsAbove(spec, i).some((c) => !inside(c, p.x, p.y)))) tally.clipped++;
        if (order.some((i) => inside(spec.nodes[i]!.pose, p.x, p.y) && !gated(spec, i, true, true))) tally.gated++;
      }
    }), runs(RUNS));
    expect(tally.picked).toBeGreaterThan(50);
    expect(tally.missed).toBeGreaterThan(20);
    expect(tally.clipped).toBeGreaterThan(20);
    expect(tally.locked).toBeGreaterThan(20);
    expect(tally.gated).toBeGreaterThan(20);
  }, timeoutFor(RUNS, 20));

  it('a marquee takes every gated leaf its box meets, inside every ancestor clip', () => {
    let hit = 0;
    fc.assert(fc.property(withPoints, halfBox, ([spec, [p]], m0) => {
      const m = { ...m0, x: p!.x - Math.floor(m0.width / 2), y: p!.y - Math.floor(m0.height / 2) };
      const scene = buildScene(spec);
      const want = modelMarquee(spec, orderOf(scene, spec), m);
      const q = regionPick(rectRegion(m), 'intersect', d);
      expect(walk(scene, q, false)).toEqual(want);
      expect(walk(scene, q, true)).toEqual(want);
      if (want.length > 0) hit++;
    }), runs(RUNS));
    expect(hit).toBeGreaterThan(40);
  }, timeoutFor(RUNS, 20));
});

describe('pickWalk under translation', () => {
  it('moving the scene and the query by the same whole offset picks the same nodes', () => {
    let hit = 0;
    const offset = fc.integer({ min: -5000, max: 5000 });
    fc.assert(fc.property(withPoints, halfBox, offset, offset, ([spec, [p]], m, dx, dy) => {
      const a = buildScene(spec);
      const b = buildScene(spec, dx, dy);
      for (const indexed of [false, true]) {
        const here = walk(a, pointPick(d, p.x, p.y, { x: 1, y: 1 }), indexed);
        expect(walk(b, pointPick(d, p.x + dx, p.y + dy, { x: 1, y: 1 }), indexed)).toEqual(here);
        const moved = { ...m, x: m.x + dx, y: m.y + dy };
        expect(walk(b, regionPick(rectRegion(moved), 'enclosed', d), indexed))
          .toEqual(walk(a, regionPick(rectRegion(m), 'enclosed', d), indexed));
        if (here.length > 0) hit++;
      }
    }), runs(RUNS));
    expect(hit).toBeGreaterThan(40);
  }, timeoutFor(RUNS, 20));
});
