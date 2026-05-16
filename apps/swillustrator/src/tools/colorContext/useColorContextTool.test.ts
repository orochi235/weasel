import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColorContextTool } from './useColorContextTool';

const noopUpdateSelected = () => {};

describe('useColorContextTool — state cluster', () => {
  it('reset returns fill to white and stroke to black', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => {
      result.current.api.setFillColor('#123456ff');
      result.current.api.setStrokeColor('#abcdefff');
      result.current.api.reset();
    });
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
    expect(result.current.api.stroke).toEqual({ kind: 'solid', color: '#000000ff' });
  });

  it('swap exchanges fill and stroke', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => {
      result.current.api.setFillColor('#aaaaaaff');
      result.current.api.setStrokeColor('#bbbbbbff');
      result.current.api.swap();
    });
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#bbbbbbff' });
    expect(result.current.api.stroke).toEqual({ kind: 'solid', color: '#aaaaaaff' });
  });

  it('swapFocus toggles focused side', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    expect(result.current.api.focused).toBe('fill');
    act(() => result.current.api.swapFocus());
    expect(result.current.api.focused).toBe('stroke');
    act(() => result.current.api.swapFocus());
    expect(result.current.api.focused).toBe('fill');
  });

  it('toggleFocusedNone flips between solid and none', () => {
    const { result } = renderHook(() =>
      useColorContextTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => result.current.api.toggleFocusedNone());
    expect(result.current.api.fill).toEqual({ kind: 'none' });
    act(() => result.current.api.toggleFocusedNone());
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
  });
});
