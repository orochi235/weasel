import { describe, expect, it } from 'vitest';
import { pageIndex } from './iconPickerModel';

// Four rows of three cells, 40px apart.
const boxes = Array.from({ length: 12 }, (_, i) => ({ top: Math.floor(i / 3) * 40, left: (i % 3) * 40, width: 32 }));

describe('pageIndex', () => {
  it('moves down as many rows as fit in the height, keeping the column', () => {
    expect(pageIndex(boxes, 1, 'PageDown', 85)).toBe(7);
  });

  it('moves up the same way', () => {
    expect(pageIndex(boxes, 10, 'PageUp', 85)).toBe(4);
  });

  it('moves at least one row when the height holds less than one', () => {
    expect(pageIndex(boxes, 1, 'PageDown', 10)).toBe(4);
  });

  it('stops at the last row, and answers null with no row to move to', () => {
    expect(pageIndex(boxes, 1, 'PageDown', 1000)).toBe(10);
    expect(pageIndex(boxes, 10, 'PageDown', 1000)).toBeNull();
    expect(pageIndex(boxes, 1, 'PageUp', 1000)).toBeNull();
  });

  it('answers null for any other key', () => {
    expect(pageIndex(boxes, 1, 'ArrowDown', 85)).toBeNull();
  });
});
