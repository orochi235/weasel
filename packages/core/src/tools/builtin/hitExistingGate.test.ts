import { describe, it, expect, vi } from 'vitest';
import { applyHitExistingGate } from './hitExistingGate';
import { makeCtx } from './testUtils';

describe('applyHitExistingGate', () => {
  it('returns false when hitExisting is undefined', () => {
    expect(applyHitExistingGate(makeCtx(), undefined)).toBe(false);
  });

  it('returns false when hitExisting returns null', () => {
    const ctx = makeCtx();
    expect(applyHitExistingGate(ctx, () => null)).toBe(false);
    expect(ctx.selection.set).not.toHaveBeenCalled();
  });

  it('selects single id and returns true', () => {
    const set = vi.fn();
    const ctx = makeCtx({ selection: { current: [], set } as any });
    expect(applyHitExistingGate(ctx, () => 'id-1')).toBe(true);
    expect(set).toHaveBeenCalledWith(['id-1']);
  });

  it('selects array of ids and returns true', () => {
    const set = vi.fn();
    const ctx = makeCtx({ selection: { current: [], set } as any });
    expect(applyHitExistingGate(ctx, () => ['a', 'b'])).toBe(true);
    expect(set).toHaveBeenCalledWith(['a', 'b']);
  });

  it('passes the world point to the hit-test callback', () => {
    const hit = vi.fn(() => null);
    applyHitExistingGate(makeCtx({ worldX: 42, worldY: 99 }), hit);
    expect(hit).toHaveBeenCalledWith({ x: 42, y: 99 });
  });
});
