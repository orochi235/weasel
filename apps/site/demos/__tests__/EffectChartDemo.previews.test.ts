import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EffectRun } from '@weasel-js/diagram/effect';
import { useClosePreviews } from '../EffectChartDemo';

const bitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap & { close: ReturnType<typeof vi.fn> };
const runOf = (b: ImageBitmap): EffectRun => ({ stages: { a: { previews: { out: b } } } });

describe('EffectChartPreviewDemo previews', () => {
  it('closes a run’s bitmaps once the next run replaces it, and the last on unmount', () => {
    const first = bitmap(), second = bitmap();
    const { rerender, unmount } = renderHook(({ run }) => useClosePreviews(run), { initialProps: { run: runOf(first) } });
    expect(first.close).not.toHaveBeenCalled();
    rerender({ run: runOf(second) });
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
    unmount();
    expect(second.close).toHaveBeenCalledOnce();
  });
});
