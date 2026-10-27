import { describe, expect, it } from 'vitest';
import { PathBuilder, worldCoords, type PolygonPath } from '@weasel-js/geom';
import { subpathOf } from './subpaths';

describe('subpathOf', () => {
  it('cuts a path at each M, keeping the origin its coords are measured from', () => {
    const path = new PathBuilder().setOrigin(1000, 0)
      .moveTo(1000, 0).lineTo(1010, 0).moveTo(1020, 5).lineTo(1030, 5).build();
    const second = subpathOf(path, 1) as PolygonPath;
    expect(second.origin).toEqual({ x: 1000, y: 0 });
    expect(Array.from(worldCoords(second))).toEqual([1020, 5, 1030, 5]);
    expect(subpathOf(path, 2)).toBeNull();
  });
});
