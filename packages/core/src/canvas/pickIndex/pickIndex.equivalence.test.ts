/**
 * The pick index is only a pre-filter: an indexed walk must return exactly
 * what the full walk returns, same ids in the same order, for every query the
 * scene's picks ask.
 */
import { describe, expect, it } from 'vitest';
import { linePath, rotateAboutPoint, translate, PATH_L, PATH_M, PATH_Z, type Affine, type Path } from '@weasel-js/geom';
import type { LassoHitMode } from 'core/adapters/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { polygonRegion, rectRegion } from 'core/geometry/regionHit';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { pickWalk, scenePickSource, type PickQuery, type PickSource } from 'canvas/pickWalk';
import { pointPick, regionPick } from './pickIndexFixture';

type AnyScene = Scene<unknown, string, unknown>;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOLID = { paint: { kind: 'solid', color: '#336699' } };
const INK = { kind: 'solid', color: '#000000' };

const square = (x: number, y: number, w: number): Path => ({
  kind: 'polygon',
  commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z),
  coords: Float32Array.of(x, y, x + w, y, x + w, y + w * 0.6, x, y + w),
  fillRule: 'nonzero',
});

/** Every kind of node the walk treats differently, scattered over [0, 1000]². */
function mixedScene(seed: number, composed: boolean): AnyScene {
  const r = rng(seed);
  const scene = createScene<unknown, string, unknown>({
    systemLayers: [{ id: 'back', parallax: { pan: 0.25 } }, { id: 'main' }],
    ...(composed ? { composition: RIGID_POSE_COMPOSITION as never } : {}),
  });
  const id = (s: string) => asNodeId(s);
  const at = () => ({ x: r() * 900, y: r() * 900 });
  const add = (spec: Record<string, unknown>) => scene.add({ kind: 'leaf', layer: 'main', data: null, ...spec } as never);

  for (let i = 0; i < 40; i++) {
    const { x, y } = at();
    const pose: Record<string, unknown> = { x, y, width: 5 + r() * 80, height: 5 + r() * 80 };
    if (i % 2 === 0) pose.rotation = r() * Math.PI * 2;
    if (i % 7 === 3) pose.transform = [1, 0.6, -0.3, 1.4];
    const data = i % 3 === 0 ? null : { shape: i % 3 === 1 ? 'rect' : 'ellipse', fill: SOLID, grow: (i % 5) * 15 };
    add({ id: id(`r${i}`), pose, data });
  }
  for (let i = 0; i < 6; i++) {
    const { x, y } = at();
    add({
      id: id(`gon${i}`), pose: { x, y, width: 60, height: 60, rotation: i * 0.4 },
      data: { shape: 'polygon', sides: 24, fill: i % 2 ? SOLID : null, stroke: { paint: INK, width: 3 } },
    });
  }
  for (let i = 0; i < 4; i++) {
    const { x, y } = at();
    add({
      id: id(`px${i}`), pose: { x, y, width: 50, height: 30, ...(i % 2 ? { rotation: 0.7 } : {}) },
      data: { shape: 'rect', fill: null, stroke: { paint: INK, width: { px: 6 } } },
    });
    add({
      id: id(`outer${i}`), pose: { x: y, y: x, width: 40, height: 40 },
      data: { shape: i % 2 ? 'ellipse' : 'rect', fill: null, stroke: { paint: INK, width: 8, align: 'outer' } },
    });
  }
  for (let i = 0; i < 3; i++) {
    const { x, y } = at();
    add({ id: id(`path${i}`), pose: square(x, y, 50) });
  }
  // Connectors between pairs of rects; the pose is a placeholder at the origin.
  for (let i = 0; i < 4; i++) {
    add({
      id: id(`edge${i}`), pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { stroke: { paint: INK, width: 4 } },
      dependsOn: [id(`r${i * 2}`), id(`r${i * 2 + 5}`)],
      derivePath: (_n: unknown, deps: readonly ({ pose: { x: number; y: number } } | undefined)[]) => {
        const [a, b] = [deps[0]?.pose, deps[1]?.pose];
        return a && b ? linePath({ x: a.x, y: a.y }, { x: b.x, y: b.y }) : null;
      },
    });
  }
  const clip = add({
    id: id('clip'), kind: 'container', pose: { x: 600, y: 600, width: 100, height: 100, rotation: 0.3 },
    clipFromPose: (p: { x: number; y: number; width: number; height: number }) =>
      ({ kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height }),
  });
  add({ id: id('clip.in'), parent: clip, pose: { x: 620, y: 620, width: 30, height: 30 }, data: { shape: 'rect', fill: SOLID } });
  add({ id: id('clip.out'), parent: clip, pose: { x: 670, y: 650, width: 90, height: 40, rotation: 0.5 } });
  const copies: Affine[] = [translate(300, 0), rotateAboutPoint(200, 200, 1.1)];
  const copy = add({
    id: id('copy'), kind: 'container', pose: { x: 100, y: 100, width: 0, height: 0 },
    copiesFromPose: () => copies, clipFromPose: () => null,
  });
  add({ id: id('copy.a'), parent: copy, pose: { x: 120, y: 130, width: 40, height: 20 }, data: { shape: 'rect', fill: SOLID } });
  const frame = add({ id: id('frame'), kind: 'container', pose: { x: 300, y: 300, width: 200, height: 100, rotation: Math.PI / 3 }, clipFromPose: () => null });
  add({ id: id('frame.a'), parent: frame, pose: { x: 320, y: 310, width: 40, height: 30, rotation: 0.2 } });
  add({ id: id('frame.b'), parent: frame, pose: { x: 10, y: 20, width: 30, height: 30 } });
  for (let i = 0; i < 15; i++) {
    const { x, y } = at();
    add({ id: id(`hill${i}`), layer: 'back', pose: { x, y, width: 20 + r() * 100, height: 20 + r() * 60, rotation: r() } });
  }

  scene.setLocked(id('r1'), true);
  scene.setLocked(id('gon1'), true);
  scene.setHidden(id('r4'), true);
  scene.setHidden(id('hill2'), true);
  scene.overrides.set(id('r7'), { alpha: 0 });
  scene.overrides.set(id('r8'), { alpha: 0.4 });
  scene.overrides.set(id('r10'), { pose: { x: 950, y: 40, width: 60, height: 30, rotation: 0.9 } });
  scene.overrides.commit();
  return scene as AnyScene;
}

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
  for (const { label, q } of queries(scene, s, seed, d)) {
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
});
