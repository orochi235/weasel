import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import type { LoupeLens } from './types';
import { useLensDamage } from './useLensDamage';

const lensAt = (x: number, y: number): LoupeLens => ({
  center: { x, y },
  shows: { x, y },
  width: 20,
  height: 20,
  factor: 4,
  shape: 'circle',
});

function hosted() {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: 200 });
  Object.defineProperty(el, 'offsetHeight', { value: 200 });
  let top = 0;
  el.getBoundingClientRect = () => new DOMRect(0, top, 200, 200);
  const invalidateBox = vi.fn();
  const surface = { invalidateBox } as unknown as SurfaceHandle;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>
  );
  return { el, invalidateBox, wrapper, scroll: (to: number) => (top = to) };
}

describe('a hollow lens’s damage', () => {
  it('invalidates the last box where the host now shows it, after a scroll', () => {
    const { el, invalidateBox, wrapper, scroll } = hosted();
    const { result } = renderHook(() => useLensDamage(true, undefined, { current: { current: el } }), {
      wrapper,
    });
    result.current?.(lensAt(50, 50));
    scroll(-30);
    invalidateBox.mockClear();
    result.current?.(lensAt(60, 50));
    expect(invalidateBox).toHaveBeenCalledWith({ left: 40, top: 10, width: 20, height: 20 });
  });
});
