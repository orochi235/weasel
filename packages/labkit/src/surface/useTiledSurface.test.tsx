import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SurfaceFrame, SurfaceHandle } from './useTiledSurface';
import { useTiledSurface } from './useTiledSurface';

/** jsdom measures everything as zero, so each element is given a box by hand. */
function stubBox(el: HTMLElement, left: number, top: number, width: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

interface HarnessProps {
  frames: SurfaceFrame[];
  onHandle: (h: SurfaceHandle) => void;
}

function Harness({ frames, onHandle }: HarnessProps) {
  const surface = useTiledSurface({
    onFrame: (f) => {
      frames.push(f);
    },
  });
  useEffect(() => {
    onHandle(surface);
  }, [surface, onHandle]);
  return (
    <div
      data-testid="stage"
      ref={(el) => {
        if (!el) return;
        stubBox(el, 0, 0, 800, 600);
        surface.containerRef(el);
      }}
    >
      <div
        data-testid="a"
        ref={(el) => {
          if (!el) return;
          stubBox(el, 0, 0, 400, 600);
          surface.registerTile('a', el);
        }}
      />
      <div
        data-testid="b"
        ref={(el) => {
          if (!el) return;
          stubBox(el, 400, 0, 400, 600);
          surface.registerTile('b', el);
        }}
      />
    </div>
  );
}

/** Runs every pending rAF callback. */
function flushFrames(): void {
  act(() => {
    vi.advanceTimersByTime(64);
  });
}

describe('useTiledSurface', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('coalesces three invalidations in one tick into a single frame', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();
    frames.length = 0;

    act(() => {
      handle?.invalidate('a');
      handle?.invalidate('b');
      handle?.invalidate('a');
    });
    flushFrames();

    expect(frames).toHaveLength(1);
    expect([...(frames[0]?.dirty ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('fires nothing on a clean tick', () => {
    const frames: SurfaceFrame[] = [];
    render(<Harness frames={frames} onHandle={() => {}} />);
    flushFrames();
    frames.length = 0;
    flushFrames();
    expect(frames).toHaveLength(0);
  });

  it('carries every tile rect, not only the dirty ones', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();
    frames.length = 0;

    act(() => handle?.invalidate('a'));
    flushFrames();

    expect([...(frames[0]?.dirty ?? [])]).toEqual(['a']);
    expect(frames[0]?.rects.get('b')).toEqual({ x: 400, y: 0, w: 400, h: 600 });
  });

  it('reports the surface size and dpr', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();
    frames.length = 0;

    act(() => handle?.invalidateAll());
    flushFrames();

    expect(frames[0]?.dpr).toBe(3);
    expect(frames[0]?.size).toEqual({ width: 800, height: 600 });
  });

  it('marks every tile dirty when the dpr changes', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();
    frames.length = 0;

    vi.stubGlobal('devicePixelRatio', 2);
    act(() => handle?.invalidateRects());
    flushFrames();

    expect([...(frames[0]?.dirty ?? [])].sort()).toEqual(['a', 'b']);
    expect(frames[0]?.dpr).toBe(2);
  });

  it('re-measures on invalidateRects, which is how a moved tile is caught', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    const { getByTestId } = render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();
    frames.length = 0;

    // A sibling reflow slides tile b left. ResizeObserver sees no size change.
    stubBox(getByTestId('b'), 320, 0, 400, 600);

    act(() => handle?.invalidateRects());
    flushFrames();

    expect(frames[0]?.rects.get('b')).toEqual({ x: 320, y: 0, w: 400, h: 600 });
  });

  it('drops a tile that unregisters', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();
    frames.length = 0;

    act(() => {
      handle?.registerTile('b', null);
      handle?.invalidate('a');
    });
    flushFrames();

    expect(frames[0]?.rects.has('b')).toBe(false);
  });

  it("calls a dirty tile's painter with that tile's rect", () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();

    const paintA = vi.fn();
    const paintB = vi.fn();
    act(() => {
      handle?.registerPainter('a', paintA);
      handle?.registerPainter('b', paintB);
      handle?.invalidate('a');
    });
    flushFrames();

    // The rect, not just the call: a painter handed the wrong origin paints
    // the right picture in the wrong place.
    expect(paintA).toHaveBeenCalledWith({ x: 0, y: 0, w: 400, h: 600 }, expect.anything());
    expect(paintB).not.toHaveBeenCalled();
  });

  it('stops calling a painter that unregisters', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(
      <Harness
        frames={frames}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    flushFrames();

    const paint = vi.fn();
    let off: (() => void) | undefined;
    act(() => {
      off = handle?.registerPainter('a', paint);
      handle?.invalidate('a');
    });
    flushFrames();
    expect(paint).toHaveBeenCalledTimes(1);

    act(() => {
      off?.();
      handle?.invalidate('a');
    });
    flushFrames();
    expect(paint).toHaveBeenCalledTimes(1);
  });

  /**
   * The surface owner resizes the shared buffer from inside `onFrame`, which
   * costs every tile its pixels. Both tests below are about the two ways that
   * loss goes unrepaired.
   */
  describe('when the buffer loses its contents', () => {
    it('keeps an invalidation the owner makes from inside onFrame', () => {
      let handle: SurfaceHandle | null = null;
      let claimAll = false;
      function Owner() {
        const surface = useTiledSurface({
          onFrame: () => {
            if (!claimAll) return;
            claimAll = false;
            // What `Lab` does after sizing the canvas: the buffer is blank, so
            // every tile owes a repaint, not only the one that moved.
            surface.invalidateAll();
          },
        });
        handle = surface;
        return (
          <div
            ref={(el) => {
              if (!el) return;
              stubBox(el, 0, 0, 800, 600);
              surface.containerRef(el);
            }}
          >
            <div ref={(el) => { if (!el) return; stubBox(el, 0, 0, 400, 600); surface.registerTile('a', el); }} />
            <div ref={(el) => { if (!el) return; stubBox(el, 400, 0, 400, 600); surface.registerTile('b', el); }} />
          </div>
        );
      }
      render(<Owner />);
      flushFrames();

      const paintA = vi.fn();
      act(() => {
        handle?.registerPainter('a', paintA);
        handle?.registerPainter('b', vi.fn());
      });
      flushFrames();
      paintA.mockClear();

      // Only b is dirty; the owner resizes the buffer during the frame, which
      // blanks a as well.
      claimAll = true;
      act(() => handle?.invalidate('b'));
      flushFrames();
      flushFrames();

      expect(paintA).toHaveBeenCalled();
    });

    it('tells the owner when the tile geometry changed, so it can clear', () => {
      const frames: SurfaceFrame[] = [];
      let handle: SurfaceHandle | null = null;
      const { getByTestId } = render(
        <Harness frames={frames} onHandle={(h) => { handle = h; }} />,
      );
      flushFrames();
      frames.length = 0;

      // A plain repaint leaves every tile where it was.
      act(() => handle?.invalidate('a'));
      flushFrames();
      expect(frames[0]?.retiled).toBe(false);
      frames.length = 0;

      // A tile moving strands its old pixels in the gutter; nothing but the
      // owner can clear those, and this is how it hears about it.
      stubBox(getByTestId('b'), 300, 0, 400, 600);
      act(() => handle?.invalidateRects());
      flushFrames();
      expect(frames[0]?.retiled).toBe(true);
    });

    it('runs every registered clear before any painter, and only on a re-tile', () => {
      const frames: SurfaceFrame[] = [];
      let handle: SurfaceHandle | null = null;
      const { getByTestId } = render(
        <Harness frames={frames} onHandle={(h) => { handle = h; }} />,
      );
      flushFrames();

      const order: string[] = [];
      const clearA = vi.fn(() => order.push('clearA'));
      const clearB = vi.fn(() => order.push('clearB'));
      act(() => {
        handle?.registerClear('a', clearA);
        handle?.registerClear('b', clearB);
        handle?.registerPainter('a', () => order.push('paintA'));
        handle?.registerPainter('b', () => order.push('paintB'));
      });
      flushFrames();
      order.length = 0;
      clearA.mockClear();

      // A repaint of one tile leaves every other tile's pixels valid.
      act(() => handle?.invalidate('a'));
      flushFrames();
      expect(clearA).not.toHaveBeenCalled();
      expect(order).toEqual(['paintA']);
      order.length = 0;

      stubBox(getByTestId('b'), 300, 0, 400, 600);
      act(() => handle?.invalidateRects());
      flushFrames();

      // Both tenants share the buffer, so both clears run — and a clear after
      // a painter would erase the tile that just drew.
      expect(order.slice(0, 2).sort()).toEqual(['clearA', 'clearB']);
      expect(order.slice(2).sort()).toEqual(['paintA', 'paintB']);
      expect(clearA).toHaveBeenCalledWith({ width: 800, height: 600 }, expect.any(Number));
    });

    it('keeps measuring while a tile is still moving, and stops when it settles', () => {
      const frames: SurfaceFrame[] = [];
      let handle: SurfaceHandle | null = null;
      const { getByTestId } = render(
        <Harness frames={frames} onHandle={(h) => { handle = h; }} />,
      );
      flushFrames();

      const seen: number[] = [];
      act(() => {
        handle?.registerPainter('b', (rect) => seen.push(rect.x));
      });

      // A panel whose size is already final but whose position is still
      // animating: `ResizeObserver` has nothing left to report, so the only
      // thing that can catch the last 60px is the surface measuring again.
      const b = getByTestId('b');
      const stops = [340, 370, 400, 400, 400];
      let call = 0;
      vi.spyOn(b, 'getBoundingClientRect').mockImplementation(() => {
        const left = stops[Math.min(call++, stops.length - 1)]!;
        return { left, top: 0, width: 400, height: 600, right: left + 400, bottom: 600, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
      });

      seen.length = 0;
      act(() => handle?.invalidateRects());
      // One flush per animation frame; nothing else invalidates in between.
      flushFrames();
      flushFrames();
      flushFrames();
      flushFrames();

      expect(seen.at(-1)).toBe(400);
    });

    it('stops calling a clear that unregisters', () => {
      const frames: SurfaceFrame[] = [];
      let handle: SurfaceHandle | null = null;
      const { getByTestId } = render(
        <Harness frames={frames} onHandle={(h) => { handle = h; }} />,
      );
      flushFrames();

      const clear = vi.fn();
      let off: (() => void) | undefined;
      act(() => { off = handle?.registerClear('a', clear); });
      stubBox(getByTestId('b'), 310, 0, 400, 600);
      act(() => handle?.invalidateRects());
      flushFrames();
      expect(clear).toHaveBeenCalledTimes(1);

      act(() => off?.());
      stubBox(getByTestId('b'), 320, 0, 400, 600);
      act(() => handle?.invalidateRects());
      flushFrames();
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });
});
