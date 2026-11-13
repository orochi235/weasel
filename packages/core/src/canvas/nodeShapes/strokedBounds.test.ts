import { describe, it, expect } from 'vitest';
import { boundsOfPath, PathBuilder } from '@weasel-js/geom';
import { strokedBounds, strokedPoseBox } from './strokedBounds';

const LINE = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
const PAINT = { color: '#000' };

describe('strokedBounds at a view scale', () => {
  it('sizes a { px } marker at the scale', () => {
    const b = strokedBounds(LINE, { paint: PAINT, width: 1, markerEnd: { key: 'arrow', size: { px: 4 } } }, 2);
    // 2 world units per marker unit: the arrow reaches 3 to either side.
    expect(b).toMatchObject({ y: -3, height: 6 });
  });
});

describe('strokedBounds of a path near float32 limits', () => {
  const s = 1e30;
  const huge = new PathBuilder().moveTo(-3 * s, s).curveTo(4 * s, -2 * s, -s, 5 * s, 2 * s, 2 * s).quadTo(6 * s, -4 * s, -5 * s, -s).build();

  it('holds the whole curve, flattened no finer than its coordinates are stored', () => {
    const b = strokedBounds(huge, { paint: PAINT, width: 1 }, 1)!;
    const curve = boundsOfPath(huge);
    expect(b.x).toBeLessThanOrEqual(curve.x);
    expect(b.y).toBeLessThanOrEqual(curve.y);
    expect(b.x + b.width).toBeGreaterThanOrEqual(curve.x + curve.width);
    expect(b.y + b.height).toBeGreaterThanOrEqual(curve.y + curve.height);
    // Grown by no more than a hair of the path's size for the coarser flattening.
    expect(b.width).toBeLessThan(curve.width * (1 + 2 ** -12));
  });
});

describe('strokedPoseBox', () => {
  it('measures again when the stroke it is handed changes, with the node unchanged', () => {
    const node = { data: { stroke: 'inherit' } };
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    const pathAt = () => LINE;
    const thin = strokedPoseBox(node, pose, { paint: PAINT, width: 2 }, undefined, pathAt);
    const wide = strokedPoseBox(node, pose, { paint: PAINT, width: 20 }, undefined, pathAt);
    expect(wide.y).toBeLessThan(thin.y);
  });
});
