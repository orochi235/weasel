import { describe, expect, it, vi } from 'vitest';
import type { GroupDrawCommand } from '@orochi235/weasel-gl';
import { createCellHighlightLayer } from './cellHighlight';
import { IMPERIAL_INCHES } from '../../core/units';

interface RecordedCall {
  fn: string;
  args: number[];
  fillStyle?: string;
}

function makeStubCtx() {
  const calls: RecordedCall[] = [];
  const state = { fillStyle: '', globalAlpha: 1 };
  const ctx = {
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) { state.fillStyle = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v: number) { state.globalAlpha = v; },
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn((...args: number[]) => {
      calls.push({ fn: 'fillRect', args, fillStyle: state.fillStyle });
    }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('createCellHighlightLayer', () => {
  it('exposes id and label', () => {
    const layer = createCellHighlightLayer({ spacing: 10, getCell: () => null });
    expect(layer.id).toBe('cell-highlight');
    expect(layer.label).toBe('Cell highlight');
  });

  it('fills one cell at (col*spacing, row*spacing)', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: 10,
      getCell: () => ({ col: 2, row: 3 }),
    });
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual([20, 30, 10, 10]);
  });

  it('skips drawing when getCell returns null', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: 10,
      getCell: () => null,
    });
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(calls).toEqual([]);
  });

  it('honors custom origin', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: 10,
      origin: () => ({ x: 5, y: 7 }),
      getCell: () => ({ col: 1, row: 1 }),
    });
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(calls[0].args).toEqual([15, 17, 10, 10]);
  });

  it('honors a custom solid Paint fill', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: 10,
      getCell: () => ({ col: 0, row: 0 }),
      fill: { fill: 'solid', color: '#123456' },
    });
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(calls[0].fillStyle).toBe('#123456');
  });

  it('drawGL emits one rect path command at the cell coords', () => {
    const layer = createCellHighlightLayer({
      spacing: 20,
      getCell: () => ({ col: 2, row: 3 }),
    });
    const tree = layer.drawGL!(undefined, { x: 0, y: 0, scale: 1 }, { width: 200, height: 200 });
    expect(tree).toHaveLength(1);
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toMatchObject({
      kind: 'path',
      path: { kind: 'rect', x: 40, y: 60, width: 20, height: 20 },
    });
  });

  it('drawGL returns [] when getCell returns null', () => {
    const layer = createCellHighlightLayer({ spacing: 20, getCell: () => null });
    const tree = layer.drawGL!(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    expect(tree).toEqual([]);
  });

  it('resolves a tagged spacing value via the unit system', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: { value: 1, unit: 'ft' },
      unitSystem: IMPERIAL_INCHES,
      getCell: () => ({ col: 2, row: 1 }),
    });
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    // 1ft = 12in -> rect at (24, 12, 12, 12).
    expect(calls[0].args).toEqual([24, 12, 12, 12]);
  });
});
