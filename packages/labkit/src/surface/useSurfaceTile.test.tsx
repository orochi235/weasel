import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceContext } from './SurfaceContext';
import { useSurface, useSurfaceOptional, useSurfaceTile } from './useSurfaceTile';
import type { SurfaceHandle } from './useTiledSurface';

function fakeHandle(): SurfaceHandle {
  return {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
    invalidateRects: vi.fn(),
    registerTile: vi.fn(),
    registerPainter: vi.fn(() => () => {}),
    containerRef: vi.fn(),
    getContainer: vi.fn(() => null),
  };
}

function Tile({ id }: { id: string }) {
  const ref = useSurfaceTile(id);
  return <div ref={ref} data-testid={id} />;
}

describe('useSurfaceTile', () => {
  it('registers its element with the surface on mount', () => {
    const handle = fakeHandle();
    const { getByTestId } = render(
      <SurfaceContext.Provider value={handle}>
        <Tile id="a" />
      </SurfaceContext.Provider>,
    );
    expect(handle.registerTile).toHaveBeenCalledWith('a', getByTestId('a'));
  });

  it('unregisters on unmount', () => {
    const handle = fakeHandle();
    const { unmount } = render(
      <SurfaceContext.Provider value={handle}>
        <Tile id="a" />
      </SurfaceContext.Provider>,
    );
    unmount();
    expect(handle.registerTile).toHaveBeenCalledWith('a', null);
  });

  it('is inert with no surface above it, so a 2D lab is unaffected', () => {
    expect(() => render(<Tile id="a" />)).not.toThrow();
  });
});

describe('useSurface', () => {
  it('throws outside a provider, because a caller asking for it needs one', () => {
    function Consumer() {
      useSurface();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(/requires a surface/i);
  });

  it('returns null from the optional form outside a provider', () => {
    let seen: SurfaceHandle | null | undefined;
    function Consumer() {
      seen = useSurfaceOptional();
      return null;
    }
    render(<Consumer />);
    expect(seen).toBeNull();
  });
});
