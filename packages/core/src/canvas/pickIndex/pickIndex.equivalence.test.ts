/**
 * The pick index is only a pre-filter: an indexed walk must return exactly
 * what the full walk returns, same ids in the same order, for every query the
 * scene's picks ask.
 */
import { describe, expect, it } from 'vitest';
import type { LassoHitMode } from 'core/adapters/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { polygonRegion, rectRegion } from 'core/geometry/regionHit';
import type { View } from 'core/viewport/view';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { pickWalk, scenePickSource, type PickQuery, type PickSource } from 'canvas/pickWalk';
import { mixedScene, pointPick, regionPick, rng } from './pickIndexFixture';
import { pickIndexBuildCount } from './scenePickIndex';
import { asNodeId } from 'core/scene/types';
import type { AnyScene } from 'core/scene/anyScene';

interface Tally { used: number; candidates: number; order: number; hits: number }

function counted<T>(src: PickSource<T>, tally: Tally): PickSource<T> {
  const candidates = src.candidates!;
  return {
    ...src,
    candidates: (broadFor) => {
      const found = candidates(broadFor);
      if (found) {
        tally.used++;
        tally.candidates += found.length;
        tally.order += src.order().length;
      }
      return found;
    },
  };
}

const MODES: readonly LassoHitMode[] = ['intersect', 'enclosed', 'centers'];

/** 300 queries at view scale `s`: marquees, lassos and points, half of the
 *  points dropped near a node's box edge, where a box too tight shows first. */
function queries(scene: AnyScene, s: number, seed: number, d: PoseDescriptor<unknown>): { label: string; q: PickQuery<unknown> }[] {
  const r = rng(seed);
  const out: { label: string; q: PickQuery<unknown> }[] = [];
  type Box = { x: number; y: number; width: number; height: number };
  const boxed = scene.renderOrderNodes().filter((n) => typeof (n.pose as Partial<Box>).width === 'number');
  const poses = boxed.map((n) => n.pose as Box);
  // A stroke reaches past its pose box, so the boxes of stroked nodes are where a
  // box built too tight shows: half the targets are theirs.
  const stroked = boxed.filter((n) => /^(px|outer|gon)/.test(n.id)).map((n) => n.pose as Box);
  for (let i = 0; i < 100; i++) {
    const rect = { x: r() * 1300 - 100, y: r() * 1100 - 100, width: 1 + r() * 300, height: 1 + r() * 300 };
    out.push({ label: `marquee ${JSON.stringify(rect)}`, q: regionPick(rectRegion(rect), 'intersect', d, i % 4 === 0) });
  }
  for (let i = 0; i < 100; i++) {
    const cx = r() * 1300 - 100, cy = r() * 1100 - 100, rad = 5 + r() * 200;
    const n = 3 + Math.floor(r() * 5);
    const poly = Array.from({ length: n }, (_, k) => {
      const t = (k / n) * Math.PI * 2 + r() * 0.5;
      const k2 = 0.4 + r() * 0.6;
      return { x: cx + Math.cos(t) * rad * k2, y: cy + Math.sin(t) * rad * k2 };
    });
    const mode = MODES[i % 3];
    out.push({ label: `lasso ${mode} ${JSON.stringify(poly)}`, q: regionPick(polygonRegion(poly)!, mode, d) });
  }
  const scales = [{ x: s, y: s }, { x: s, y: s * 3 }];
  for (let i = 0; i < 100; i++) {
    let x: number, y: number;
    if (i % 2 === 0) {
      x = r() * 1300 - 100;
      y = r() * 1100 - 100;
    } else {
      const from = i % 4 === 1 ? stroked : poses;
      const p = from[Math.floor(r() * from.length)];
      const slop = (4 + 6) / s + 10;
      x = p.x + (r() < 0.5 ? 0 : p.width) + (r() * 2 - 1) * slop;
      y = p.y + (r() < 0.3 ? 0 : r() * p.height) + (r() * 2 - 1) * slop;
    }
    const sc = scales[i % 2];
    const q = pointPick(d, x, y, sc);
    out.push({ label: `point (${x}, ${y}) at ${JSON.stringify(sc)}`, q: i % 5 === 0 ? { ...q, includeLocked: true } : q });
  }
  return out;
}

function compare(scene: AnyScene, s: number, seed: number, d: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR) {
  const camera: View = { x: 120, y: -40, scale: { x: s, y: s } };
  const plain = scenePickSource(scene, { camera });
  const tally: Tally = { used: 0, candidates: 0, order: 0, hits: 0 };
  const indexed = counted(scenePickSource(scene, { camera, index: { descriptor: d } }), tally);
  const mismatches: string[] = [];
  const all = queries(scene, s, seed, d);
  // The first pick in a scene only records it; the index builds on the second.
  pickWalk(indexed, all[0].q);
  for (const { label, q } of all) {
    const want = pickWalk(plain, q);
    const got = pickWalk(indexed, q);
    tally.hits += want.length;
    if (JSON.stringify(got) !== JSON.stringify(want)) mismatches.push(`${label}: want ${want} got ${got}`);
  }
  return { mismatches, tally };
}

describe('pick index', () => {
  for (const composed of [false, true]) {
    for (const s of [0.05, 1, 20]) {
      it(`indexed walk returns what the full walk returns (${composed ? 'composed' : 'absolute'}, scale ${s})`, () => {
        const scene = mixedScene(7, composed);
        const { mismatches, tally } = compare(scene, s, 1000 + s * 10);
        expect(mismatches.slice(0, 5)).toEqual([]);
        // Not vacuous: the index answered every query, pruned, and the queries hit things.
        expect(tally.used).toBe(300);
        expect(tally.candidates).toBeLessThan(tally.order);
        expect(tally.hits).toBeGreaterThan(100);
      });
    }
  }

  it('indexed walk returns what the full walk returns through a descriptor that reads each node', () => {
    // A box stretched rightward by the node's own data, which only `forNode` can see: it moves the center `centers` reads.
    const d: PoseDescriptor<unknown> = {
      ...AUTO_POSE_DESCRIPTOR,
      forNode: (node) => {
        const grow = ((node as { data?: { grow?: number } | null }).data?.grow) ?? 0;
        if (grow === 0) return AUTO_POSE_DESCRIPTOR;
        return {
          ...AUTO_POSE_DESCRIPTOR,
          getBounds: (p) => {
            const b = AUTO_POSE_DESCRIPTOR.getBounds(p);
            return { x: b.x, y: b.y, width: b.width + 4 * grow, height: b.height };
          },
        };
      },
    };
    const { mismatches, tally } = compare(mixedScene(11, false), 1, 77, d);
    expect(mismatches.slice(0, 5)).toEqual([]);
    expect(tally.used).toBe(300);
  });

  it('an id the scene does not hold is never a candidate', () => {
    const scene = mixedScene(3, false);
    const src = scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } });
    const q = pointPick(AUTO_POSE_DESCRIPTOR, 500, 500, { x: 1, y: 1 });
    const ids = new Set(scene.renderOrderNodes().map((n) => n.id as string));
    for (const c of src.candidates!(() => q.broad) ?? []) expect(ids.has(c.id)).toBe(true);
  });

  /** One edit of the kinds the index follows without a build, chosen by `r`. */
  function edit(scene: AnyScene, r: () => number, step: number): void {
    const marks = scene.renderOrderNodes().filter((n) => /^r\d/.test(n.id) && n.parent === null);
    const pick = () => marks[Math.floor(r() * marks.length)]!;
    const k = step % 6;
    if (k === 0) {
      const n = pick();
      const p = n.pose as Record<string, number>;
      scene.setPose(n.id, { ...p, x: r() * 900, y: r() * 900 } as never);
    } else if (k === 1) {
      const p = scene.get(asNodeId('frame'))!.pose as Record<string, number>;
      scene.setPose(asNodeId('frame'), { ...p, x: p.x + (r() - 0.5) * 300 } as never);
    } else if (k === 2) {
      scene.update(pick().id, { data: { shape: 'rect', fill: null, stroke: { paint: { color: '#000000' }, width: 6 + r() * 30 } } as never });
    } else if (k === 3) {
      const n = pick();
      scene.overrides.set(n.id, { pose: { ...(n.pose as object), x: r() * 900 } as never });
      scene.overrides.commit();
    } else if (k === 4) {
      scene.add({ kind: 'mark', layer: 'main', pose: { x: r() * 900, y: r() * 900, width: 30, height: 30 }, data: { shape: 'rect', fill: { paint: { color: '#123456' } } } } as never);
    } else {
      const n = pick();
      if (r() < 0.5) scene.remove(n.id);
      else scene.move(n.id, asNodeId('frame'));
    }
  }

  for (const composed of [false, true]) {
    it(`follows 24 edits without a build, each pick still what the full walk returns (${composed ? 'composed' : 'absolute'})`, () => {
      const scene = mixedScene(5, composed);
      compare(scene, 1, 9);
      const before = pickIndexBuildCount();
      const r = rng(41);
      for (let step = 0; step < 24; step++) {
        edit(scene, r, step);
        const { mismatches } = compare(scene, 1, 100 + step);
        expect(mismatches.slice(0, 3)).toEqual([]);
      }
      expect(pickIndexBuildCount()).toBe(before);
    });
  }
});
