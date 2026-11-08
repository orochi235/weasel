import { describe, it, expect } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
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
