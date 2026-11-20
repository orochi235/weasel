import { describe, expect, it } from 'vitest';
import { insertPreviewExtent } from './insertPreviewExtent';

const bounds = { x: 10, y: 20, width: 30, height: 40 };

describe('insertPreviewExtent', () => {
  it.each(['line', 'polygon', 'star', 'pencil'])('falls back to the drag rect for a %s with no extras', (shape) => {
    for (const extras of [undefined, null, 7]) {
      const e = insertPreviewExtent({ shape, bounds, extras });
      expect(e.shape).toBe(shape);
      expect(Number.isFinite(e.bounds.width)).toBe(true);
    }
  });

  it('reads a line from the drag rect corners when extras is undefined', () => {
    const e = insertPreviewExtent({ shape: 'line', bounds, extras: undefined });
    expect(e.geometry).toEqual({ kind: 'line', a: { x: 10, y: 20 }, b: { x: 40, y: 60 } });
  });
});
