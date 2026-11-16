import { describe, it, expect } from 'vitest';
import { insertShape } from './shape';

const MIN = { width: 48, height: 48 };

function shape(
  params: Record<string, unknown>,
  start: { x: number; y: number },
  current: { x: number; y: number },
  altHeld = false,
) {
  return insertShape(params, { shaped: { start, current }, altHeld }, null, 0);
}

describe('insertShape — a minimum size', () => {
  it('grows a short drag to the minimum, away from where it started', () => {
    expect(shape({ kind: 'sticky', minSize: MIN }, { x: 100, y: 100 }, { x: 110, y: 105 }).bounds)
      .toEqual({ x: 100, y: 100, width: 48, height: 48 });
  });

  it('grows it the way the drag went', () => {
    expect(shape({ kind: 'sticky', minSize: MIN }, { x: 100, y: 100 }, { x: 90, y: 95 }).bounds)
      .toEqual({ x: 52, y: 52, width: 48, height: 48 });
  });

  it('grows only the axis that is short', () => {
    expect(shape({ kind: 'sticky', minSize: MIN }, { x: 100, y: 100 }, { x: 200, y: 110 }).bounds)
      .toEqual({ x: 100, y: 100, width: 100, height: 48 });
  });

  it('grows a drag from the center about its start', () => {
    expect(shape({ kind: 'sticky', minSize: MIN, originMode: 'center' }, { x: 100, y: 100 }, { x: 110, y: 105 }).bounds)
      .toEqual({ x: 76, y: 76, width: 48, height: 48 });
  });

  it('holds for any box kind, and hands the minimum on to the node', () => {
    const { bounds, extras } = shape({ kind: 'rect', minSize: MIN }, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(bounds).toEqual({ x: 0, y: 0, width: 48, height: 48 });
    expect((extras as { minSize?: unknown }).minSize).toEqual(MIN);
  });

  it('leaves a line alone, which has no area to hold', () => {
    expect(shape({ kind: 'line', minSize: MIN }, { x: 0, y: 0 }, { x: 4, y: 0 }).bounds)
      .toEqual({ x: 0, y: 0, width: 4, height: 0 });
  });

  it('leaves a drag with no minimum as drawn', () => {
    expect(shape({ kind: 'sticky' }, { x: 100, y: 100 }, { x: 110, y: 105 }).bounds)
      .toEqual({ x: 100, y: 100, width: 10, height: 5 });
  });
});
