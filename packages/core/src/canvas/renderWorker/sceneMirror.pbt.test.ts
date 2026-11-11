/**
 * Stateful property test of the render worker's scene copy: a page scene taken through long runs of adds,
 * removes, poses, data, flags, reorders, reparenting, layer moves, overrides, and undo and redo, synced to the
 * worker's mirror after a random share of them. After every sync the copy saves as the page does, walks the
 * same render order, numbers each node as the page does, and picks what the page picks.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { AUTO_POSE_DESCRIPTOR as d } from 'core/geometry/autoPoseDescriptor';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import { pickWalk, scenePickSource } from '../pickWalk';
import { pointPick } from '../pickIndex/pickIndexFixture';
import { scenePickIds } from '../scenePickIds';
import { runs, timeoutFor } from '../pbt.fixture';
import { createSceneDiff, type SceneDiff } from './sceneDiff';
import { createSceneMirror, wireOverrides, type SceneMirror } from './sceneMirror';

const RUNS = 150;
type AnyScene = Scene<unknown, string, unknown>;
const LAYERS = ['main', 'top', '__proto__'] as const;
const IDS = ['a', 'b', 'c', 'g', 'h', '__proto__', 'toString', 'constructor'];
const GROUPS = new Set(['g', 'h', 'constructor']);

interface Real { page: AnyScene; diff: SceneDiff; mirror: SceneMirror; syncs: number }

const n = fc.integer({ min: -20, max: 200 });
const pose: fc.Arbitrary<RectPose> = fc.record({ x: n, y: n, width: fc.integer({ min: 0, max: 80 }), height: fc.integer({ min: 0, max: 80 }) });
const id = fc.constantFrom(...IDS).map(asNodeId);
const layer = fc.constantFrom(...LAYERS);
const data = fc.constantFrom<unknown>(null, {}, { fill: '#f00' }, { shape: 'ellipse', fill: { paint: { kind: 'solid', color: '#000' } } }, [1, 2]);

const tryEdit = (r: Real, fn: (s: AnyScene) => void): void => {
  try {
    r.page.unlocked(() => fn(r.page));
  } catch {
    // An edit the scene refuses leaves it as it was, which the next sync carries all the same.
  }
};

function sync(r: Real): void {
  const delta = r.diff.next(r.page);
  if (delta) r.mirror.apply(structuredClone(delta));
  r.mirror.setOverrides(structuredClone(wireOverrides(r.page)));
  r.syncs++;
  const copy = r.mirror.scene!;
  expect(copy.toJSON()).toEqual(r.page.toJSON());
  expect(copy.renderOrderNodes().map((x) => x.id)).toEqual(r.page.renderOrderNodes().map((x) => x.id));
  const pageIds = scenePickIds(r.page), copyIds = scenePickIds(copy);
  for (const x of r.page.renderOrderNodes()) expect(copyIds.idOf(x.id), x.id).toBe(pageIds.idOf(x.id));
  for (const [px, py] of [[5.5, 5.5], [40.5, 20.5], [100.5, 60.5]] as const) {
    const q = pointPick(d, px, py, { x: 1, y: 1 });
    expect(pickWalk(scenePickSource(copy as never, { index: { descriptor: d } }), q))
      .toEqual(pickWalk(scenePickSource(r.page as never), q));
  }
}

const step = (label: string, run: (r: Real) => void): fc.Command<object, Real> => ({
  check: () => true,
  run: (_m, r) => run(r),
  toString: () => label,
});

const commands = [
  fc.tuple(id, layer, pose, data, fc.option(id, { nil: undefined })).map(([k, l, p, dt, parent]) => step(
    `add ${k} on ${l} under ${String(parent)}`,
    (r) => tryEdit(r, (s) => {
      if (s.get(k)) return;
      s.add({ id: k, kind: GROUPS.has(k) ? 'group' : 'mark', layer: l, pose: p, data: dt,
        ...(parent && s.get(parent)?.kind === 'group' ? { parent } : {}) } as never);
    }),
  )),
  id.map((k) => step(`remove ${k}`, (r) => tryEdit(r, (s) => s.remove(k)))),
  fc.tuple(id, pose).map(([k, p]) => step(`setPose ${k} ${JSON.stringify(p)}`, (r) => tryEdit(r, (s) => s.setPose(k, p)))),
  fc.tuple(id, data).map(([k, dt]) => step(`update ${k} ${JSON.stringify(dt)}`, (r) => tryEdit(r, (s) => s.update(k, { data: dt })))),
  fc.tuple(id, fc.boolean()).map(([k, h]) => step(`setHidden ${k} ${h}`, (r) => tryEdit(r, (s) => s.setHidden(k, h)))),
  fc.tuple(id, fc.boolean()).map(([k, h]) => step(`setLocked ${k} ${h}`, (r) => tryEdit(r, (s) => s.setLocked(k, h)))),
  fc.tuple(id, fc.nat({ max: 8 })).map(([k, i]) => step(`reorder ${k} ${i}`, (r) => tryEdit(r, (s) => s.reorder(k, i)))),
  fc.tuple(id, fc.option(id, { nil: null })).map(([k, p]) => step(`move ${k} under ${String(p)}`, (r) => tryEdit(r, (s) => s.move(k, p)))),
  fc.tuple(id, layer).map(([k, l]) => step(`setLayer ${k} ${l}`, (r) => tryEdit(r, (s) => s.setLayer(k, l)))),
  fc.tuple(layer, fc.nat({ max: 2 })).map(([l, i]) => step(`moveLayer ${l} ${i}`, (r) => tryEdit(r, (s) => s.moveLayer(l, i)))),
  fc.tuple(layer, fc.boolean()).map(([l, v]) => step(`setLayerVisible ${l} ${v}`, (r) => tryEdit(r, (s) => s.setLayerVisible(l, v)))),
  fc.tuple(id, fc.option(pose, { nil: undefined }), fc.constantFrom(undefined, 0, 0.5)).map(([k, p, alpha]) => step(
    `override ${k} ${JSON.stringify(p)} ${alpha}`,
    (r) => {
      if (!r.page.get(k)) return;
      r.page.overrides.set(k, { ...(p ? { pose: p } : {}), ...(alpha !== undefined ? { alpha } : {}) });
      r.page.overrides.commit();
    },
  )),
  fc.constant(step('clear overrides', (r) => { r.page.overrides.clearAll(); r.page.overrides.commit(); })),
  fc.constant(step('undo', (r) => tryEdit(r, (s) => { s.undo(); }))),
  fc.constant(step('redo', (r) => tryEdit(r, (s) => { s.redo(); }))),
  fc.constant(step('forget', (r) => r.diff.forget())),
  fc.constant(step('sync', sync)),
];

describe('the render worker scene copy over a run of edits', () => {
  it('matches the page after every sync', () => {
    let syncs = 0;
    fc.assert(fc.property(fc.commands([...commands, commands.at(-1)!, commands.at(-1)!, commands[0]!], { maxCommands: 60, size: 'large' }), (cmds) => {
      const page = createScene<unknown, string, RectPose>({ systemLayers: LAYERS.map((l) => ({ id: l })) }) as unknown as AnyScene;
      const real: Real = { page, diff: createSceneDiff(), mirror: createSceneMirror(), syncs: 0 };
      sync(real);
      fc.modelRun(() => ({ model: {}, real }), cmds);
      sync(real);
      syncs += real.syncs;
    }), runs(RUNS));
    expect(syncs).toBeGreaterThan(600);
  }, timeoutFor(RUNS, 60));
});
