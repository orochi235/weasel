import { describe, it, expect } from 'vitest';
import { PathBuilder } from './builder';
import { transformPath } from './transformPath';
import { boundsOfPath } from './bounds';
import { tessellate } from '../tessellate/tessellate';
import type { PolygonPath } from '../path';

const FAR = 262_144;

/** A unit square at `FAR + 0.3`, measured from `(FAR, 0)`. */
const square = (): PolygonPath => new PathBuilder().setOrigin(FAR, 0)
  .moveTo(FAR + 0.3, 1).lineTo(FAR + 1.3, 1).lineTo(FAR + 1.3, 2).lineTo(FAR + 0.3, 2).close().build();

describe('a path measured from an origin', () => {
  it('keeps a fraction a float32 coordinate that far out could not', () => {
    const p = square();
    expect(p.origin).toEqual({ x: FAR, y: 0 });
    expect(p.coords[0]).toBeCloseTo(0.3, 6);
    expect(Math.abs(Math.fround(FAR + 0.3) - (FAR + 0.3))).toBeGreaterThan(0.01);
  });

  it('re-measures points already given when the origin moves, and drops a zero origin', () => {
    const b = new PathBuilder().moveTo(5, 6).setOrigin(4, 4).lineTo(7, 8);
    expect(Array.from(b.build().coords)).toEqual([1, 2, 3, 4]);
    const back = b.setOrigin(0, 0).build();
    expect(back.origin).toBeUndefined();
    expect(Array.from(back.coords)).toEqual([5, 6, 7, 8]);
  });

  it('carries the origin through PathBuilder.fromPath', () => {
    const p = PathBuilder.fromPath(square()).lineTo(FAR + 0.5, 3).build();
    expect(p.origin).toEqual({ x: FAR, y: 0 });
    expect(p.coords.at(-2)).toBeCloseTo(0.5, 6);
  });

  it('bounds the path where the origin puts it', () => {
    const b = boundsOfPath(square());
    expect(b.x - FAR).toBeCloseTo(0.3, 6);
    expect(b.y).toBe(1);
    expect(b.width).toBeCloseTo(1, 6);
  });

  it('moves the origin under a transform and maps the offsets by its linear part', () => {
    const t = transformPath(square(), [0, 1, -1, 0, 10, 20]) as PolygonPath;
    // A quarter turn takes (x, y) to (-y, x), then the translation.
    expect(t.origin).toEqual({ x: 10, y: FAR + 20 });
    expect(t.coords[0]).toBeCloseTo(-1, 6);
    expect(t.coords[1]).toBeCloseTo(0.3, 6);
  });

  it('tessellates the offsets and hands the mesh the origin', () => {
    const p = square();
    const mesh = tessellate(p);
    expect(mesh.origin).toBe(p.origin);
    expect(Math.min(...Array.from(mesh.vertices).filter((_, i) => i % 2 === 0))).toBeCloseTo(0.3, 6);
  });
});
