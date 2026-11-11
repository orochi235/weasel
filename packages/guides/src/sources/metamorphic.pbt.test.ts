/**
 * Second-pass metamorphic properties of the snap sources through a real session: a scene and its guides moved or
 * scaled whole snap alike, moved or scaled; the order guides and siblings come in decides only a tie; and a point or
 * a box already snapped stays where it is.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Bounds, SnapSource } from '@weasel-js/core';
import type { Guide } from '../guides/types';
import { eighth, posEighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { alignmentSnapSource } from './alignment';
import { gridSnapSource } from './grid';
import { guideSnapSource } from './guides';
import { spacingSnapSource } from './spacing';
import { drive, moveBy, sceneOf } from './testing/session';

const RUNS = runs(120);
const TIMEOUT = timeoutFor(120, 30);
type Point = { x: number; y: number };

const guideList = fc.array(
  fc.record({ axis: fc.constantFrom<'x' | 'y'>('x', 'y'), offset: eighth(60).map((v) => v + 1 / 16) }),
  { maxLength: 8 },
).map((gs): Guide[] => gs.map((g, i) => ({ id: `g${i}`, ...g })));
const boxOf = fc.record({ x: eighth(60), y: eighth(60), width: posEighth(30), height: posEighth(30) });
const siblings = fc.array(boxOf, { minLength: 1, maxLength: 5 });
const view = fc.record({ scale: fc.constantFrom(0.5, 1, 2), reachPx: fc.integer({ min: 1, max: 16 }) });
/** A whole-scene shift, from a hair to far out, exact on the eighth lattice. */
const shift = fc.record({ x: eighth(4096), y: eighth(4096) });
const power = fc.integer({ min: -2, max: 3 }).map((k) => 2 ** k);

const moved = (b: Bounds, t: Point): Bounds => ({ ...b, x: b.x + t.x, y: b.y + t.y });
const scaled = (b: Bounds, s: number): Bounds => ({ x: b.x * s, y: b.y * s, width: b.width * s, height: b.height * s });
const shiftGuides = (gs: readonly Guide[], t: Point): Guide[] => gs.map((g) => ({ ...g, offset: g.offset + t[g.axis] }));

/** A sibling scene's move of its first box by `d`: the delta it settles on. */
function moveFirst(sources: () => SnapSource[], boxes: readonly Bounds[], d: Point, v: { scale: number; reachPx: number }): Point {
  const { scene, ids } = sceneOf(boxes);
  return moveBy({ sources: sources(), scene, ids: [ids[0]!], scale: v.scale, reachPx: v.reachPx }).by(d.x, d.y).point;
}

const sibSources = () => [alignmentSnapSource(), spacingSnapSource()];

describe('snap sources through a session, metamorphic', () => {
  it('a pointer snaps to guides moved with it by the same move', () => {
    fc.assert(fc.property(guideList, view, eighth(60), eighth(60), shift, (gs, v, x, y, t) => {
      const a = drive({ sources: [guideSnapSource(() => gs)], ...v }).at({ x, y }).point;
      const b = drive({ sources: [guideSnapSource(() => shiftGuides(gs, t))], ...v }).at({ x: x + t.x, y: y + t.y }).point;
      expect(b).toEqual({ x: a.x + t.x, y: a.y + t.y });
    }), RUNS);
  }, TIMEOUT);

  it('a pointer snaps to a grid moved with it by its origin', () => {
    fc.assert(fc.property(posEighth(10), view, eighth(60), eighth(60), shift, (pitch, v, x, y, t) => {
      const a = drive({ sources: [gridSnapSource({ spacing: pitch })], ...v }).at({ x, y }).point;
      const b = drive({ sources: [gridSnapSource({ spacing: pitch, origin: t })], ...v }).at({ x: x + t.x, y: y + t.y }).point;
      expect(b).toEqual({ x: a.x + t.x, y: a.y + t.y });
    }), RUNS);
  }, TIMEOUT);

  it('a box moved among its siblings snaps alike when the whole scene is moved', () => {
    const t0 = tally();
    fc.assert(fc.property(boxOf, siblings, view, eighth(30), eighth(30), shift, (box, others, v, dx, dy, t) => {
      const a = moveFirst(sibSources, [box, ...others], { x: dx, y: dy }, v);
      const b = moveFirst(sibSources, [box, ...others].map((o) => moved(o, t)), { x: dx, y: dy }, v);
      expect(b).toEqual(a);
      t0.count(a.x !== dx || a.y !== dy ? 'snapped' : 'free');
    }), RUNS);
    t0.atLeast('snapped', 30);
  }, TIMEOUT);

  it('a box moved among its siblings snaps alike, scaled, when the scene is scaled whole and the view against it', () => {
    const t0 = tally();
    fc.assert(fc.property(boxOf, siblings, view, eighth(30), eighth(30), power, (box, others, v, dx, dy, s) => {
      const a = moveFirst(sibSources, [box, ...others], { x: dx, y: dy }, v);
      const b = moveFirst(sibSources, [box, ...others].map((o) => scaled(o, s)), { x: dx * s, y: dy * s }, { ...v, scale: v.scale / s });
      expect(b).toEqual({ x: a.x * s, y: a.y * s });
      t0.count(a.x !== dx || a.y !== dy ? 'snapped' : 'free');
    }), RUNS);
    t0.atLeast('snapped', 30);
  }, TIMEOUT);

  it('the order guides come in decides only between guides as near', () => {
    fc.assert(fc.property(guideList, view, eighth(60), eighth(60), fc.infiniteStream(fc.nat()), (gs, v, x, y, picks) => {
      const shuffled = [...gs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = picks.next().value % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      const a = drive({ sources: [guideSnapSource(() => gs)], ...v }).at({ x, y }).point;
      const b = drive({ sources: [guideSnapSource(() => shuffled)], ...v }).at({ x, y }).point;
      // Coincident guides, or one on each axis as near, tie; either may win.
      expect(Math.hypot(b.x - x, b.y - y)).toBe(Math.hypot(a.x - x, a.y - y));
    }), RUNS);
  }, TIMEOUT);

  it('the order siblings come in decides only between snaps as near', () => {
    fc.assert(fc.property(boxOf, siblings, view, eighth(30), eighth(30), (box, others, v, dx, dy) => {
      const a = moveFirst(sibSources, [box, ...others], { x: dx, y: dy }, v);
      const b = moveFirst(sibSources, [box, ...[...others].reverse()], { x: dx, y: dy }, v);
      expect(Math.abs(b.x - dx)).toBe(Math.abs(a.x - dx));
      expect(Math.abs(b.y - dy)).toBe(Math.abs(a.y - dy));
    }), RUNS);
  }, TIMEOUT);

  it('a pointer already snapped to guides stays on each axis it snapped on, and on a grid alone, stays put', () => {
    const t0 = tally();
    fc.assert(fc.property(guideList, view, eighth(60), eighth(60), (gs, v, x, y) => {
      const q = drive({ sources: [guideSnapSource(() => gs)], ...v }).at({ x, y }).point;
      const again = drive({ sources: [guideSnapSource(() => gs)], ...v }).at(q).point;
      // An axis left free can come in reach once the other has snapped: reach is a disc about the pointer.
      if (q.x !== x) expect(again.x).toBe(q.x);
      if (q.y !== y) expect(again.y).toBe(q.y);
      t0.count(q.x !== x && q.y !== y ? 'both' : q.x !== x || q.y !== y ? 'one' : 'free');
    }), RUNS);
    fc.assert(fc.property(posEighth(10), view, eighth(60), eighth(60), (pitch, v, x, y) => {
      const q = drive({ sources: [gridSnapSource({ spacing: pitch })], ...v }).at({ x, y }).point;
      expect(drive({ sources: [gridSnapSource({ spacing: pitch })], ...v }).at(q).point).toEqual(q);
    }), RUNS);
    t0.atLeast('one', 20);
    t0.atLeast('both', 5);
  }, TIMEOUT);

  it('a box already snapped among its siblings stays on each axis it snapped on', () => {
    const t0 = tally();
    fc.assert(fc.property(boxOf, siblings, view, eighth(30), eighth(30), (box, others, v, dx, dy) => {
      const d = moveFirst(sibSources, [box, ...others], { x: dx, y: dy }, v);
      const again = moveFirst(sibSources, [moved(box, d), ...others], { x: 0, y: 0 }, v);
      // A free axis that comes in reach can carry the box off an equal gap the other axis snapped to.
      const freeMoved = (d.x === dx && again.x !== 0) || (d.y === dy && again.y !== 0);
      if (!freeMoved && d.x !== dx) expect(again.x).toBe(0);
      if (!freeMoved && d.y !== dy) expect(again.y).toBe(0);
      t0.count(d.x !== dx || d.y !== dy ? 'snapped' : 'free');
    }), RUNS);
    t0.atLeast('snapped', 30);
  }, TIMEOUT);
});
