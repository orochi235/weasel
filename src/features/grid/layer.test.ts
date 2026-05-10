import { describe, expect, it } from 'vitest';
import type { GroupDrawCommand, PathDrawCommand } from '../../renderer';
import { createGridLayer } from './layer';
import { IMPERIAL_INCHES } from '../../core/units';

describe('createGridLayer', () => {
  it('exposes id "grid" and label "Grid"', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    expect(layer.id).toBe('grid');
    expect(layer.label).toBe('Grid');
  });

  it('draw emits one path per cell line in a world-transform group', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 30, height: 30 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    expect(tree).toHaveLength(1);
    const group = tree[0] as GroupDrawCommand;
    // 30/10 → 4 vertical lines + 4 horizontal lines = 8 paths.
    expect(group.children.filter((c) => c.kind === 'path')).toHaveLength(8);
  });

  it('draw returns [] for zero-sized bounds', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    expect(tree).toEqual([]);
  });

  it('draw divides stroke width by view.scale so hairlines stay 1px on screen', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 2 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    const first = group.children[0] as PathDrawCommand;
    expect(first.stroke?.width).toBe(0.5);
  });

  it('draw with accentEvery emits accent + line bands (sub omitted)', () => {
    const layer = createGridLayer({
      spacing: 10,
      accentEvery: 5,
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    // Total cell+accent lines: 11 vlines (0..100 step 10 inclusive) + 11 hlines = 22
    expect(group.children.filter((c) => c.kind === 'path')).toHaveLength(22);
  });

  it('resolves a tagged cell value via the unit system (1ft -> 12in spacing)', () => {
    const layer = createGridLayer({
      spacing: { value: 1, unit: 'ft' },
      unitSystem: IMPERIAL_INCHES,
      bounds: () => ({ x: 0, y: 0, width: 24, height: 12 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    // 24in wide x 12in tall, cell = 12in → 3 vertical lines (x=0,12,24) + 2 horizontal lines (y=0,12) = 5 paths.
    expect(group.children.filter((c) => c.kind === 'path')).toHaveLength(5);
  });

  it('throws at draw time when a tagged cell is given without a unit system', () => {
    const layer = createGridLayer({
      spacing: { value: 1, unit: 'ft' },
      bounds: () => ({ x: 0, y: 0, width: 24, height: 12 }),
    });
    expect(() => layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 })).toThrow(/UnitSystem/);
  });
});
