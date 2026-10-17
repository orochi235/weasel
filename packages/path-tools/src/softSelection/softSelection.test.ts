import { describe, expect, it, vi } from 'vitest';
import type { AffordanceHit, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { overlaysOf } from '@weasel-js/routing';
import { PATH_L, PATH_M, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { editAnchorsAction } from '@weasel-js/core';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { createSoftSelectionExtension, type SoftSelectionOptions } from './softSelection';

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

/** An open run of five anchors along +X, 10 apart. */
const line = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_L]),
  coords: new Float32Array([0, 0, 10, 0, 20, 0, 30, 0, 40, 0]),
  fillRule: 'nonzero',
});

function start(options: SoftSelectionOptions | null) {
  const committed: { path: PolygonPath | null } = { path: null };
  const dep = makeEditAnchorsDep({
    getEditablePath: () => line(),
    applyEdit: (_id, p) => { committed.path = p as PolygonPath; },
    extensions: [createSoftSelectionExtension(() => options)],
  });
  const at = { x: 0, y: 0 };
  const affordance: AffordanceHit = { kind: 'anchor:0', targetIds: ['node-a'] };
  const ctx: InvocationCtx = {
    world: at,
    screen: at,
    modifiers: NO_MODS,
    deps: { editAnchors: dep } as unknown as InvocationCtx['deps'],
    drag: { start: at, current: at, delta: { x: 0, y: 0 }, affordance },
  };
  const handle: OngoingHandle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx);
  const move = (world: { x: number; y: number }) => handle.onMove!({ ...ctx, world });
  const wheel = (deltaY: number) => handle.onWheel?.({ ...ctx, wheel: { deltaX: 0, deltaY, deltaZ: 0 } });
  const end = () => {
    handle.onEnd!(ctx, 'commit');
    return pathToAnchors(committed.path!).anchors[0]!;
  };
  return { handle, move, wheel, end };
}

describe('soft selection', () => {
  it('moves neighbors along the path by the falloff of their distance', () => {
    const drag = start({ radiusPx: 20, falloff: 'linear' });
    drag.move({ x: 0, y: 20 });
    expect(drag.end().map((p) => p.y)).toEqual([20, 10, 0, 0, 0]);
  });

  it('draws the reach as a falloff band on the moved path', () => {
    const drag = start({ radiusPx: 20, falloff: 'linear' });
    drag.move({ x: 0, y: 20 });
    const band = overlaysOf(drag.handle);
    expect(band).toHaveLength(1);
    const run = band[0]!;
    if (run.kind !== 'polyline') throw new Error('expected a polyline');
    expect(run.role).toBe('falloff');
    expect(run.points[0]).toEqual({ x: 0, y: 20 });
    expect(run.points.at(-1)!.x).toBeCloseTo(20);
  });

  it('scrubs the radius with the wheel mid-drag, redoing the move and reporting it', () => {
    const onRadius = vi.fn();
    const drag = start({ radiusPx: 20, falloff: 'linear', onRadius });
    drag.move({ x: 0, y: 20 });
    expect(drag.wheel(-500)).toBe(true);
    const radius = onRadius.mock.calls[0]![0] as number;
    expect(radius).toBeGreaterThan(20);
    const a = drag.end();
    // Anchor 2 is 20 along: it moves once the radius passes it.
    expect(a[2]!.y).toBeCloseTo(20 * (1 - 20 / radius));
  });

  it('leaves the drag hard and the wheel to the bindings when its options are null', () => {
    const drag = start(null);
    drag.move({ x: 0, y: 20 });
    expect(drag.wheel(-100)).toBe(false);
    expect(drag.end().map((p) => p.y)).toEqual([20, 0, 0, 0, 0]);
  });
});
