import { describe, expect, it } from 'vitest';
import type { GroupDrawCommand } from '../../renderer';
import { createCellHighlightLayer } from './cellHighlight';
import { IMPERIAL_INCHES } from '../../core/units';

describe('createCellHighlightLayer', () => {
  it('exposes id and label', () => {
    const layer = createCellHighlightLayer({ spacing: 10, getCell: () => null });
    expect(layer.id).toBe('cell-highlight');
    expect(layer.label).toBe('Cell highlight');
  });

  it('draw emits one rect path command at the cell coords', () => {
    const layer = createCellHighlightLayer({
      spacing: 20,
      getCell: () => ({ col: 2, row: 3 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 200, height: 200 });
    expect(tree).toHaveLength(1);
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toMatchObject({
      kind: 'path',
      path: { kind: 'rect', x: 40, y: 60, width: 20, height: 20 },
    });
  });

  it('draw returns [] when getCell returns null', () => {
    const layer = createCellHighlightLayer({ spacing: 20, getCell: () => null });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    expect(tree).toEqual([]);
  });

  it('honors custom origin', () => {
    const layer = createCellHighlightLayer({
      spacing: 10,
      origin: () => ({ x: 5, y: 7 }),
      getCell: () => ({ col: 1, row: 1 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children[0]).toMatchObject({
      kind: 'path',
      path: { kind: 'rect', x: 15, y: 17, width: 10, height: 10 },
    });
  });

  it('honors a custom solid Paint fill', () => {
    const layer = createCellHighlightLayer({
      spacing: 10,
      getCell: () => ({ col: 0, row: 0 }),
      fill: { fill: 'solid', color: '#123456' },
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children[0]).toMatchObject({
      kind: 'path',
      fill: { fill: 'solid', color: '#123456' },
    });
  });

  it('resolves a tagged spacing value via the unit system', () => {
    const layer = createCellHighlightLayer({
      spacing: { value: 1, unit: 'ft' },
      unitSystem: IMPERIAL_INCHES,
      getCell: () => ({ col: 2, row: 1 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    // 1ft = 12in -> rect at (24, 12, 12, 12).
    expect(group.children[0]).toMatchObject({
      kind: 'path',
      path: { kind: 'rect', x: 24, y: 12, width: 12, height: 12 },
    });
  });
});
