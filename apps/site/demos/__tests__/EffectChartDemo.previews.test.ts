import { StrictMode, createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EffectRun } from '@weasel-js/diagram/effect';
import { usePreviewRun } from '../EffectChartDemo';

type Bitmap = ImageBitmap & { close: ReturnType<typeof vi.fn> };

function minter() {
  const made: Bitmap[] = [];
  const mint = vi.fn((_t: number): EffectRun => {
    const b = { close: vi.fn() } as unknown as Bitmap;
    made.push(b);
    return { stages: { a: { previews: { out: b } } } };
  });
  return { made, mint };
}
const shown = (run: EffectRun | null) => run?.stages.a?.previews?.out as Bitmap | undefined;
const strict = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);

describe('usePreviewRun', () => {
  it('closes every set it mints, StrictMode’s discarded ones included, and never the one shown', () => {
    const { made, mint } = minter();
    const { result, rerender, unmount } = renderHook(({ t }) => usePreviewRun(t, mint), { initialProps: { t: 0 }, wrapper: strict });
    for (const t of [1, 2, 3]) {
      rerender({ t });
      expect(shown(result.current)!.close).not.toHaveBeenCalled();
      expect(made.filter((b) => b.close.mock.calls.length === 0)).toEqual([shown(result.current)]);
    }
    unmount();
    expect(made.every((b) => b.close.mock.calls.length >= 1)).toBe(true);
  });
});
