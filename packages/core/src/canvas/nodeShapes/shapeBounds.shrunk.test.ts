/**
 * Counterexamples the shape-bounds property tests found, kept as plain examples.
 */
import { describe, expect, it } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import { findShapeBounds } from 'canvas/NodeShape';
import { pathForShape } from './shapePainter';
import { strokedBounds } from './strokedBounds';

describe('a marker head turned off the axes', () => {
  it('stays inside the paint box the cull reads', () => {
    const pose = { x: 0, y: 0, width: 1, height: 1 };
    const stroke: Stroke = { paint: { kind: 'solid', color: '#000000' }, width: { px: 0.5 }, miterLimit: 1, markerMid: 'arrow' };
    const node = { id: 'n', kind: 'mark', layer: 'main', pose, data: { shape: 'star', points: 3, stroke } } as never;
    const ink = strokedBounds(pathForShape({ shape: 'star', points: 3 }, pose), stroke, 0.25)!;
    const paint = findShapeBounds(node, pose, { scale: 0.25, leastScale: 0.25 })!;
    // The arrow's tip on the star's turned edges reached 6.45 out; the box held 6.
    expect(ink.x).toBeGreaterThanOrEqual(paint.x);
    expect(ink.x + ink.width).toBeLessThanOrEqual(paint.x + paint.width);
  });
});
