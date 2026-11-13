import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useImageTool } from './useImageTool';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';

const insertParams = (tool: ReturnType<typeof useImageTool>) =>
  tool.bindings![0].opts!.params as Record<string, unknown>;

describe('useImageTool', () => {
  it('binds the drag to an image insert carrying the src', () => {
    const { result } = renderHook(() => useImageTool({ src: 'photo.png' }));
    expect(insertParams(result.current)).toMatchObject({ kind: 'image', src: 'photo.png' });
  });

  it('previews the bitmap by default', () => {
    const { result } = renderHook(() => useImageTool({ src: 'photo.png' }));
    expect(insertParams(result.current).preview).toBe('bitmap');
  });

  it('passes an outline-only preview through to the overlay', () => {
    const { result } = renderHook(() => useImageTool({ src: 'photo.png', preview: 'outline' }));
    expect(insertParams(result.current).preview).toBe('outline');
  });

  it('repositions the image mid-draw, as the shape tools do', () => {
    const { result } = renderHook(() => useImageTool({ src: 'photo.png' }));
    expect(result.current.bindings).toContain(INSERT_REPOSITION_BINDING);
  });
});
