import { describe, expect, it } from 'vitest';
import { createCellHighlightLayer } from './cellHighlight';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 200, height: 200, dpr: 1 };
const box = (x: number, y: number, width: number, height: number) => ({ col: 0, row: 0, box: { x, y, width, height } });

describe('createCellHighlightLayer', () => {
  it('exposes id and label', () => {
    const layer = createCellHighlightLayer({ getCell: () => null });
    expect(layer.id).toBe('cell-highlight');
    expect(layer.label).toBe('Cell highlight');
  });

  it('draw emits one rect path command at the cell\'s box', () => {
    const layer = createCellHighlightLayer({ getCell: () => box(40, 60, 20, 5) });
    const tree = layer.draw(undefined, VIEW, DIMS);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ kind: 'path', path: { kind: 'rect', x: 40, y: 60, width: 20, height: 5 } });
  });

  it('draw returns [] when getCell returns null', () => {
    expect(createCellHighlightLayer({ getCell: () => null }).draw(undefined, VIEW, DIMS)).toEqual([]);
  });

  it('honors a custom solid Paint fill', () => {
    const layer = createCellHighlightLayer({ getCell: () => box(0, 0, 10, 10), fill: { paint: { kind: 'solid', color: '#123456' } } });
    expect(layer.draw(undefined, VIEW, DIMS)[0]).toMatchObject({ kind: 'path', fill: { paint: { kind: 'solid', color: '#123456' } } });
  });

  it('fills what the canvas shows of a cell without end', () => {
    const layer = createCellHighlightLayer({ getCell: () => box(-Infinity, 20, Infinity, 10) });
    expect(layer.draw(undefined, VIEW, DIMS)[0]).toMatchObject({ path: { kind: 'rect', x: 0, y: 20, width: 200, height: 10 } });
  });
});
