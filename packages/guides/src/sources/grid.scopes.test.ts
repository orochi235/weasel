import { describe, it } from 'vitest';
import {
  createScene, insertAction,
  type Bounds, type InsertDep, type InvocationCtx, type NodeId, type OngoingInvoker, type Scene, type SnapDep, type UnitScope,
} from '@weasel-js/core';
import { createSnapSession2dForTests } from '@weasel-js/core/test-seams';
import { gridSnapSource } from './grid';
import { drive, expectNear, moveBy } from './testing/session';

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };

const INCHES: UnitScope = { system: { base: 'in', units: { in: 1, ft: 12 } } };
const MM: UnitScope = { system: { base: 'mm', units: { mm: 1, cm: 10 } }, scale: 1 / 25.4 };

/** A millimeter sub-assembly holding `inside`, and `outside` at the root. */
function assembly() {
  const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  const box = { x: 0, y: 0, width: 0.1, height: 0.1 };
  const g = scene.add({ kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {}, units: MM });
  const inside = scene.add({ kind: 'mark', layer: 'default', parent: g, pose: { ...box }, data: {} }) as string;
  const outside = scene.add({ kind: 'mark', layer: 'default', pose: { ...box }, data: {} }) as string;
  return { scene: scene as unknown as Scene<unknown, string, unknown>, g: g as string, inside, outside };
}

describe('gridSnapSource — unit scopes', () => {
  it('snaps a node inside a millimeter sub-assembly on millimeter spacing', () => {
    const { scene, inside } = assembly();
    const grid = gridSnapSource({ spacing: 10, scopes: { root: INCHES } });
    // 10mm is 10 / 25.4 in, so a 0.5in drag lands on 0.3937in.
    expectNear(moveBy({ sources: [grid], scene, ids: [inside] }).by(0.5, 0.5).point, { x: 10 / 25.4, y: 10 / 25.4 });
  });

  it('snaps a node outside it on the root spacing', () => {
    const { scene, outside } = assembly();
    const grid = gridSnapSource({ spacing: 10, scopes: { root: INCHES } });
    expectNear(moveBy({ sources: [grid], scene, ids: [outside] }).by(6, 0.5).point, { x: 10, y: 0 });
  });

  it('takes a pitch per scope, written in its units', () => {
    const { scene, inside, outside } = assembly();
    const grid = gridSnapSource({
      spacing: { value: 1, unit: 'ft' },
      scopes: { root: INCHES, spacing: (scope) => (scope.system.base === 'mm' ? { value: 1, unit: 'cm' } : 1) },
    });
    // 1cm is 10 / 25.4 in.
    expectNear(moveBy({ sources: [grid], scene, ids: [inside] }).by(0.5, 0.5).point, { x: 10 / 25.4, y: 10 / 25.4 });
    expectNear(moveBy({ sources: [grid], scene, ids: [outside] }).by(7, 0).point, { x: 12, y: 0 });
  });

  it('snaps a rect drawn into a millimeter sub-assembly on millimeter spacing', () => {
    const { scene, g } = assembly();
    const grid = gridSnapSource({ spacing: 10, scopes: { root: INCHES } });
    const committed: Bounds[] = [];
    const insert: InsertDep = { commit: (b) => { committed.push({ ...b }); return 'n' as NodeId; } };
    const snap: SnapDep = {
      begin: ({ gesture, press, origin, constrain, parent }) => createSnapSession2dForTests({
        scene, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, sources: [grid], gesture, press,
        ...(origin ? { origin } : {}), ...(constrain ? { constrain } : {}), ...(parent ? { parent } : {}),
      }),
    };
    const deps = { scene, insert, insertLive: { gesture: null }, insertInto: { get: () => g }, snap };
    const at = (p: { x: number; y: number }) => ({ world: p, screen: p, modifiers: KEYS, deps }) as unknown as InvocationCtx;
    const h = (insertAction.invoker as OngoingInvoker).start(at({ x: 0.1, y: 0.1 }), { params: { kind: 'rect' } });
    h.onMove!(at({ x: 0.5, y: 0.5 }));
    h.onEnd!(at({ x: 0.5, y: 0.5 }), 'commit');
    // 10mm is 10 / 25.4 in: the press lands on 0, the drag on 0.3937in.
    const b = committed[0]!;
    expectNear(b, { x: 0, y: 0 });
    expectNear({ x: b.width, y: b.height }, { x: 10 / 25.4, y: 10 / 25.4 });
  });

  it('snaps a point gesture on the scope of the container it is told', () => {
    const { scene, g } = assembly();
    const grid = gridSnapSource({ spacing: 10, scopes: { root: INCHES } });
    expectNear(drive({ sources: [grid], scene, parent: g }).at({ x: 0.5, y: 0.5 }).point, { x: 10 / 25.4, y: 10 / 25.4 });
  });

  it('resolves the root pitch in the root scope, for a gesture with no subject', () => {
    const { scene } = assembly();
    const grid = gridSnapSource({ spacing: { value: 1, unit: 'ft' }, scopes: { root: INCHES } });
    expectNear(drive({ sources: [grid], scene }).at({ x: 7, y: 17 }).point, { x: 12, y: 12 });
  });
});
