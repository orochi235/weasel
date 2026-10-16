import { describe, expect, it } from 'vitest';
import { anchorsUnderBrush } from './anchorBrush';
import type { AnchorSet } from './anchorEdits';

/** Five anchors along y = 0, ten apart, then a second subpath at y = 50. */
function row(): AnchorSet {
  return {
    anchors: [
      [0, 10, 20, 30, 40].map((x) => ({ x, y: 0 })),
      [{ x: 0, y: 50 }, { x: 10, y: 50 }],
    ],
    closed: [false, false],
  };
}

describe('anchorsUnderBrush', () => {
  it('finds the anchors under a dab', () => {
    expect(anchorsUnderBrush(row(), { x: 10, y: 0 }, { x: 10, y: 0 }, { radiusPx: 3 })).toEqual([1]);
  });

  it('finds every anchor the stroke sweeps over, not only those at its ends', () => {
    expect(anchorsUnderBrush(row(), { x: 5, y: 2 }, { x: 35, y: 2 }, { radiusPx: 3 })).toEqual([1, 2, 3]);
  });

  it('numbers anchors across subpaths in walk order', () => {
    expect(anchorsUnderBrush(row(), { x: 10, y: 0 }, { x: 10, y: 50 }, { radiusPx: 1 })).toEqual([1, 6]);
  });

  it('counts an anchor exactly on the rim', () => {
    expect(anchorsUnderBrush(row(), { x: 20, y: 3 }, { x: 20, y: 3 }, { radiusPx: 3 })).toEqual([2]);
  });

  it('measures the radius on screen, per axis', () => {
    // At 4x vertical zoom, 2 world units above the row are 8px away.
    const above = { x: 20, y: 2 };
    expect(anchorsUnderBrush(row(), above, above, { radiusPx: 5, scale: { x: 1, y: 4 } })).toEqual([]);
    // Horizontal zoom leaves that vertical distance alone.
    expect(anchorsUnderBrush(row(), above, above, { radiusPx: 5, scale: { x: 4, y: 1 } })).toEqual([2]);
  });
});
