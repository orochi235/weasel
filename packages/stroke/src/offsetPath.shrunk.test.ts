import { describe, it, expect } from 'vitest';
import { PathBuilder, pathToAnchors } from '@weasel-js/geom';
import { offsetPath } from './offsetPath';

describe('offsetPath, shrunk counterexamples', () => {
  it('grows a regular triangle by a miter into a triangle, with no anchors left partway along its sides', () => {
    const tri = new PathBuilder().moveTo(5, 0).lineTo(-2.499999999999999, 4.330127018922194)
      .lineTo(-2.500000000000002, -4.330127018922193).close().build();
    expect(pathToAnchors(offsetPath(tri, 0.5)).anchors.map((s) => s.length)).toEqual([3]);
  });

  it('grows a square standing on a corner into four anchors', () => {
    const diamond = new PathBuilder().moveTo(10, 0).lineTo(0, 10).lineTo(-10, 0).lineTo(0, -10).close().build();
    expect(pathToAnchors(offsetPath(diamond, 3)).anchors.map((s) => s.length)).toEqual([4]);
  });
});
