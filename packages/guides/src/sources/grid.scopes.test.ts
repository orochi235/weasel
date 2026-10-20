import { describe, it } from 'vitest';
import { createScene, type Bounds, type Scene, type UnitScope } from '@weasel-js/core';
import { gridSnapSource } from './grid';
import { drive, expectNear, moveBy } from './testing/session';

const INCHES: UnitScope = { system: { base: 'in', units: { in: 1, ft: 12 } } };
const MM: UnitScope = { system: { base: 'mm', units: { mm: 1, cm: 10 } }, scale: 1 / 25.4 };

/** A millimeter sub-assembly holding `inside`, and `outside` at the root. */
function assembly() {
  const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  const box = { x: 0, y: 0, width: 0.1, height: 0.1 };
  const g = scene.add({ kind: 'container', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {}, units: MM });
  const inside = scene.add({ kind: 'leaf', layer: 'default', parent: g, pose: { ...box }, data: {} }) as string;
  const outside = scene.add({ kind: 'leaf', layer: 'default', pose: { ...box }, data: {} }) as string;
  return { scene: scene as unknown as Scene<unknown, string, unknown>, inside, outside };
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

  it('resolves the root pitch in the root scope, for a gesture with no subject', () => {
    const { scene } = assembly();
    const grid = gridSnapSource({ spacing: { value: 1, unit: 'ft' }, scopes: { root: INCHES } });
    expectNear(drive({ sources: [grid], scene }).at({ x: 7, y: 17 }).point, { x: 12, y: 12 });
  });
});
