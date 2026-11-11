/**
 * Counterexamples the shape-bounds property tests found, kept as plain examples.
 */
import { describe, expect, it } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import { findShapeBounds } from 'canvas/NodeShape';
import { findShapeDrawnBounds } from 'canvas/drawnBounds';
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

describe('square caps on a dashed ellipse', () => {
  it('stay inside the drawn box', () => {
    const pose = { x: 0, y: 0, width: 100, height: 60 };
    const stroke: Stroke = { paint: { kind: 'solid', color: '#000000' }, width: 20, cap: 'square', dash: [7, 5] };
    const node = { id: 'n', kind: 'mark', layer: 'main', pose, data: { shape: 'ellipse', stroke } } as never;
    const ink = strokedBounds(pathForShape({ shape: 'ellipse' }, pose), stroke, 1)!;
    const drawn = findShapeDrawnBounds(node, pose, { scale: 1 })!;
    // A cap's corners stand off the curve by up to √2 half-widths; the box grew every side by one.
    const tol = 0.5;
    expect(ink.x).toBeGreaterThanOrEqual(drawn.x - tol);
    expect(ink.y).toBeGreaterThanOrEqual(drawn.y - tol);
    expect(ink.x + ink.width).toBeLessThanOrEqual(drawn.x + drawn.width + tol);
    expect(ink.y + ink.height).toBeLessThanOrEqual(drawn.y + drawn.height + tol);
  });
});
