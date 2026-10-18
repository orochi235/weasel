import { describe, expect, it } from 'vitest';
import type { AffordanceHit, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { overlaysOf } from '@weasel-js/routing';
import { PATH_C, PATH_M, PATH_Z, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { createScene, createSnapOutcomeStore, editAnchorsAction, type SnapDep } from '@weasel-js/core';
import {
  createSnapSession2dForTests as createSnapSession2d,
  makeEditAnchorsDepForTests as makeEditAnchorsDep,
} from '@weasel-js/core/test-seams';
import { createHandleSnapExtension, handleSnapSource, type HandleSnapOptions } from './handleSnap';

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

/** Anchor 0 at (0,0) with its out handle at (10,0); anchor 1 at (20,20). */
const curve = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 20, 10, 20, 20]),
  fillRule: 'nonzero',
});

function start(options: HandleSnapOptions | null) {
  const committed: { path: PolygonPath | null } = { path: null };
  const read = () => options;
  const dep = makeEditAnchorsDep({
    getEditablePath: () => curve(),
    applyEdit: (_id, p) => { committed.path = p as PolygonPath; },
    extensions: [createHandleSnapExtension(read)],
  });
  const store = createSnapOutcomeStore();
  const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
  const snap: SnapDep = {
    point: (p) => p,
    begin: (req) => createSnapSession2d({
      gesture: req.gesture, press: req.press, ids: req.ids ?? [],
      ...(req.pivot ? { pivot: req.pivot } : {}),
      ...(req.theta0 !== undefined ? { theta0: req.theta0 } : {}),
      ...(req.reachRad !== undefined ? { reachRad: req.reachRad } : {}),
      ...(req.also ? { also: req.also } : {}),
      scene: scene as never, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, sources: [handleSnapSource(read)], store,
    }),
  };
  const at = { x: 10, y: 0 };
  const affordance: AffordanceHit = { kind: 'controlOut:0', targetIds: ['node-a'] };
  const ctx: InvocationCtx = {
    world: at,
    screen: at,
    modifiers: NO_MODS,
    deps: { editAnchors: dep, snap } as unknown as InvocationCtx['deps'],
    drag: { start: at, current: at, delta: { x: 0, y: 0 }, affordance },
  };
  const handle: OngoingHandle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx);
  const move = (world: { x: number; y: number }, modifiers = NO_MODS) => handle.onMove!({ ...ctx, world, modifiers });
  const out = () => {
    handle.onEnd!(ctx, 'commit');
    return pathToAnchors(committed.path!).anchors[0]![0]!.outHandle!;
  };
  return { handle, move, out, marks: () => store.get() };
}

describe('handle snapping', () => {
  it('snaps the handle angle to a step and draws the line it snapped to', () => {
    const drag = start({ stepDeg: 45, reachDeg: 6 });
    drag.move({ x: 20, y: 19 });
    expect(drag.marks()).toEqual([expect.objectContaining({ kind: 'line' })]);
    expect(overlaysOf(drag.handle)).toEqual([]);
    const h = drag.out();
    expect(h.x).toBeCloseTo(h.y, 4);
    expect(drag.marks()).toEqual([]);
  });

  it('does not snap when its options are null', () => {
    const drag = start(null);
    drag.move({ x: 20, y: 19 });
    expect(drag.marks()).toEqual([]);
    expect(drag.out()).toEqual({ x: 20, y: 19 });
  });

  it('leaves a locked angle unsnapped', () => {
    const drag = start({ stepDeg: 45, reachDeg: 6 });
    drag.move({ x: 20, y: 19 }, { ...NO_MODS, shift: true });
    expect(overlaysOf(drag.handle)).toEqual([expect.objectContaining({ role: 'lock' })]);
    expect(drag.out()).toEqual({ x: 20, y: 0 });
  });

  it('holds its length with Ctrl and still snaps its angle', () => {
    const drag = start({ stepDeg: 45, reachDeg: 6 });
    drag.move({ x: 20, y: 19 }, { ...NO_MODS, ctrl: true });
    expect(drag.marks()).toEqual([expect.objectContaining({ kind: 'line' })]);
    const h = drag.out();
    expect(h.x).toBeCloseTo(10 / Math.SQRT2, 4);
    expect(h.y).toBeCloseTo(10 / Math.SQRT2, 4);
  });

  it('snaps no further than its reach', () => {
    // 42°: within 6° of 45°, not within 2°.
    const near = start({ stepDeg: 45, reachDeg: 6 });
    near.move({ x: 20, y: 18 });
    const h = near.out();
    expect(h.x).toBeCloseTo(h.y, 4);
    const far = start({ stepDeg: 45, reachDeg: 2 });
    far.move({ x: 20, y: 18 });
    expect(far.marks()).toEqual([]);
    expect(far.out()).toEqual({ x: 20, y: 18 });
  });
});
