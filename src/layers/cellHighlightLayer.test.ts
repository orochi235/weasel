import { describe, expect, it, vi } from 'vitest';
import { createCellHighlightLayer } from './cellHighlightLayer';
import { IMPERIAL_INCHES } from '../units';

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
    layer.draw(ctx, undefined);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual([20, 30, 10, 10]);
  });

  it('skips drawing when getCell returns null', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: 10,
      getCell: () => null,
    });
    layer.draw(ctx, undefined);
    expect(calls).toEqual([]);
  });

  it('honors custom origin', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: 10,
      origin: () => ({ x: 5, y: 7 }),
      getCell: () => ({ col: 1, row: 1 }),
    });
    layer.draw(ctx, undefined);
    expect(calls[0].args).toEqual([15, 17, 10, 10]);
  });

  it('honors a custom solid Paint fill', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: 10,
      getCell: () => ({ col: 0, row: 0 }),
      fill: { fill: 'solid', color: '#123456' },
    });
    layer.draw(ctx, undefined);
    expect(calls[0].fillStyle).toBe('#123456');
  });

  it('resolves a tagged spacing value via the unit system', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createCellHighlightLayer({
      spacing: { value: 1, unit: 'ft' },
      unitSystem: IMPERIAL_INCHES,
      getCell: () => ({ col: 2, row: 1 }),
    });
    layer.draw(ctx, undefined);
    // 1ft = 12in -> rect at (24, 12, 12, 12).
    expect(calls[0].args).toEqual([24, 12, 12, 12]);
  });
});
