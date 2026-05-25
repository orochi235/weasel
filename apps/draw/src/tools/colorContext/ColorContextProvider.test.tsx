/**
 * Tests for the state cluster inside ColorContextProvider.
 *
 * Each test mounts the provider and exercises the API via `useColorContext()`.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { ColorContextProvider, useColorContext } from './ColorContextProvider';

function makeWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ColorContextProvider>
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

