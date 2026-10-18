import { describe, expect, it } from 'vitest';
import { boundsOfPath, circlePath, squarePath, type PolygonPath } from '@weasel-js/geom';
import { spiroMarker } from './spiroMarkers';
import { spiroRepresentation } from './spiroRepresentation';

const sameCoords = (a: PolygonPath, b: PolygonPath) => expect(Array.from(a.coords)).toEqual(Array.from(b.coords));

describe('spiroMarker', () => {
  it('draws a smooth point as a circle and a corner as a square', () => {
    sameCoords(spiroMarker('smooth')({ x: 10, y: 20 }, 8, null, null), circlePath(10, 20, 4));
    sameCoords(spiroMarker('corner')({ x: 10, y: 20 }, 8, null, null), squarePath(10, 20, 8));
  });

  it('draws a g4 point as a diamond, its tips on the circle a smooth point fills', () => {
    const b = boundsOfPath(spiroMarker('g4')({ x: 10, y: 20 }, 8, null, null));
    expect([b.x, b.y, b.width, b.height]).toEqual([5, 15, 10, 10]);
    expect(Array.from(spiroMarker('g4')({ x: 10, y: 20 }, 8, null, null).coords)).toHaveLength(8);
  });

  it('turns a tangent point into a half-disc whose round side faces away from its line', () => {
    // The line arrives at a left point from the left, so the disc bulges right.
    const left = boundsOfPath(spiroMarker('left')({ x: 0, y: 0 }, 8, { x: -50, y: 0 }, { x: 50, y: 30 }));
    expect(left.x).toBeCloseTo(0, 6);
    expect(left.x + left.width).toBeGreaterThan(4);
    // The line leaves a right point toward the right, so the disc bulges left.
    const right = boundsOfPath(spiroMarker('right')({ x: 0, y: 0 }, 8, { x: -50, y: 30 }, { x: 50, y: 0 }));
    expect(right.x + right.width).toBeCloseTo(0, 6);
    expect(right.x).toBeLessThan(-4);
  });

  it('marks each point of a spiro form in path edit by its kind', () => {
    const form = { kind: 'spiro', kinds: ['corner', 'left', 'smooth'], at: [0, 1, 2] };
    const markers = spiroRepresentation.anchorMarkers!(form);
    const at = { x: 100, y: 0 }, prev = { x: 0, y: 0 }, next = { x: 200, y: 50 };
    expect(markers).toHaveLength(3);
    sameCoords(markers[0]!(at, 8, prev, next), squarePath(100, 0, 8));
    sameCoords(markers[1]!(at, 8, prev, next), spiroMarker('left')(at, 8, prev, next));
    sameCoords(markers[2]!(at, 8, prev, next), circlePath(100, 0, 4));
    expect(spiroRepresentation.anchorMarkers!({ kind: 'spiro', kinds: ['smooth'], at: [] })).toEqual([]);
  });
});
