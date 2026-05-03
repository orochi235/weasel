import { describe, expect, it } from 'vitest';
import { cornerResizeHandles, hitCornerHandle } from './cornerHandles';

describe('cornerResizeHandles', () => {
  it('returns 4 handles at the bounds corners with opposite-corner anchors', () => {
    expect(cornerResizeHandles({ x: 10, y: 20, width: 30, height: 40 })).toEqual([
      { cx: 10, cy: 20, anchor: { x: 'max', y: 'max' } },
      { cx: 40, cy: 20, anchor: { x: 'min', y: 'max' } },
      { cx: 10, cy: 60, anchor: { x: 'max', y: 'min' } },
      { cx: 40, cy: 60, anchor: { x: 'min', y: 'min' } },
    ]);
  });
});

describe('hitCornerHandle', () => {
  const h = { cx: 100, cy: 100, anchor: { x: 'min' as const, y: 'min' as const } };

  it('hits within radius on both axes', () => {
    expect(hitCornerHandle(h, 100, 100, 4)).toBe(true);
    expect(hitCornerHandle(h, 104, 96, 4)).toBe(true);
  });

  it('misses outside radius on either axis', () => {
    expect(hitCornerHandle(h, 105, 100, 4)).toBe(false);
    expect(hitCornerHandle(h, 100, 95, 4)).toBe(false);
  });
});
