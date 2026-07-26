import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragRadial } from './dragRadial';

const NO_MODS = { shift: false, alt: false, meta: false, ctrl: false };

describe('useDragRadial', () => {
  it('reports overlay center / radius / rotation while dragging', () => {
    const { result } = renderHook(() => useDragRadial({}));
    act(() => result.current.start(10, 10, NO_MODS));
    expect(result.current.overlay).toEqual({ center: { x: 10, y: 10 }, radius: 0, rotation: 0 });

    act(() => { result.current.move(20, 10, NO_MODS); });
    expect(result.current.overlay?.radius).toBeCloseTo(10);
    expect(result.current.overlay?.rotation).toBeCloseTo(0);

    act(() => { result.current.move(10, 20, NO_MODS); });
    expect(result.current.overlay?.radius).toBeCloseTo(10);
    expect(result.current.overlay?.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('calls onEnd with the final radial state and clears overlay on commit', () => {
    let endArgs: { center: { x: number; y: number }; radius: number; rotation: number } | null = null;
    const { result } = renderHook(() =>
      useDragRadial({
        onEnd: (ctx) => {
          endArgs = {
            center: { ...ctx.center },
            radius: ctx.radius,
            rotation: ctx.rotation,
          };
          return true;
        },
      })
    );
    act(() => result.current.start(5, 5, NO_MODS));
    act(() => { result.current.move(8, 9, NO_MODS); });
    act(() => result.current.end());
    expect(endArgs).not.toBeNull();
    expect(endArgs!.center).toEqual({ x: 5, y: 5 });
    expect(endArgs!.radius).toBeCloseTo(5);
    expect(result.current.overlay).toBeNull();
  });

  it('cancel() discards in-flight gesture without invoking onEnd', () => {
    let ended = false;
    const { result } = renderHook(() =>
      useDragRadial({ onEnd: () => { ended = true; return true; } })
    );
    act(() => result.current.start(0, 0, NO_MODS));
    act(() => { result.current.move(3, 4, NO_MODS); });
    act(() => result.current.cancel());
    expect(ended).toBe(false);
    expect(result.current.overlay).toBeNull();
  });

  it('reports isSubThreshold at end when radius is below minRadius', () => {
    let sub: boolean | null = null;
    const { result } = renderHook(() =>
      useDragRadial({
        minRadius: 5,
        onEnd: (ctx) => { sub = ctx.isSubThreshold; return false; },
      })
    );
    act(() => result.current.start(0, 0, NO_MODS));
    act(() => { result.current.move(1, 1, NO_MODS); });
    act(() => result.current.end());
    expect(sub).toBe(true);
  });
});
