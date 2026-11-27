import { boundsOfPath, worldCoords, type PolygonPath } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import { pathForShape } from './shapePainter';

const BOX = { x: 0, y: 0, width: 100, height: 100 };
const vertexCount = (shape: { shape: string; sides?: number; points?: number }) =>
  (pathForShape(shape, BOX) as PolygonPath).coords.length / 2;

describe('pathForShape', () => {
  it.each(['polygon', 'star'])('fits a %s inside a flipped pose box, as in the unflipped one', (shape) => {
    const flipped = boundsOfPath(pathForShape({ shape }, { x: 100, y: 0, width: -100, height: 20 }));
    const upright = boundsOfPath(pathForShape({ shape }, { x: 0, y: 0, width: 100, height: 20 }));
    expect(flipped.y).toBeGreaterThanOrEqual(-1e-9);
    expect(flipped.y + flipped.height).toBeLessThanOrEqual(20 + 1e-9);
    expect(flipped.width).toBeCloseTo(upright.width);
    expect(flipped.height).toBeCloseTo(upright.height);
  });

  it('rounds and clamps a polygon side count as the shape generator does', () => {
    expect(vertexCount({ shape: 'polygon', sides: 5.4 })).toBe(5);
    expect(vertexCount({ shape: 'polygon', sides: 0 })).toBe(3);
    expect(vertexCount({ shape: 'polygon', sides: -4 })).toBe(3);
    expect(vertexCount({ shape: 'polygon', sides: 1e9 })).toBe(32);
    expect(vertexCount({ shape: 'polygon', sides: Infinity })).toBe(32);
    expect(vertexCount({ shape: 'polygon', sides: NaN })).toBe(6);
  });

  it('rounds and clamps a star point count as the shape generator does', () => {
    expect(vertexCount({ shape: 'star', points: 4.6 })).toBe(10);
    expect(vertexCount({ shape: 'star', points: 1 })).toBe(6);
    expect(vertexCount({ shape: 'star', points: Infinity })).toBe(64);
    expect(vertexCount({ shape: 'star', points: NaN })).toBe(10);
  });

  it.each(['polygon', 'star'])('mirrors a %s with its pose, as a rect is', (shape) => {
    const d = { shape, sides: 3, points: 5 };
    const upright = [...worldCoords(pathForShape(d, BOX) as PolygonPath)];
    const flipped = [...worldCoords(pathForShape(d, { x: 100, y: 100, width: -100, height: -100 }) as PolygonPath)];
    expect(flipped.length).toBe(upright.length);
    upright.forEach((v, i) => expect(flipped[i]).toBeCloseTo(100 - v, 4));
  });
});
