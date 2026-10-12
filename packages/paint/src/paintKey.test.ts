import { describe, it, expect } from 'vitest';
import { fillHasInk, paintKey, strokeHasInk, strokeKey } from './paintKey';
import type { Paint, Stroke } from './paint';

const gradient = (): Paint => ({
  kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
  stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
});

describe('paintKey', () => {
  it('is one key for two gradients built separately', () => {
    expect(paintKey(gradient())).toBe(paintKey(gradient()));
  });

  it('does not read field order', () => {
    const a: Paint = { kind: 'radial-gradient', center: { x: 1, y: 2 }, radius: 3, stops: [] };
    const b: Paint = { stops: [], radius: 3, center: { y: 2, x: 1 }, kind: 'radial-gradient' };
    expect(paintKey(a)).toBe(paintKey(b));
  });

  it('tells apart paints that differ in any field', () => {
    const other = { ...gradient(), opacity: 0.5 } as Paint;
    expect(paintKey(other)).not.toBe(paintKey(gradient()));
    expect(paintKey({ kind: 'hatch', color: '#000' })).not.toBe(paintKey({ kind: 'dots', color: '#000' }));
  });

  it('reads a solid with its kind and opacity left to default as the spelled-out one', () => {
    expect(paintKey({ color: '#abc' })).toBe(paintKey({ kind: 'solid', color: '#abc', opacity: 1 }));
    expect(paintKey({ color: '#abc' })).not.toBe(paintKey({ color: '#abc', opacity: 0.5 }));
  });

  it('keys no paint apart from every paint', () => {
    expect(paintKey(null)).toBe(paintKey(undefined));
    expect(paintKey(null)).not.toBe(paintKey({ color: 'none' }));
  });
});

describe('strokeHasInk', () => {
  it('is false with no paint or no width', () => {
    expect(strokeHasInk(undefined)).toBe(false);
    expect(strokeHasInk({ width: 2 })).toBe(false);
    expect(strokeHasInk({ paint: { color: '#000' }, width: 0 })).toBe(false);
    expect(strokeHasInk({ paint: { color: '#000' }, width: { px: 0 } })).toBe(false);
  });

  it('is true for a painted stroke at the default width', () => {
    expect(strokeHasInk({ paint: { color: '#000' } })).toBe(true);
    expect(strokeHasInk({ paint: { color: '#000' }, width: { px: 1 } })).toBe(true);
  });
});

describe('fillHasInk', () => {
  it('is false for a fill that holds no paint', () => {
    expect(fillHasInk(null)).toBe(false);
    expect(fillHasInk({})).toBe(false);
    expect(fillHasInk({ paint: { color: '#000' } })).toBe(true);
  });
});

describe('strokeKey', () => {
  const red: Stroke = { paint: { color: '#f00' }, width: 2 };

  it('is one key for every stroke that puts no ink down', () => {
    expect(strokeKey(undefined)).toBe(strokeKey({ width: 2 }));
    expect(strokeKey(undefined)).toBe(strokeKey({ paint: { color: '#f00' }, width: 0 }));
    expect(strokeKey(undefined)).not.toBe(strokeKey(red));
  });

  it('reads an omitted field as its default', () => {
    expect(strokeKey({ paint: { color: '#f00' } })).toBe(strokeKey({
      paint: { color: '#f00' }, width: 1, join: 'miter', cap: 'butt', miterLimit: 4, align: 'center', dash: [],
    }));
  });

  it('keys a screen-pixel width apart from the same number of world units', () => {
    expect(strokeKey({ ...red, width: { px: 2 } })).not.toBe(strokeKey(red));
  });

  it('tells apart strokes that differ in paint, shape, or dash', () => {
    const keys = [
      red,
      { ...red, paint: { color: '#00f' } },
      { ...red, join: 'round' as const },
      { ...red, cap: 'round' as const },
      { ...red, dash: [1, 2] },
      { ...red, align: 'inner' as const },
      { ...red, markerEnd: 'arrow' },
    ].map(strokeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
