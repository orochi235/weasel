import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import { Workspace } from './Workspace';

function fakeHandle(): SurfaceHandle {
  return {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
    invalidateRects: vi.fn(),
    registerTile: vi.fn(),
    registerPainter: vi.fn(() => () => {}),
    containerRef: vi.fn(),
  };
}

describe('Workspace with a surface above it', () => {
  it('invalidates rects when the tile set changes, because a re-tile moves tiles', () => {
    const handle = fakeHandle();
    const { rerender } = render(
      <SurfaceContext.Provider value={handle}>
        <Workspace ids={['a']} viewport={{ w: 800, h: 600 }}>
          <div>a</div>
        </Workspace>
      </SurfaceContext.Provider>,
    );
    (handle.invalidateRects as ReturnType<typeof vi.fn>).mockClear();

    rerender(
      <SurfaceContext.Provider value={handle}>
        <Workspace ids={['a', 'b']} viewport={{ w: 800, h: 600 }}>
          <div>a</div>
          <div>b</div>
        </Workspace>
      </SurfaceContext.Provider>,
    );

    expect(handle.invalidateRects).toHaveBeenCalled();
  });

  it('renders unchanged with no surface above it', () => {
    const { getByText } = render(
      <Workspace ids={['a']} viewport={{ w: 800, h: 600 }}>
        <div>a</div>
      </Workspace>,
    );
    expect(getByText('a')).toBeInTheDocument();
  });
});
