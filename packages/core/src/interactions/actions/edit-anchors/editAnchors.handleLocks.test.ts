import { describe, expect, it } from 'vitest';
import type { AffordanceHit, InvocationCtx, OngoingHandle, OngoingOverlay } from '@weasel-js/routing';
import { overlaysOf } from '@weasel-js/routing';
import { PATH_C, PATH_M, PATH_Z, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { EditAnchorsDep } from '../depSchema';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';
import { editAnchorsAction } from './action';
import type { EditAnchorsParams, HandleLocks } from './params';

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

function pointsOf(guide: OngoingOverlay | null | undefined) {
  if (guide?.kind !== 'polyline') throw new Error('expected a polyline guide');
  return guide.points;
}

/** Anchor 0 at (0,0) with its out handle at (10,0); anchor 1 at (20,20). */
const curve = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 20, 10, 20, 20]),
  fillRule: 'nonzero',
});

function start(params?: EditAnchorsParams, handleLocks?: HandleLocks) {
  const committed: { path: PolygonPath | null } = { path: null };
  const dep: EditAnchorsDep = makeEditAnchorsDep({
    getStorageKind: () => 'pose',
    getNodeShape: () => null,
    getEditablePath: () => curve(),
    applyEdit: (_id, p) => { committed.path = p as PolygonPath; },
    ...(handleLocks ? { handleLocks } : {}),
  });
  const at = { x: 10, y: 0 };
  const affordance: AffordanceHit = { kind: 'controlOut:0', targetIds: ['node-a'] };
  const ctx: InvocationCtx = {
    world: at,
    screen: at,
    modifiers: NO_MODS,
    deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
    drag: { start: at, current: at, delta: { x: 0, y: 0 }, affordance },
  };
  const invoker = editAnchorsAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle: OngoingHandle = invoker.start(ctx, params ? { params } : undefined);
  const move = (world: { x: number; y: number }, modifiers = NO_MODS, roles?: Record<string, boolean>) =>
    handle.onMove!({ ...ctx, world, modifiers, ...(roles ? { roles } : {}) });
  const out = () => {
    handle.onEnd!(ctx, 'commit');
    return committed.path ? pathToAnchors(committed.path).anchors[0]![0]!.outHandle! : { x: 10, y: 0 };
  };
  return { handle, move, out };
}

describe('editAnchors handle locks', () => {
  it('holds the length while Mod is down, and draws the circle it keeps to', () => {
    const drag = start();
    drag.move({ x: 0, y: 50 }, { ...NO_MODS, meta: true });
    const guide = overlaysOf(drag.handle)[0];
    expect(guide).toMatchObject({ kind: 'polyline', role: 'lock' });
    // A circle of radius 10 round the anchor.
    for (const p of pointsOf(guide)) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 4);
    }
    const h = drag.out();
    expect(h.x).toBeCloseTo(0, 4);
    expect(h.y).toBeCloseTo(10, 4);
  });

  it('takes Ctrl as Mod too', () => {
    const drag = start();
    drag.move({ x: 0, y: -40 }, { ...NO_MODS, ctrl: true });
    const h = drag.out();
    expect(h.x).toBeCloseTo(0, 4);
    expect(h.y).toBeCloseTo(-10, 4);
  });

  it('holds the angle while Shift is down, and draws the line it keeps to', () => {
    const drag = start();
    drag.move({ x: 30, y: 12 }, { ...NO_MODS, shift: true });
    const guide = overlaysOf(drag.handle)[0];
    expect(guide).toMatchObject({ kind: 'polyline', role: 'lock' });
    expect(pointsOf(guide).every((p) => Math.abs(p.y) < 1e-9)).toBe(true);
    expect(drag.out()).toEqual({ x: 30, y: 0 });
  });

  it('freezes the handle with both modifiers down', () => {
    const drag = start();
    drag.move({ x: -25, y: 40 }, { ...NO_MODS, shift: true, meta: true });
    expect(overlaysOf(drag.handle)[0]).toMatchObject({ role: 'lock' });
    expect(drag.out()).toEqual({ x: 10, y: 0 });
  });

  it('draws nothing with no lock held', () => {
    const drag = start();
    drag.move({ x: 20, y: 19 });
    expect(overlaysOf(drag.handle)).toEqual([]);
    expect(drag.out()).toEqual({ x: 20, y: 19 });
  });

  it('holds the lock the handleLock param names, without a modifier', () => {
    const drag = start({ handleLock: 'angle' });
    drag.move({ x: 30, y: 12 });
    expect(drag.out()).toEqual({ x: 30, y: 0 });
  });

  it('holds the locks the editAnchors dep holds, over the param', () => {
    const drag = start({ handleLock: 'angle' }, { angle: false, length: true });
    drag.move({ x: 0, y: 50 });
    const h = drag.out();
    expect(h.x).toBeCloseTo(0, 4);
    expect(h.y).toBeCloseTo(10, 4);
  });

  it('declares its locks as modifier roles a tuning can rebind', () => {
    expect(Object.keys(editAnchorsAction.modifierRoles ?? {})).toEqual(
      expect.arrayContaining(['handle.holdAngle', 'handle.holdLength', 'mirror.break', 'selection.add']),
    );
  });

  it('reads the roles the dispatcher resolved over the raw modifiers', () => {
    // Length moved to Alt: Cmd no longer holds it, Alt does.
    const roles = (length: boolean) => ({ 'handle.holdAngle': false, 'handle.holdLength': length, 'mirror.break': false, 'selection.add': false });
    const free = start();
    free.move({ x: 0, y: 50 }, { ...NO_MODS, meta: true }, roles(false));
    expect(free.out()).toEqual({ x: 0, y: 50 });
    const held = start();
    held.move({ x: 0, y: 50 }, { ...NO_MODS, alt: true }, roles(true));
    const h = held.out();
    expect(h.x).toBeCloseTo(0, 4);
    expect(h.y).toBeCloseTo(10, 4);
  });
});
