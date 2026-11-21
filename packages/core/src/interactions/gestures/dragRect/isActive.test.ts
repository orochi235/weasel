import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragRect, type DragRectController } from './dragRect';
import { useDragRadial } from '../dragRadial';
import type { ModifierState } from '../types';

const NO_MODS: ModifierState = { shift: false, alt: false, meta: false, ctrl: false };

type Controller = Pick<DragRectController, 'start' | 'end' | 'cancel' | 'isActive'>;

describe.each<[string, () => Controller]>([
  ['useDragRect', () => useDragRect()],
  ['useDragRadial', () => useDragRadial()],
])('%s isActive', (_name, hook) => {
  it('turns true at start and false at end, before any re-render', () => {
    const { result } = renderHook(hook);
    const c = result.current;
    act(() => {
      c.start(0, 0, NO_MODS);
      expect(c.isActive).toBe(true);
      c.end();
      expect(c.isActive).toBe(false);
    });
  });

  it('turns false at cancel, before any re-render', () => {
    const { result } = renderHook(hook);
    act(() => result.current.start(0, 0, NO_MODS));
    const c = result.current;
    act(() => {
      c.cancel();
      expect(c.isActive).toBe(false);
    });
  });
});
