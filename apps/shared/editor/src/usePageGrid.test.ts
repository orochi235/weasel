import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageGrid } from './usePageGrid';

const base = { page: { width: 100, height: 80 }, spacing: 10, background: '#ffffff', accentEvery: 5 };

describe('usePageGrid', () => {
  it('returns no layer or source when off, stable ones when on', () => {
    const off = renderHook(() => usePageGrid({ ...base, visible: false, snap: false }));
    expect(off.result.current.layer).toBeUndefined();
    expect(off.result.current.source).toBeUndefined();

    const on = renderHook(() => usePageGrid({ ...base, page: { ...base.page }, visible: true, snap: true }));
    const first = on.result.current;
    expect(first.layer).toBeDefined();
    expect(first.source).toBeDefined();
    on.rerender();
    expect(on.result.current.layer).toBe(first.layer);
    expect(on.result.current.source).toBe(first.source);
  });

  it('rebuilds when the spacing changes', () => {
    const { result, rerender } = renderHook(
      (spacing: number) => usePageGrid({ ...base, spacing, visible: true, snap: true }),
      { initialProps: 10 },
    );
    const first = result.current;
    rerender(20);
    expect(result.current.layer).not.toBe(first.layer);
    expect(result.current.source).not.toBe(first.source);
  });
});
