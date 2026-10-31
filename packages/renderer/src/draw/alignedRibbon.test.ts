import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { tessellate, type Mesh } from '@weasel-js/geom/tessellate';
import { tessellateStroke } from '@weasel-js/stroke';
import { alignedRibbon } from './alignedRibbon';

function area(mesh: Mesh): number {
  const v = mesh.vertices;
  let a = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [p, q, r] = [mesh.indices[i] * 2, mesh.indices[i + 1] * 2, mesh.indices[i + 2] * 2];
    a += Math.abs((v[q] - v[p]) * (v[r + 1] - v[p + 1]) - (v[r] - v[p]) * (v[q + 1] - v[p + 1])) / 2;
  }
  return a;
}

const SQUARE = pathFromD('M 0 0 L 100 0 L 100 100 L 0 100 Z');
/** The centered ribbon twice as wide as a 10-unit stroke. */
const doubled = (d: string) => tessellateStroke(pathFromD(d), { width: 20, join: 'miter', miterLimit: 10 });

describe('alignedRibbon', () => {
  it('keeps the inside of a square for an inner stroke, and the outside for an outer one', () => {
    const ribbon = doubled('M 0 0 L 100 0 L 100 100 L 0 100 Z');
    const fill = tessellate(SQUARE);
    const inner = area(alignedRibbon(ribbon, fill, true)!);
    const outer = area(alignedRibbon(ribbon, fill, false)!);
    expect(inner).toBeCloseTo(100 * 100 - 80 * 80, 3);
    expect(outer).toBeCloseTo(120 * 120 - 100 * 100, 3);
    expect(inner + outer).toBeCloseTo(area(ribbon), 3);
  });

  it('wound the other way, cuts the same', () => {
    const ribbon = doubled('M 0 0 L 0 100 L 100 100 L 100 0 Z');
    const fill = tessellate(pathFromD('M 0 0 L 0 100 L 100 100 L 100 0 Z'));
    expect(area(alignedRibbon(ribbon, fill, true)!)).toBeCloseTo(3600, 3);
  });

  it('splits a ribbon into its two sides, along a curved outline too', () => {
    const d = 'M 100 50 C 100 77 77 100 50 100 C 23 100 0 77 0 50 C 0 23 23 0 50 0 C 77 0 100 23 100 50 Z';
    const ribbon = tessellateStroke(pathFromD(d), { width: 20, join: 'round' }, { flattenTolerance: 0.25 });
    const fill = tessellate(pathFromD(d), { flattenTolerance: 0.25 });
    const inner = alignedRibbon(ribbon, fill, true);
    const outer = alignedRibbon(ribbon, fill, false);
    expect(inner).not.toBeNull();
    expect(area(inner!) + area(outer!)).toBeCloseTo(area(ribbon), 1);
  });

  it('refuses a fill that is not one convex ring', () => {
    const notch = 'M 0 0 L 100 0 L 100 100 L 50 50 L 0 100 Z';
    expect(alignedRibbon(doubled(notch), tessellate(pathFromD(notch)), true)).toBeNull();
    const ring = 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 20 20 L 20 80 L 80 80 L 80 20 Z';
    expect(alignedRibbon(doubled(ring), tessellate(pathFromD(ring)), true)).toBeNull();
  });

  it('returns the same mesh while its inputs hold', () => {
    const ribbon = doubled('M 0 0 L 100 0 L 100 100 L 0 100 Z');
    const fill = tessellate(SQUARE);
    expect(alignedRibbon(ribbon, fill, true)).toBe(alignedRibbon(ribbon, fill, true));
    expect(alignedRibbon(ribbon, fill, false)).not.toBe(alignedRibbon(ribbon, fill, true));
  });
});
