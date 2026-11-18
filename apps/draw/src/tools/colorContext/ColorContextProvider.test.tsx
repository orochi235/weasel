/**
 * Tests for the state cluster inside ColorContextProvider.
 *
 * Each test mounts the provider and exercises the API via `useColorContext()`.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { createToolOptionValues, SHARED_TOOL_OPTIONS } from '@weasel-js/core';
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
    expect(result.current.fill).toEqual({ color: '#bbbbbb' });
    expect(result.current.stroke).toEqual({ color: '#aaaaaa' });
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
    expect(result.current.fill).toBeNull();
    act(() => result.current.toggleFocusedNone());
    expect(result.current.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
  });

  it('toggleNone flips the named slot, whichever slot has focus', () => {
    const { result } = renderHook(() => useColorContext(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.focused).toBe('fill');
    act(() => result.current.toggleNone('stroke'));
    expect(result.current.stroke).toBeNull();
    expect(result.current.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
    act(() => result.current.toggleNone('stroke'));
    expect(result.current.stroke).toEqual({ kind: 'solid', color: '#000000ff' });
  });

  it('normalizes an 8-digit color it is given, as it does a 6-digit one', () => {
    const { result } = renderHook(() => useColorContext(), { wrapper: makeWrapper() });
    act(() => { result.current.setFillColor('#FF8800CC'); });
    expect(result.current.fill).toEqual({ color: '#ff8800', opacity: 0.8 });
  });

  it("keeps a swatch's opacity when a 6-digit color replaces it, and reads it as the alpha", () => {
    const values = createToolOptionValues();
    values.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#336699', opacity: 0.4 });
    const { result } = renderHook(() => useColorContext(), {
      wrapper: ({ children }: { children: ReactNode }) => <ColorContextProvider values={values}>{children}</ColorContextProvider>,
    });
    expect(result.current.focusedAlpha).toBeCloseTo(0.4, 5);
    act(() => { result.current.setFocusedColor('#ff0000'); });
    expect(result.current.fill).toEqual({ color: '#ff0000', opacity: 0.4 });
    act(() => { result.current.setFocusedAlpha(0.5); });
    expect(result.current.fill).toEqual({ color: '#ff0000', opacity: 0.5 });
    act(() => { result.current.setFocusedAlpha(1); });
    expect(result.current.fill).toEqual({ color: '#ff0000' });
  });

  it('reads an alpha held in the hex, and writes it back as opacity', () => {
    const values = createToolOptionValues();
    values.set(SHARED_TOOL_OPTIONS, 'fill', { kind: 'solid', color: '#33669980' });
    const { result } = renderHook(() => useColorContext(), {
      wrapper: ({ children }: { children: ReactNode }) => <ColorContextProvider values={values}>{children}</ColorContextProvider>,
    });
    expect(result.current.focusedAlpha).toBeCloseTo(128 / 255, 5);
    act(() => { result.current.setFocusedColor('#ff0000'); });
    expect(result.current.fill).toEqual({ color: '#ff0000', opacity: 128 / 255 });
  });
});
