import { describe, expect, it } from 'vitest';
import { boundsOfPath, circlePath, PathBuilder, squarePath, type PolygonPath, type SpiroKind } from '@weasel-js/geom';
import { anchorMarkerPath } from './anchorMarkers';
import { createPathEditingOverlayLayer } from './pathEditingOverlayLayer';

const same = (a: PolygonPath, b: PolygonPath) => expect(Array.from(a.coords)).toEqual(Array.from(b.coords));

describe('anchorMarkerPath', () => {
  it('draws a smooth point as a circle and a corner, or a plain anchor, as a square', () => {
    same(anchorMarkerPath('smooth', { x: 10, y: 20 }, 8), circlePath(10, 20, 4));
    same(anchorMarkerPath('corner', { x: 10, y: 20 }, 8), squarePath(10, 20, 8));
    same(anchorMarkerPath(null, { x: 10, y: 20 }, 8), squarePath(10, 20, 8));
  });

  it('turns a tangent point into a half-disc whose round side faces away from its line', () => {
    // The line arrives at a left point from the left, so the disc bulges right.
    const left = boundsOfPath(anchorMarkerPath('left', { x: 0, y: 0 }, 8, { x: -50, y: 0 }, { x: 50, y: 30 }));
    expect(left.x).toBeCloseTo(0, 6);
    expect(left.x + left.width).toBeGreaterThan(4);
    // The line leaves a right point toward the right, so the disc bulges left.
    const right = boundsOfPath(anchorMarkerPath('right', { x: 0, y: 0 }, 8, { x: -50, y: 30 }, { x: 50, y: 0 }));
    expect(right.x + right.width).toBeCloseTo(0, 6);
    expect(right.x).toBeLessThan(-4);
  });
});

describe('the path-edit overlay', () => {
  it('draws each spiro point with the marker of its kind', () => {
    const control = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(200, 50).lineTo(300, 0).build();
    const kinds: SpiroKind[] = ['corner', 'left', 'smooth', 'smooth'];
    const layer = createPathEditingOverlayLayer({
      getEditingId: () => 'a',
      getPose: () => control,
      getAnchorKinds: () => kinds,
    });
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const out = layer.draw(undefined as never, view as never, { width: 400, height: 300 } as never);
    const markers = out.map((c) => (c as { path: PolygonPath }).path);
    expect(markers).toHaveLength(4);
    same(markers[0], squarePath(0, 0, 8));
    same(markers[1], anchorMarkerPath('left', { x: 100, y: 0 }, 8, { x: 0, y: 0 }, { x: 200, y: 50 }));
    same(markers[2], circlePath(200, 50, 4));
    same(markers[3], circlePath(300, 0, 4));
  });

  it('draws every anchor of an ordinary path as a square', () => {
    const path = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
    const layer = createPathEditingOverlayLayer({ getEditingId: () => 'a', getPose: () => path });
    const out = layer.draw(undefined as never, { x: 0, y: 0, scale: { x: 1, y: 1 } } as never, { width: 400, height: 300 } as never);
    same((out[1] as { path: PolygonPath }).path, squarePath(100, 0, 8));
  });
});
