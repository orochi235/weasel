import { describe, expect, it } from 'vitest';
import type { DropTarget } from '@weasel-js/core';
import { nearestWithin } from './snaps';
import { gridSlots } from './strategies/arrangements';
import { snapPoint } from './strategies/snapPoint';

type P = { x: number; y: number };
const at = (x: number, y: number): DropTarget<P> => ({ pose: { x, y }, origin: { x, y } });

describe('drop-target pickers, shrunk from the property tests', () => {
  it('nearestWithin rejects every drop under a negative tolerance', () => {
    // Squared, -Infinity accepted a target anywhere, and -5 one within 5.
    expect(nearestWithin<P>({ tolerance: -Infinity }).pickTarget([at(0, 0)], { x: 0, y: 0 })).toBeNull();
    expect(nearestWithin<P>({ tolerance: -5 }).pickTarget([at(1, 0)], { x: 0, y: 0 })).toBeNull();
  });

  it('gridSlots gives no slot for a column count under one, and none outside its container for a fractional one', () => {
    // One column of -1 put the slot at x = -0.0625, outside a box from 0; NaN rows put every slot at NaN.
    const b = { x: 0, y: 0, width: 0.125, height: 0.125 };
    expect(gridSlots({ cols: -1 })(b, 1)).toEqual([]);
    expect(gridSlots({ cols: 0 })(b, 2)).toEqual([]);
    expect(gridSlots({ cols: 2.5 })(b, 3)).toEqual(gridSlots({ cols: 2 })(b, 3));
    expect(gridSlots({ cols: 2, rows: NaN })(b, 1)).toEqual(gridSlots({ cols: 2 })(b, 1));
  });

  it('snapPoint offers no grid points on an infinite spacing', () => {
    // It offered one at (NaN, NaN): the corner plus 0 × Infinity.
    const layout = snapPoint<{ x: number; y: number; width: number; height: number }>({ pattern: 'grid', gridSpacing: Infinity });
    const pose = { x: 0, y: 0, width: 1, height: 1 };
    expect(layout.getDropTargets({ id: 'C', bounds: { x: 0, y: 0, width: 0.125, height: 0.125 } }, [], { id: 'z', originPose: pose, pose, sourceContainerId: null })).toEqual([]);
  });

  it('snapPoint offers no grid point past its container where a spacing is too fine to count the cells', () => {
    // At 1e-300 in a box 105 tall, the points nearest the bottom edge rounded to past it.
    const layout = snapPoint<{ x: number; y: number; width: number; height: number }>({ pattern: 'grid', gridSpacing: 1e-300 });
    const pose = { x: 0, y: 0, width: 1, height: 1 };
    const got = layout.getDropTargets({ id: 'C', bounds: { x: 0, y: -105, width: 0.125, height: 105 } }, [], { id: 'z', originPose: pose, pose, sourceContainerId: null });
    expect(got.filter((t) => t.origin.y > 0)).toEqual([]);
  });
});
