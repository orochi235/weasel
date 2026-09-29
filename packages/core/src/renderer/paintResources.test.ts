import { describe, it, expect, vi } from 'vitest';
import { createPaintResources } from './paintResources';

describe('createPaintResources', () => {
  it('runs every registered release once, on release', () => {
    const r = createPaintResources();
    const a = vi.fn();
    const b = vi.fn();
    r.onRelease(a);
    r.onRelease(b);
    expect(a).not.toHaveBeenCalled();
    r.release();
    r.release();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('releases at once what registers after the lifetime ended, so nothing outlives it', () => {
    const r = createPaintResources();
    r.release();
    const late = vi.fn();
    r.onRelease(late);
    expect(late).toHaveBeenCalledTimes(1);
  });
});
