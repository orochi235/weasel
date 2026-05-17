/**
 * Tests for the state cluster inside ColorContextProvider.
 *
 * Each test mounts the provider and exercises the API via `useColorContext()`.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { ColorContextProvider, useColorContext } from './ColorContextProvider';
import type { Obj } from '../../poseUpdate';

const noopUpdateSelected: (patch: (o: Obj) => Obj, label?: string) => void = () => {};

function makeWrapper(updateSelected: (patch: (o: Obj) => Obj, label?: string) => void = noopUpdateSelected) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ColorContextProvider updateSelected={updateSelected}>
        {children}
      </ColorContextProvider>
    );
  };
}

describe('ColorContextProvider — state cluster', () => {
  it('reset returns fill to white and stroke to black', () => {
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(),
    });
    act(() => {
      result.current.setFillColor('#123456ff');
      result.current.setStrokeColor('#abcdefff');
      result.current.reset();
    });
    expect(result.current.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
    expect(result.current.stroke).toEqual({ kind: 'solid', color: '#000000ff' });
  });

  it('swap exchanges fill and stroke', () => {
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(),
    });
    act(() => {
      result.current.setFillColor('#aaaaaaff');
      result.current.setStrokeColor('#bbbbbbff');
      result.current.swap();
    });
    expect(result.current.fill).toEqual({ kind: 'solid', color: '#bbbbbbff' });
    expect(result.current.stroke).toEqual({ kind: 'solid', color: '#aaaaaaff' });
  });

  it('swapFocus toggles focused side', () => {
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.focused).toBe('fill');
    act(() => result.current.swapFocus());
    expect(result.current.focused).toBe('stroke');
    act(() => result.current.swapFocus());
    expect(result.current.focused).toBe('fill');
  });

  it('toggleFocusedNone flips between solid and none', () => {
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.toggleFocusedNone());
    expect(result.current.fill).toEqual({ kind: 'none' });
    act(() => result.current.toggleFocusedNone());
    expect(result.current.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
  });
});

describe('ColorContextProvider — scene-write cluster', () => {
  it('applyFillToSelection routes through updateSelected with the "Set fill" label', () => {
    const calls: Array<{ patched: Partial<Obj>; label: string | undefined }> = [];
    const updateSelected = (patch: (o: Obj) => Obj, label?: string) => {
      const fake = { id: 'a', tool: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#ffffffff' } as unknown as Obj;
      calls.push({ patched: patch(fake), label });
    };
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(updateSelected),
    });
    act(() => result.current.applyFillToSelection('#ff0000ff'));
    expect(calls).toHaveLength(1);
    expect(calls[0].label).toBe('Set fill');
    expect((calls[0].patched as { fill?: string }).fill).toBe('#ff0000ff');
  });

  it('applyFillToSelection on a text obj writes into style.fill.color', () => {
    const calls: Array<Partial<Obj>> = [];
    const updateSelected = (patch: (o: Obj) => Obj) => {
      const fake = {
        id: 't', tool: 'text', x: 0, y: 0, width: 10, height: 10,
        style: { fill: { fill: 'solid' as const, color: '#000000ff' } },
      } as unknown as Obj;
      calls.push(patch(fake));
    };
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(updateSelected),
    });
    act(() => result.current.applyFillToSelection('#00ff00ff'));
    const next = calls[0] as { style?: { fill?: { color?: string } } };
    expect(next.style?.fill?.color).toBe('#00ff00ff');
  });

  it('applyStrokeWidthToSelection writes strokeWidth on non-text', () => {
    const calls: Array<Partial<Obj>> = [];
    const updateSelected = (patch: (o: Obj) => Obj) => {
      const fake = { id: 'a', tool: 'rect', strokeWidth: 1 } as unknown as Obj;
      calls.push(patch(fake));
    };
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(updateSelected),
    });
    act(() => result.current.applyStrokeWidthToSelection(5));
    expect((calls[0] as { strokeWidth?: number }).strokeWidth).toBe(5);
  });
});
