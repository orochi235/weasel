import { describe, it, expect } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import { strokedBounds } from './strokedBounds';

const LINE = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
const PAINT = { color: '#000' };

describe('strokedBounds at a view scale', () => {
  it('sizes a { px } marker at the scale', () => {
    const b = strokedBounds(LINE, { paint: PAINT, width: 1, markerEnd: { key: 'arrow', size: { px: 4 } } }, 2);
    // 2 world units per marker unit: the arrow reaches 3 to either side.
    expect(b).toMatchObject({ y: -3, height: 6 });
  });
});
