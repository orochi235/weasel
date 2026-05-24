import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleBackgroundClick } from './backgroundClickPolicy';

const ctx = {
  selection: { clear: vi.fn(), clearScoped: vi.fn() },
  commitText: vi.fn(),
};

describe('handleBackgroundClick', () => {
  beforeEach(() => {
    ctx.selection.clear.mockReset();
    ctx.selection.clearScoped.mockReset();
    ctx.commitText.mockReset();
  });

  it('normal: clears selection', () => {
    handleBackgroundClick('normal', ctx as never, vi.fn());
    expect(ctx.selection.clear).toHaveBeenCalled();
  });

  it('path-edit: swallows (no selection clear, no exit)', () => {
    const exit = vi.fn();
    handleBackgroundClick('path-edit', ctx as never, exit);
    expect(ctx.selection.clear).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('isolation: clears scoped selection, does not exit', () => {
    const exit = vi.fn();
    handleBackgroundClick('isolation', ctx as never, exit);
    expect(ctx.selection.clearScoped).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('text-edit: commits text and exits mode', () => {
    const exit = vi.fn();
    handleBackgroundClick('text-edit', ctx as never, exit);
    expect(ctx.commitText).toHaveBeenCalled();
    expect(exit).toHaveBeenCalled();
  });

  it('free-transform: swallows', () => {
    const exit = vi.fn();
    handleBackgroundClick('free-transform', ctx as never, exit);
    expect(ctx.selection.clear).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('crop: swallows', () => {
    const exit = vi.fn();
    handleBackgroundClick('crop', ctx as never, exit);
    expect(ctx.selection.clear).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
