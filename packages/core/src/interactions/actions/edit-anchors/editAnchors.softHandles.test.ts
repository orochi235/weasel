import { describe, expect, it, vi } from 'vitest';
import type { AffordanceHit, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { overlaysOf } from '@weasel-js/routing';
import { PATH_C, PATH_L, PATH_M, PATH_Z, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { EditAnchorsDep } from '../depSchema';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';
import { editAnchorsAction } from './action';
import type { EditAnchorsParams } from './params';

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

/** An open run of five anchors along +X, 10 apart. */
const line = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_L]),
  coords: new Float32Array([0, 0, 10, 0, 20, 0, 30, 0, 40, 0]),
  fillRule: 'nonzero',
});

/** Anchor 0 at (0,0) with its out handle at (10,0); anchor 1 at (20,20). */
const curve = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 20, 10, 20, 20]),
  fillRule: 'nonzero',
});

function start(path: PolygonPath, part: string, at: { x: number; y: number }, params?: EditAnchorsParams) {
  const committed: { path: PolygonPath | null } = { path: null };
  const dep: EditAnchorsDep = makeEditAnchorsDep({
    getStorageKind: () => 'pose',
    getNodeShape: () => null,
    getEditablePath: () => path,
    applyEdit: (_id, p) => { committed.path = p as PolygonPath; },
  });
  const affordance: AffordanceHit = { kind: part, targetIds: ['node-a'] };
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
  const move = (world: { x: number; y: number }, modifiers = NO_MODS) => handle.onMove!({ ...ctx, world, modifiers });
  const wheel = (deltaY: number) => handle.onWheel?.({ ...ctx, wheel: { deltaX: 0, deltaY, deltaZ: 0 } });
  const end = () => {
    handle.onEnd!(ctx, 'commit');
    return pathToAnchors(committed.path!).anchors[0]!;
  };
  return { handle, move, wheel, end };
}

describe('editAnchors soft selection', () => {
  it('moves neighbors along the path by the falloff of their distance', () => {
    const drag = start(line(), 'anchor:0', { x: 0, y: 0 }, { soft: { radiusPx: 20, falloff: 'linear' } });
    drag.move({ x: 0, y: 20 });
    const a = drag.end();
    expect(a.map((p) => p.y)).toEqual([20, 10, 0, 0, 0]);
  });

  it('draws the reach as a falloff band on the moved path', () => {
    const drag = start(line(), 'anchor:0', { x: 0, y: 0 }, { soft: { radiusPx: 20, falloff: 'linear' } });
    drag.move({ x: 0, y: 20 });
    const band = overlaysOf(drag.handle);
    expect(band).toHaveLength(1);
    const run = band[0]!;
    if (run.kind !== 'polyline') throw new Error('expected a polyline');
    expect(run.role).toBe('falloff');
    const { points } = run;
    expect(points[0]).toEqual({ x: 0, y: 20 });
    expect(points.at(-1)!.x).toBeCloseTo(20);
  });

  it('scrubs the radius with the wheel mid-drag, redoing the move and reporting it', () => {
    const onSoftRadius = vi.fn();
    const drag = start(line(), 'anchor:0', { x: 0, y: 0 }, { soft: { radiusPx: 20, falloff: 'linear' }, onSoftRadius });
    drag.move({ x: 0, y: 20 });
    expect(drag.wheel(-500)).toBe(true);
    const radius = onSoftRadius.mock.calls[0]![0] as number;
    expect(radius).toBeGreaterThan(20);
    const a = drag.end();
    // Anchor 2 is 20 along: it moves once the radius passes it.
    expect(a[2]!.y).toBeCloseTo(20 * (1 - 20 / radius));
  });

  it('leaves the wheel to the bindings with soft selection off', () => {
    const drag = start(line(), 'anchor:0', { x: 0, y: 0 });
    drag.move({ x: 0, y: 20 });
    expect(drag.wheel(-100)).toBe(false);
    expect(drag.end().map((p) => p.y)).toEqual([20, 0, 0, 0, 0]);
  });
});

describe('editAnchors handle snapping and locks', () => {
  const out = (a: ReturnType<ReturnType<typeof start>['end']>) => a[0]!.outHandle!;

  it('snaps the handle angle to a step and shows the snap', () => {
    const drag = start(curve(), 'controlOut:0', { x: 10, y: 0 }, { handleSnap: { stepDeg: 45, toleranceDeg: 6 } });
    drag.move({ x: 20, y: 19 });
    expect(overlaysOf(drag.handle)).toEqual([expect.objectContaining({ kind: 'polyline', role: 'snap' })]);
    const h = out(drag.end());
    expect(h.x).toBeCloseTo(h.y, 4);
  });

  it('does not snap without the param', () => {
    const drag = start(curve(), 'controlOut:0', { x: 10, y: 0 });
    drag.move({ x: 20, y: 19 });
    expect(overlaysOf(drag.handle)).toEqual([]);
    expect(out(drag.end())).toEqual({ x: 20, y: 19 });
  });

  it('holds the length while Mod is down, and shows the circle it keeps to', () => {
    const drag = start(curve(), 'controlOut:0', { x: 10, y: 0 });
    drag.move({ x: 0, y: 50 }, { ...NO_MODS, meta: true });
    expect(overlaysOf(drag.handle)).toEqual([expect.objectContaining({ role: 'lock' })]);
    const h = out(drag.end());
    expect(h.x).toBeCloseTo(0, 4);
    expect(h.y).toBeCloseTo(10, 4);
  });

  it('holds a lock the params force, without a modifier', () => {
    const drag = start(curve(), 'controlOut:0', { x: 10, y: 0 }, { handleLock: 'angle' });
    drag.move({ x: 30, y: 12 });
    const h = out(drag.end());
    expect(h.x).toBeCloseTo(30, 4);
    expect(h.y).toBeCloseTo(0, 4);
  });
});
