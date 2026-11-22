import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnnotationStorage } from '../annotations/types';
import { useKeptMarks } from './useKeptMarks';

const storageHolding = (doc: string): AnnotationStorage => ({
  load: vi.fn(async () => doc as never),
  save: vi.fn(),
});

describe('useKeptMarks', () => {
  it("loads the marks again when the storage changes, rather than keeping the first storage's", async () => {
    const a = storageHolding('A');
    const b = storageHolding('B');
    const { result, rerender } = renderHook(({ storage }) => useKeptMarks(storage, 't'), {
      initialProps: { storage: a },
    });
    await waitFor(() => expect(result.current).toEqual({ ready: true, value: 'A' }));
    rerender({ storage: b });
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current).toEqual({ ready: true, value: 'B' }));
    expect(b.load).toHaveBeenCalledOnce();
  });
});
