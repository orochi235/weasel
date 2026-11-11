import { describe, expect, it } from 'vitest';
import type { DropTarget } from '@weasel-js/core';
import { nearestWithin } from './snaps';

type P = { x: number; y: number };
const at = (x: number, y: number): DropTarget<P> => ({ pose: { x, y }, origin: { x, y } });

describe('drop-target pickers, shrunk from the property tests', () => {
  it('nearestWithin rejects every drop under a negative tolerance', () => {
    // Squared, -Infinity accepted a target anywhere, and -5 one within 5.
    expect(nearestWithin<P>({ tolerance: -Infinity }).pickTarget([at(0, 0)], { x: 0, y: 0 }, undefined as never)).toBeNull();
    expect(nearestWithin<P>({ tolerance: -5 }).pickTarget([at(1, 0)], { x: 0, y: 0 }, undefined as never)).toBeNull();
  });
});
