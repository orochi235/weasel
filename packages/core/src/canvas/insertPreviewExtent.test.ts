import { describe, expect, it } from 'vitest';
import { insertPreviewExtent } from './insertPreviewExtent';

describe('insertPreviewExtent', () => {
  it.each(['line', 'polygon', 'star', 'pencil'])('falls back to the drag rect for a %s with no extras', (shape) => {
    const out = insertPreviewExtent({ shape, bounds: { x: 0, y: 0, width: 20, height: 20 }, extras: undefined });
    expect(out.shape).toBe(shape);
    expect(Number.isFinite(out.bounds.width)).toBe(true);
  });
});
