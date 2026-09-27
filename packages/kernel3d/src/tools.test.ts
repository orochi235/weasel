import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOrbitTool } from './tools';

describe('useOrbitTool', () => {
  it('returns the same tool on every render', () => {
    // A new object per render makes useTools rebuild its ToolsApi every render,
    // which loops a canvas whose onToolsCreated sets state.
    const { result, rerender } = renderHook(() => useOrbitTool());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
