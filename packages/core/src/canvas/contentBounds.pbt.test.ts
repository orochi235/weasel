/**
 * Property tests of `copiesWithin` and `sceneContentBounds` over generated scenes: chains of groups, each
 * drawing its content again under a few random transforms or none, with leaves hidden or shown. The copies are
 * checked against composing every choice of copy at every level, outermost first; the content box against
 * every shown root's box and every corner of each copy of a shown container.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { transformPoint, multiply, rotateAboutPoint, translate, type Affine } from '@weasel-js/geom';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { sceneContentBounds } from './contentBounds';
import { copiesWithin } from './copiesAbove';
import { runs, timeoutFor, type Box } from './pbt.fixture';

const RUNS = 200;

const affine: fc.Arbitrary<Affine> = fc.oneof(
  fc.tuple(fc.integer({ min: -300, max: 300 }), fc.integer({ min: -300, max: 300 })).map(([x, y]) => translate(x, y)),
  fc.tuple(fc.integer({ min: -200, max: 200 }), fc.integer({ min: -200, max: 200 }), fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }))
    .map(([x, y, t]) => rotateAboutPoint(x, y, t)),
);

const box = fc.record({
  x: fc.integer({ min: -100, max: 100 }), y: fc.integer({ min: -100, max: 100 }),
  width: fc.integer({ min: 1, max: 80 }), height: fc.integer({ min: 1, max: 80 }),
});

interface Level { copies: Affine[]; leaf: Box; hidden: boolean }

/** `levels[i]` is a group holding a leaf and, past the last, the group of `levels[i + 1]`. */
const chain = fc.array(fc.record({
  copies: fc.array(affine, { maxLength: 2 }),
  leaf: box,
  hidden: fc.integer({ min: 0, max: 5 }).map((n) => n === 0),
}), { minLength: 1, maxLength: 4 });

const groupId = (i: number): NodeId => asNodeId(`g${i}`);
const leafId = (i: number): NodeId => asNodeId(`l${i}`);

function build(levels: readonly Level[]) {
  const scene = createScene<null, 'a', Box>({ systemLayers: [{ id: 'a' }], composition: IDENTITY_POSE_COMPOSITION as never });
  levels.forEach((lv, i) => {
    scene.add({
      id: groupId(i), kind: 'group', layer: 'a', data: null, pose: { x: 0, y: 0, width: 0, height: 0 },
      ...(i > 0 ? { parent: groupId(i - 1) } : {}),
      ...(lv.copies.length > 0 ? { copiesFromPose: () => lv.copies } : {}),
    } as never);
    scene.add({ id: leafId(i), kind: 'mark', layer: 'a', data: null, pose: lv.leaf, parent: groupId(i) } as never);
  });
  levels.forEach((lv, i) => { if (lv.hidden) scene.setHidden(leafId(i), true); });
  return scene;
}

/** Every product of one choice per level, the identity or one of its copies, outermost first; the all-identity one dropped. */
function modelCopies(levels: readonly Level[], upTo: number): Affine[] {
  let all: Affine[] = [[1, 0, 0, 1, 0, 0]];
  for (let i = 0; i <= upTo; i++) {
    const cs = levels[i]!.copies;
    if (cs.length > 0) all = all.flatMap((m) => [m, ...cs.map((c) => multiply(m, c))]);
  }
  return all.slice(1);
}

const near = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));

describe('copiesWithin', () => {
  it('is every choice of copy at every level above, composed outermost first', () => {
    let many = 0;
    fc.assert(fc.property(chain, (levels) => {
      const scene = build(levels);
      for (let i = 0; i < levels.length; i++) {
        const got = copiesWithin(scene, groupId(i), (n) => n.pose);
        const want = modelCopies(levels, i);
        expect(got.length).toBe(want.length);
        got.forEach((m, k) => near(m, want[k]!));
        if (got.length >= 4) many++;
      }
      expect(copiesWithin(scene, null, (n) => n.pose)).toEqual([]);
    }), runs(RUNS));
    expect(many).toBeGreaterThan(20);
  }, timeoutFor(RUNS, 5));
});

describe('sceneContentBounds', () => {
  it('holds every shown leaf in every copy it is drawn in, and is null when nothing is', () => {
    let empty = 0, copied = 0;
    fc.assert(fc.property(chain, (levels) => {
      const scene = build(levels);
      // A group's box is the union of its shown leaves; nothing nested draws copies of itself here.
      const below = (i: number): Box[] => levels.slice(i).flatMap((lv, k) => (lv.hidden ? [] : [{ lv, k: k + i }]))
        .map(({ lv, k }) => {
          const ms = [[1, 0, 0, 1, 0, 0] as Affine, ...levels.slice(i + 1, k + 1).reduce<Affine[]>((acc, l) => (l.copies.length === 0 ? acc
            : acc.flatMap((m) => [m, ...l.copies.map((c) => multiply(m, c))])), [[1, 0, 0, 1, 0, 0]]).slice(1)];
          return ms.map((m) => cornersBox(lv.leaf, m));
        }).flat();
      const boxOf = (id: NodeId) => {
        const s = id as string;
        const i = Number(s.slice(1));
        const parts = s[0] === 'l' ? (levels[i]!.hidden ? [] : [levels[i]!.leaf]) : below(i);
        return parts.length === 0 ? null : unionOf(parts);
      };
      const got = sceneContentBounds(scene, boxOf);
      const shown = levels.flatMap((lv, i) => (lv.hidden ? [] : [{ lv, i }]));
      if (shown.length === 0) {
        empty++;
        expect(got).toBeNull();
        return;
      }
      expect(got).not.toBeNull();
      for (const { lv, i } of shown) {
        const all = [[1, 0, 0, 1, 0, 0] as Affine, ...copiesWithin(scene, groupId(i), (n) => n.pose)];
        if (all.length > 1) copied++;
        for (const m of all) {
          const b = cornersBox(lv.leaf, m);
          const eps = 1e-6;
          expect(b.x).toBeGreaterThanOrEqual(got!.x - eps);
          expect(b.y).toBeGreaterThanOrEqual(got!.y - eps);
          expect(b.x + b.width).toBeLessThanOrEqual(got!.x + got!.width + eps);
          expect(b.y + b.height).toBeLessThanOrEqual(got!.y + got!.height + eps);
        }
      }
      for (const v of [got!.x, got!.y, got!.width, got!.height]) expect(Number.isFinite(v)).toBe(true);
    }), runs(RUNS));
    expect(empty).toBeGreaterThan(3);
    expect(copied).toBeGreaterThan(50);
  }, timeoutFor(RUNS, 5));
});

function cornersBox(b: Box, m: Affine): Box {
  const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => transformPoint(m, x!, y!));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function unionOf(bs: readonly Box[]): Box {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y };
}
