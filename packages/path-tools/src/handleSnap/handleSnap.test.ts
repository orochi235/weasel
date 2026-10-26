import { describe, expect, it } from 'vitest';
import type { AffordanceHit, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { overlaysOf } from '@weasel-js/routing';
import { anchorsToPath, PATH_C, PATH_M, PATH_Z, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { IDENTITY_POSE_COMPOSITION, createScene, createSnapOutcomeStore, editAnchorsAction, type SnapDep } from '@weasel-js/core';
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

type Point = { x: number; y: number };
const DEG = Math.PI / 180;
const polar = (deg: number, len = 10): Point => ({ x: len * Math.cos(deg * DEG), y: len * Math.sin(deg * DEG) });
const angleOf = (h: Point) => Math.atan2(h.y, h.x) / DEG;

/** Anchor 0 at (0,0) with both handles, closed through anchor 1 at (20,20). */
const corner = (outHandle: Point, inHandle: Point): PolygonPath =>
  anchorsToPath([[{ x: 0, y: 0, outHandle, inHandle }, { x: 20, y: 20 }]], [true]);

/** A drag of anchor 0's out handle, at `press`, on `path`. */
function start(options: HandleSnapOptions | null, path: PolygonPath = curve(), press: Point = { x: 10, y: 0 }) {
  const committed: { path: PolygonPath | null } = { path: null };
  const read = () => options;
  const dep = makeEditAnchorsDep({
    getEditablePath: () => path,
    applyEdit: (_id, p) => { committed.path = p as PolygonPath; },
    extensions: [createHandleSnapExtension(read)],
  });
  const store = createSnapOutcomeStore();
  const scene = createScene<object, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  const snap: SnapDep = {
    begin: (req) => createSnapSession2d({
      gesture: req.gesture, press: req.press, ids: req.ids ?? [],
      ...(req.pivot ? { pivot: req.pivot } : {}),
      ...(req.theta0 !== undefined ? { theta0: req.theta0 } : {}),
      ...(req.reachRad !== undefined ? { reachRad: req.reachRad } : {}),
      ...(req.also ? { also: req.also } : {}),
      scene: scene as never, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, sources: [handleSnapSource(read)], store,
    }),
  };
  const at = press;
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

  describe("onto the line through the anchor's other handle", () => {

    it('snaps onto it, keeping the length, ahead of a step that is also in reach', () => {
      // The other handle points at 185°, so the line through it runs at 5°.
      const drag = start({ stepDeg: 45 }, corner(polar(30), polar(185)), polar(30));
      drag.move(polar(3.1));
      expect(drag.marks()).toEqual([{ kind: 'line', from: expect.anything(), to: expect.anything() }]);
      expect((drag.marks()[0] as { from: Point }).from).toEqual({ x: expect.closeTo(polar(185).x, 5), y: expect.closeTo(polar(185).y, 5) });
      const h = drag.out();
      expect(angleOf(h)).toBeCloseTo(5, 4);
      expect(Math.hypot(h.x, h.y)).toBeCloseTo(10, 4);
    });

    it('wins a tie with a step', () => {
      // The line runs at atan(6/8), about 36.87°; the pointer sits halfway
      // between it and 45°.
      const other = { x: -8, y: -6 };
      const line = Math.atan2(6, 8) / DEG;
      const drag = start({ stepDeg: 45 }, corner(polar(30), other), polar(30));
      drag.move(polar((line + 45) / 2));
      expect(drag.marks()).toEqual([{ kind: 'line', from: other, to: expect.anything() }]);
      expect(angleOf(drag.out())).toBeCloseTo(line, 4);
    });

    it('wraps round the half turn', () => {
      // The line runs at 178°; the pointer is at -178°, 4° from it the short way round.
      const drag = start({ stepDeg: 50 }, corner(polar(90), polar(-2)), polar(90));
      drag.move(polar(-178));
      expect(angleOf(drag.out())).toBeCloseTo(178, 4);
    });
  });

  it('wraps a step round the half turn', () => {
    const drag = start({ stepDeg: 90, opposite: false }, corner(polar(90), polar(-2)), polar(90));
    drag.move(polar(-177));
    expect(Math.abs(angleOf(drag.out()))).toBeCloseTo(180, 4);
  });
});
