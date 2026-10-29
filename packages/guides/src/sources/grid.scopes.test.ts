import { describe, expect, it } from 'vitest';
import {
  createScene, insertAction, RIGID_POSE_COMPOSITION,
  type Bounds, type InsertDep, type InvocationCtx, type NodeId, type OngoingInvoker, type Scene, type SnapDep, type UnitScope,
} from '@weasel-js/core';
import { createSnapSession2dForTests } from '@weasel-js/core/test-seams';
import { applyToPoint, invert, rotateAboutPoint, type Affine } from '@weasel-js/geom';
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
    // The box's right edge, at 6.1, is the nearest a line.
    expectNear(moveBy({ sources: [grid], scene, ids: [outside] }).by(6, 0.5).point, { x: 9.9, y: 0 });
  });

  it('takes a pitch per scope, written in its units', () => {
    const { scene, inside, outside } = assembly();
    const grid = gridSnapSource({
      spacing: { value: 1, unit: 'ft' },
      scopes: { root: INCHES, spacing: (scope) => (scope.system.base === 'mm' ? { value: 1, unit: 'cm' } : 1) },
    });
    // 1cm is 10 / 25.4 in.
    expectNear(moveBy({ sources: [grid], scene, ids: [inside] }).by(0.5, 0.5).point, { x: 10 / 25.4, y: 10 / 25.4 });
    expectNear(moveBy({ sources: [grid], scene, ids: [outside] }).by(7, 0).point, { x: 11.9, y: 0 });
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

const UNIT: UnitScope = { system: { base: 'u', units: { u: 1 } } };
/** Ten of its units are five of the root's. */
const HALF: UnitScope = { system: { base: 'h', units: { h: 1 } }, scale: 0.5 };
const TURN = Math.PI / 6;

/** A container with a half-scale scope at `pose`, its children stored in its
 *  frame, holding one child filling it. */
function framed(pose: Bounds & { rotation?: number }) {
  const scene = createScene<object, 'default', Bounds>({
    systemLayers: [{ id: 'default', visible: true, locked: false }], composition: RIGID_POSE_COMPOSITION,
  });
  const g = scene.add({ kind: 'group', layer: 'default', pose, data: {}, units: HALF }) as string;
  const inside = scene.add({
    kind: 'mark', layer: 'default', parent: g as NodeId, pose: { x: 0, y: 0, width: pose.width, height: pose.height }, data: {},
  }) as string;
  return { scene: scene as unknown as Scene<unknown, string, unknown>, g, inside };
}

const through = (m: Affine, p: { x: number; y: number }) => {
  const [x, y] = applyToPoint(m, p.x, p.y);
  return { x, y };
};

describe('gridSnapSource — a container\'s own frame', () => {
  const grid = gridSnapSource({ spacing: 10, scopes: { root: UNIT } });

  it('rounds a point drawn into a turned container on its turned lattice', () => {
    const { scene, g } = framed({ x: 0, y: 0, width: 100, height: 100, rotation: TURN });
    // The container's corner turned about its center: its frame.
    const frame = rotateAboutPoint(50, 50, TURN);
    const near = through(frame, { x: 16.2, y: 23.9 });
    expectNear(drive({ sources: [grid], scene, parent: g }).at(near).point, through(frame, { x: 15, y: 25 }));
  });

  it('lands a node moved inside a turned container on its turned lattice', () => {
    const { scene, inside } = framed({ x: 0, y: 0, width: 100, height: 100, rotation: TURN });
    const back = invert(rotateAboutPoint(50, 50, TURN))!;
    // The child's origin starts at world (0, 0), as its box does before the turn.
    const landed = through(back, moveBy({ sources: [grid], scene, ids: [inside] }).by(7, 3).point);
    for (const v of [landed.x, landed.y]) expect(Math.abs(v / 5 - Math.round(v / 5))).toBeLessThan(1e-9);
  });

  it('runs a container\'s lattice from its corner', () => {
    const { scene, g } = framed({ x: 3, y: 3, width: 40, height: 40 });
    expectNear(drive({ sources: [grid], scene, parent: g }).at({ x: 4, y: 4.2 }).point, { x: 3, y: 3 });
  });

  it('keeps the world lattice for a subject spread over two containers', () => {
    const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
    const ids = [3, 1].map((at) => {
      const g = scene.add({ kind: 'group', layer: 'default', pose: { x: at, y: at, width: 20, height: 20 }, data: {}, units: HALF });
      return scene.add({ kind: 'mark', layer: 'default', parent: g, pose: { x: 10 - at, y: 10 - at, width: 1, height: 1 }, data: {} }) as string;
    });
    const s = scene as unknown as Scene<unknown, string, unknown>;
    // On the containers' 5-unit lattice, the union box's left edge at 11.8
    // rounds to 10 and its bottom at 9.1 to 10.
    expectNear(moveBy({ sources: [grid], scene: s, ids }).by(1.8, -1.9).point, { x: 0, y: -1 });
  });
});
