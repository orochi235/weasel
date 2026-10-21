import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceCanvasContext, type SurfaceCanvases, SurfaceContext } from './SurfaceContext';
import {
  TOP_UNOFFERED,
  useSurface,
  useSurfaceCanvas,
  useSurfaceOptional,
  useSurfaceTile,
} from './useSurfaceTile';
import type { SurfaceHandle } from './useTiledSurface';

function fakeHandle(): SurfaceHandle {
  return {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
    invalidateRects: vi.fn(),
    invalidateBox: vi.fn(),
    registerTile: vi.fn(),
    registerClear: vi.fn(() => () => {}),
    registerPainter: vi.fn(() => () => {}),
    containerRef: vi.fn(),
    getContainer: vi.fn(() => null),
    scope: vi.fn(),
    inScope: vi.fn(() => true),
    subscribeScope: vi.fn(() => () => {}),
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

describe("useSurfaceCanvas('top')", () => {
  function Top() {
    useSurfaceCanvas('top');
    return null;
  }
  const mountUnder = (canvases: SurfaceCanvases) =>
    render(
      <SurfaceCanvasContext.Provider value={canvases}>
        <Top />
      </SurfaceCanvasContext.Provider>,
    );

  it('warns when the owner above publishes buffers but offers no top, which would leave the tenant painting nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mountUnder({
        over: document.createElement('canvas'),
        under: document.createElement('canvas'),
      });
      expect(warn).toHaveBeenCalledWith(TOP_UNOFFERED);
    } finally {
      warn.mockRestore();
    }
  });

  it('claims the top buffer, and says nothing, where the owner offers one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const release = vi.fn();
    const claimTop = vi.fn(() => release);
    try {
      const { unmount } = mountUnder({
        over: document.createElement('canvas'),
        under: null,
        top: null,
        claimTop,
      });
      expect(claimTop).toHaveBeenCalledTimes(1);
      unmount();
      expect(release).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('says nothing with no surface owner above at all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<Top />);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
