import { describe, it, expect } from 'vitest';
import { pathFromD } from './pathFromD';
import { anchorsToPath, pathToAnchors } from './anchors';
import { nearestPathAnchor, reverseAnchors } from './nearestAnchor';
import type { PolygonPath } from './types';

const poly = (d: string) => pathFromD(d) as PolygonPath;
const ONE = { x: 1, y: 1 };

describe('nearestPathAnchor', () => {
  const open = { id: 'open', path: poly('M 0 0 L 100 0 L 100 100') };
  const closed = { id: 'closed', path: poly('M 200 0 L 300 0 L 300 100 Z') };

  it('finds the nearest anchor within the radius and names its end', () => {
    expect(nearestPathAnchor([open, closed], { x: 3, y: 2 }, 8, ONE))
      .toEqual({ id: 'open', sub: 0, idx: 0, x: 0, y: 0, end: 'first' });
    expect(nearestPathAnchor([open, closed], { x: 101, y: 99 }, 8, ONE))
      .toMatchObject({ id: 'open', idx: 2, end: 'last' });
    expect(nearestPathAnchor([open, closed], { x: 99, y: 1 }, 8, ONE))
      .toMatchObject({ id: 'open', idx: 1, end: null });
  });

  it('reports no end for an anchor of a closed subpath', () => {
    expect(nearestPathAnchor([closed], { x: 201, y: 0 }, 8, ONE))
      .toMatchObject({ id: 'closed', idx: 0, end: null });
  });

  it('returns null outside the radius', () => {
    expect(nearestPathAnchor([open], { x: 50, y: 50 }, 8, ONE)).toBeNull();
  });

  it('measures the radius in screen pixels', () => {
    // 6 world units at 2x zoom is 12 screen px — outside an 8px radius.
    expect(nearestPathAnchor([open], { x: 6, y: 0 }, 8, { x: 2, y: 2 })).toBeNull();
    expect(nearestPathAnchor([open], { x: 6, y: 0 }, 8, { x: 1, y: 1 })).not.toBeNull();
    // Non-uniform zoom: the y axis is squashed, so a larger world offset fits.
    expect(nearestPathAnchor([open], { x: 0, y: 12 }, 8, { x: 2, y: 0.5 })).not.toBeNull();
  });

  it('prefers the nearest, and skips candidates `accept` rejects', () => {
    const near = { id: 'a', path: poly('M 0 0 L 4 0 L 50 50') };
    expect(nearestPathAnchor([near], { x: 3, y: 0 }, 8, ONE)).toMatchObject({ idx: 1 });
    expect(nearestPathAnchor([near], { x: 3, y: 0 }, 8, ONE, (h) => h.end !== null))
      .toMatchObject({ idx: 0, end: 'first' });
  });
});

describe('reverseAnchors', () => {
  it('flips direction and swaps handles without changing the shape', () => {
    const path = poly('M 0 0 C 10 0 20 10 30 30 L 60 30');
    const { anchors } = pathToAnchors(path);
    const reversed = reverseAnchors(anchors[0]);
    expect(reversed.map((a) => [a.x, a.y])).toEqual([[60, 30], [30, 30], [0, 0]]);
    expect(reversed[1]).toMatchObject({ outHandle: { x: 20, y: 10 } });
    expect(reversed[1].inHandle).toBeUndefined();
    expect(reversed[2]).toMatchObject({ inHandle: { x: 10, y: 0 } });
    // Reversing twice is the original path.
    const back = anchorsToPath([reverseAnchors(reversed)], [false]);
    expect(Array.from(back.coords)).toEqual(Array.from(path.coords));
    expect(Array.from(back.commands)).toEqual(Array.from(path.commands));
  });
});
