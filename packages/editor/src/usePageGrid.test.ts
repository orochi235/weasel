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

  it('starts its snap lines at the page corner', () => {
    const { result } = renderHook(() => usePageGrid({ ...base, page: { x: 3, y: 7, width: 100, height: 80 }, visible: true, snap: true }));
    const query = { gesture: 'point', probes: [{ id: 'pointer', at: { x: 4, y: 8 }, role: 'pointer' }], delta0: { x: 0, y: 0 } };
    const at = [...result.current.source!.collect(query as never)].map((t) => t.locus.at);
    expect(at).toContainEqual({ x: 3, y: 8 });
    expect(at).toContainEqual({ x: 4, y: 7 });
  });
});
