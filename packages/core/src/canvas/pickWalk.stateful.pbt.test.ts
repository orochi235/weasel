/**
 * Stateful property test of the pick walk: long runs of scene edits (poses, overrides, flags, reorders,
 * reparenting, adds, removes, undo and redo), camera and layer changes, and picks. After every step the
 * indexed walk answers every point pick and marquee exactly as the full walk does, and an edit that moves
 * no node in the tree leaves the render order as it was.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { IDENTITY_POSE_COMPOSITION, RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { LassoHitMode } from 'core/adapters/types';
import { pickWalk, scenePickSource, type PickQuery } from './pickWalk';
import { pointPick, regionPick } from './pickIndex/pickIndexFixture';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = 400;
const d = AUTO_POSE_DESCRIPTOR;
const LAYERS = ['back', 'main', 'top'] as const;
type Layer = (typeof LAYERS)[number];
type Pose = { x: number; y: number; width: number; height: number; rotation?: number; transform?: number[] };
type S = Scene<unknown, Layer, Pose>;

/** Ids include the names a plain object already answers for. */
const IDS = ['a', 'b', 'c', '__proto__', 'toString', 'constructor', 'hasOwnProperty', 'g1', 'g2', 'valueOf'];
const GROUPS = new Set(['g1', 'g2', 'constructor']);

interface Real { scene: S; camera: View; tally: { picks: number; hits: number; indexed: number } }

const coord = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: -50, max: 400 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, 5e-324, 1e-300, 1e15, -1e15, 2 ** 52, NaN, Infinity, -Infinity) },
);
const size = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: 1, max: 200 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 5e-324, 1e-300, 1e12, -3, NaN, Infinity) },
);
/** A pose's linear part, degenerate as often as not: a squash to a line or a point, or a scale near zero. */
const transform = fc.constantFrom([1, 0.6, -0.3, 1.4], [0, 0, 0, 0], [1, 0, 0, 0], [1, 2, 2, 4], [1e-300, 0, 0, 1e-300], [-1, 0, 0, 1], [1e200, 0, 0, 1]);
const pose: fc.Arbitrary<Pose> = fc.record({
  x: coord, y: coord, width: size, height: size,
  rotation: fc.option(fc.constantFrom(0, 0.3, Math.PI / 2, Math.PI, 2.5, NaN), { nil: undefined }),
  transform: fc.option(transform.map((t) => [...t]), { nil: undefined, freq: 4 }),
}).map(({ rotation, transform: t, ...p }) => ({ ...p, ...(rotation !== undefined ? { rotation } : {}), ...(t ? { transform: t } : {}) }));
const id = fc.constantFrom(...IDS).map(asNodeId);
const layer = fc.constantFrom(...LAYERS);
const scale = fc.constantFrom(0.25, 0.5, 1, 2, 8, 1e-3, 1e3, -1);

/** Data a node is drawn with: none (its box), or a painter's rect with a world or a screen stroke. */
const data = fc.constantFrom<unknown>(
  null,
  { shape: 'rect', fill: { paint: { kind: 'solid', color: '#000' } } },
  { shape: 'ellipse', fill: null, stroke: { paint: { kind: 'solid', color: '#000' }, width: { px: 6 } } },
  { shape: 'rect', fill: null, stroke: { paint: { kind: 'solid', color: '#000' }, width: 8, align: 'outer' } },
);

const edit = (real: Real, fn: (s: S) => void): void => {
  try {
    real.scene.unlocked(() => fn(real.scene));
  } catch {
    // The scene refuses an edit it cannot make (a cycle, a missing id, a layer below the parent's): that is its answer.
  }
};

const orderIds = (s: S): string[] => s.renderOrderNodes().map((n) => n.id);

function cmd(label: string, run: (r: Real) => void, keepsOrder = false): fc.Command<object, Real> {
  return {
    check: () => true,
    run: (_m, r) => {
      const before = keepsOrder ? orderIds(r.scene) : null;
      run(r);
      if (before) expect(orderIds(r.scene), label).toEqual(before);
    },
    toString: () => label,
  };
}

function walk(r: Real, q: PickQuery<unknown>, indexed: boolean): string[] {
  const src = scenePickSource(r.scene as never, { camera: r.camera, ...(indexed ? { index: { descriptor: d } } : {}) });
  const candidates = src.candidates;
  if (candidates) {
    src.candidates = (broadFor) => {
      const found = candidates(broadFor);
      if (found !== null) r.tally.indexed++;
      return found;
    };
  }
  return pickWalk(src, q);
}

function same(r: Real, q: PickQuery<unknown>, label: string): void {
  const full = walk(r, q, false);
  // Twice: the first pick after an edit only records the state; the second builds the index and reads it.
  expect(walk(r, q, true), label).toEqual(full);
  expect(walk(r, q, true), label).toEqual(full);
  r.tally.picks++;
  if (full.length > 0) r.tally.hits++;
}

const commands = [
  fc.tuple(id, layer, pose, data, fc.option(id, { nil: undefined })).map(([n, l, p, dt, parent]) => cmd(
    `add ${n} on ${l} under ${String(parent)}`,
    (r) => edit(r, (s) => {
      if (s.get(n)) return;
      s.add({ id: n, kind: GROUPS.has(n) ? 'group' : 'mark', layer: l, pose: p, data: dt,
        ...(parent && s.get(parent)?.kind === 'group' ? { parent } : {}),
        ...(n === 'g1' ? { clipFromPose: (q: Pose) => ({ kind: 'rect', ...q }) } : {}) } as never);
    }),
  )),
  id.map((n) => cmd(`remove ${n}`, (r) => edit(r, (s) => s.remove(n)))),
  fc.tuple(id, pose).map(([n, p]) => cmd(`setPose ${n} ${JSON.stringify(p)}`, (r) => edit(r, (s) => s.setPose(n, p)), true)),
  fc.tuple(id, fc.option(pose, { nil: undefined }), fc.constantFrom(undefined, 0, 0.5, 1)).map(([n, p, alpha]) => cmd(
    `override ${n} ${JSON.stringify(p)} alpha ${alpha}`,
    (r) => {
      if (!r.scene.get(n)) return;
      r.scene.overrides.set(n, { ...(p ? { pose: p } : {}), ...(alpha !== undefined ? { alpha } : {}) });
      r.scene.overrides.commit();
    },
    true,
  )),
  fc.tuple(id, fc.boolean()).map(([n, h]) => cmd(`setHidden ${n} ${h}`, (r) => edit(r, (s) => s.setHidden(n, h)), true)),
  fc.tuple(id, fc.boolean()).map(([n, k]) => cmd(`setLocked ${n} ${k}`, (r) => edit(r, (s) => s.setLocked(n, k)), true)),
  fc.tuple(id, fc.nat({ max: 9 })).map(([n, i]) => cmd(`reorder ${n} ${i}`, (r) => edit(r, (s) => s.reorder(n, i)))),
  fc.tuple(id, fc.option(id, { nil: null })).map(([n, p]) => cmd(`move ${n} under ${String(p)}`, (r) => edit(r, (s) => s.move(n, p)))),
  fc.tuple(layer, fc.boolean()).map(([l, v]) => cmd(`setLayerVisible ${l} ${v}`, (r) => edit(r, (s) => s.setLayerVisible(l, v)), true)),
  fc.tuple(layer, fc.constantFrom(undefined, 0, 0.25, 0.5, 2)).map(([l, pan]) => cmd(
    `setLayerParallax ${l} ${pan}`,
    (r) => edit(r, (s) => s.setLayerParallax(l, pan === undefined ? undefined : { pan, anchor: { x: 40, y: -20 } })),
    true,
  )),
  fc.tuple(coord, coord, scale).map(([x, y, k]) => cmd(`camera ${x},${y} x${k}`, (r) => { r.camera = { x, y, scale: { x: k, y: Math.abs(k) } }; }, true)),
  fc.constant(cmd('undo', (r) => edit(r, (s) => { s.undo(); }))),
  fc.constant(cmd('redo', (r) => edit(r, (s) => { s.redo(); }))),
  fc.tuple(fc.integer({ min: -60, max: 420 }), fc.integer({ min: -60, max: 420 }), scale).map(([x, y, k]) => cmd(
    `point ${x + 0.5},${y + 0.5} x${k}`,
    (r) => {
      const q = pointPick(d, x + 0.5, y + 0.5, { x: k, y: Math.abs(k) });
      same(r, q, 'point');
      same(r, { ...q, includeLocked: true }, 'point, locked too');
    },
  )),
  fc.tuple(id, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), scale).map(([n, fx, fy, k]) => cmd(
    `point in ${n} at ${fx},${fy} x${k}`,
    (r) => {
      const node = r.scene.get(n);
      if (!node) return;
      const p = r.scene.overrides.read(n)?.pose ?? node.pose;
      same(r, pointPick(d, p.x + fx * p.width, p.y + fy * p.height, { x: k, y: Math.abs(k) }), 'point in a node');
    },
  )),
  fc.tuple(pose, fc.constantFrom<LassoHitMode>('intersect', 'enclosed', 'centers'), fc.boolean()).map(([m, mode, groups]) => cmd(
    `marquee ${JSON.stringify(m)} ${mode}`,
    (r) => same(r, regionPick(rectRegion({ x: m.x, y: m.y, width: m.width, height: m.height }), mode, d, groups), `marquee ${mode}`),
  )),
];

describe('pickWalk over a run of edits, views, and picks', () => {
  it('the indexed walk answers every pick as the full walk does, and edits in place keep the render order', () => {
    const total = { picks: 0, hits: 0, indexed: 0 };
    fc.assert(fc.property(fc.boolean(), fc.commands([commands[0]!, commands[0]!, commands[0]!, ...commands, commands.at(-3)!, commands.at(-2)!, commands.at(-2)!, commands.at(-1)!], { maxCommands: 80, size: 'large' }), (rigid, cmds) => {
      // Rigid composition makes a member's pose local to its group's, so a turned or squashed group carries it.
      const scene = createScene<unknown, Layer, Pose>({
        systemLayers: LAYERS.map((l) => ({ id: l })),
        composition: (rigid ? RIGID_POSE_COMPOSITION : IDENTITY_POSE_COMPOSITION) as never,
      }) as S;
      // A few nodes to start, so the first picks have something to hit and the index something to narrow.
      IDS.slice(0, 6).forEach((n, i) => scene.add({
        id: asNodeId(n), kind: GROUPS.has(n) ? 'group' : 'mark', layer: LAYERS[i % 3]!, data: null,
        pose: { x: 60 * i, y: 40 * (i % 3), width: 50, height: 30 },
      } as never));
      const real: Real = { scene, camera: { x: 0, y: 0, scale: { x: 1, y: 1 } }, tally: { picks: 0, hits: 0, indexed: 0 } };
      fc.modelRun(() => ({ model: {}, real }), cmds);
      total.picks += real.tally.picks;
      total.hits += real.tally.hits;
      total.indexed += real.tally.indexed;
    }), runs(RUNS));
    expect(total.picks).toBeGreaterThan(200);
    expect(total.hits).toBeGreaterThan(40);
    expect(total.indexed).toBeGreaterThan(100);
  }, timeoutFor(RUNS, 40));
});
