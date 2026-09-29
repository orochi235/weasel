import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  _resetPaintKindsForTests, asPaint, registerPaintKind, registerPaintKindLoader, type PaintKindEntry,
} from './paintKinds';
import { useGradientKinds, usePaintKind, usePaintKinds } from './usePaintKinds';

const noise = (): PaintKindEntry => ({
  id: 'test-noise',
  label: 'Noise',
  seed: (color) => asPaint({ fill: 'test-noise', color }),
  colorOf: () => undefined,
});

afterEach(() => { _resetPaintKindsForTests(); });

describe('paint-kind hooks', () => {
  it('re-render on a registration and keep their snapshot otherwise', () => {
    const { result, rerender } = renderHook(() => usePaintKinds());
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);

    act(() => { registerPaintKind(noise()); });
    expect(result.current.map((k) => k.id)).toContain('test-noise');
  });

  it('list only the kinds with a stop reading as gradients', () => {
    const { result } = renderHook(() => useGradientKinds());
    act(() => { registerPaintKind(noise()); });
    expect(result.current.map((k) => k.id)).not.toContain('test-noise');
    expect(result.current.map((k) => k.id)).toContain('linear-gradient');
  });

  it('resolve a lazily loaded kind once it lands', async () => {
    registerPaintKindLoader('test-noise', async () => noise());
    const { result } = renderHook(() => usePaintKind('test-noise'));
    expect(result.current).toBeUndefined();
    await waitFor(() => { expect(result.current?.label).toBe('Noise'); });
  });
});
