import { describe, expect, it } from 'vitest';
import type { AffordanceHit, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { overlaysOf } from '@weasel-js/routing';
import { PATH_C, PATH_M, PATH_Z, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { editAnchorsAction } from '@weasel-js/core';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { createHandleSnapExtension, type HandleSnapOptions } from './handleSnap';

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
  const dep = makeEditAnchorsDep({
    getEditablePath: () => curve(),
    applyEdit: (_id, p) => { committed.path = p as PolygonPath; },
    extensions: [createHandleSnapExtension(() => options)],
  });
  const at = { x: 10, y: 0 };
  const affordance: AffordanceHit = { kind: 'controlOut:0', targetIds: ['node-a'] };
  const ctx: InvocationCtx = {
    world: at,
    screen: at,
    modifiers: NO_MODS,
    deps: { editAnchors: dep } as unknown as InvocationCtx['deps'],
    drag: { start: at, current: at, delta: { x: 0, y: 0 }, affordance },
  };
  const handle: OngoingHandle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx);
  const move = (world: { x: number; y: number }, modifiers = NO_MODS) => handle.onMove!({ ...ctx, world, modifiers });
  const out = () => {
    handle.onEnd!(ctx, 'commit');
    return pathToAnchors(committed.path!).anchors[0]![0]!.outHandle!;
  };
  return { handle, move, out };
}

describe('handle snapping', () => {
  it('snaps the handle angle to a step and shows the snap', () => {
    const drag = start({ stepDeg: 45, toleranceDeg: 6 });
    drag.move({ x: 20, y: 19 });
    expect(overlaysOf(drag.handle)).toEqual([expect.objectContaining({ kind: 'polyline', role: 'snap' })]);
    const h = drag.out();
    expect(h.x).toBeCloseTo(h.y, 4);
  });

  it('does not snap when its options are null', () => {
    const drag = start(null);
    drag.move({ x: 20, y: 19 });
    expect(overlaysOf(drag.handle)).toEqual([]);
    expect(drag.out()).toEqual({ x: 20, y: 19 });
  });

  it('leaves a locked angle unsnapped', () => {
    const drag = start({ stepDeg: 45, toleranceDeg: 6 });
    drag.move({ x: 20, y: 19 }, { ...NO_MODS, shift: true });
    expect(overlaysOf(drag.handle)).toEqual([expect.objectContaining({ role: 'lock' })]);
    expect(drag.out()).toEqual({ x: 20, y: 0 });
  });
});
