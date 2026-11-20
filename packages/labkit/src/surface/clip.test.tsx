/**
 * The arithmetic of cutting a tile to its clipping ancestors, with every box
 * stubbed: jsdom lays nothing out, so these prove which ancestors cut which
 * axis and that the surface reports the result — not that a browser's
 * `overflow` agrees. `AnnotationOverlay.clip.browser.test.tsx` is that check.
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clipToAncestors } from './clip';
import type { SurfaceFrame, SurfaceHandle } from './useTiledSurface';
import { useTiledSurface } from './useTiledSurface';

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

/** `outer > inner > tile`, attached, each with the overflow given. */
function nest(
  outer: string,
  inner: string,
): { outer: HTMLElement; inner: HTMLElement; tile: HTMLElement } {
  const a = document.createElement('div');
  const b = document.createElement('div');
  const c = document.createElement('div');
  a.style.cssText = outer;
  b.style.cssText = inner;
  a.append(b);
  b.append(c);
  document.body.append(a);
  return { outer: a, inner: b, tile: c };
}

// jsdom's computed style does not expand the `overflow` shorthand.
const BOTH = 'overflow-x: hidden; overflow-y: hidden';

afterEach(() => {
  document.body.replaceChildren();
});

describe('clipToAncestors', () => {
  const box = { left: 100, top: 100, width: 200, height: 100 };

  it('leaves a box alone under ancestors that clip nothing', () => {
    const { outer, tile } = nest('', '');
    stubBox(outer, 0, 0, 10, 10);
    expect(clipToAncestors(tile, box)).toEqual(box);
  });

  it('cuts to every clipping ancestor, not only the nearest', () => {
    const { outer, inner, tile } = nest(BOTH, 'overflow-x: auto; overflow-y: auto');
    stubBox(outer, 150, 0, 1000, 160);
    stubBox(inner, 0, 120, 250, 1000);
    expect(clipToAncestors(tile, box)).toEqual({ left: 150, top: 120, width: 100, height: 40 });
  });

  it('cuts only the axis an ancestor clips', () => {
    const { outer, inner, tile } = nest('overflow-x: clip', '');
    stubBox(outer, 150, 150, 50, 10);
    stubBox(inner, 0, 0, 1, 1);
    expect(clipToAncestors(tile, box)).toEqual({ left: 150, top: 100, width: 50, height: 100 });
  });

  it('climbs out of a shadow root to the clipping ancestors around its host', () => {
    const { outer, inner } = nest(BOTH, '');
    const root = inner.attachShadow({ mode: 'open' });
    const tile = document.createElement('div');
    root.append(tile);
    stubBox(outer, 150, 0, 1000, 1000);
    expect(clipToAncestors(tile, box)).toEqual({ left: 150, top: 100, width: 150, height: 100 });
  });

  it('follows a slotted element through its slot', () => {
    const { outer } = nest('', '');
    const host = document.createElement('div');
    outer.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const pane = document.createElement('div');
    pane.style.cssText = BOTH;
    pane.append(document.createElement('slot'));
    root.append(pane);
    const tile = document.createElement('div');
    host.append(tile);
    stubBox(pane, 0, 120, 1000, 40);
    expect(clipToAncestors(tile, box)).toEqual({ left: 100, top: 120, width: 200, height: 40 });
  });

  describe('at the root', () => {
    const root = document.documentElement;
    /** A viewport of 1000 × 800 under a document scrolled 500px down. */
    function scrolled(): void {
      Object.defineProperty(root, 'clientWidth', { configurable: true, value: 1000 });
      Object.defineProperty(root, 'clientHeight', { configurable: true, value: 800 });
      Object.defineProperty(root, 'offsetWidth', { configurable: true, value: 1000 });
      Object.defineProperty(root, 'offsetHeight', { configurable: true, value: 3000 });
      stubBox(root, 0, -500, 1000, 3000);
      stubBox(document.body, 0, -500, 1000, 0);
    }
    afterEach(() => {
      Reflect.deleteProperty(root, 'clientWidth');
      Reflect.deleteProperty(root, 'clientHeight');
      Reflect.deleteProperty(root, 'offsetWidth');
      Reflect.deleteProperty(root, 'offsetHeight');
      root.style.cssText = '';
      document.body.style.cssText = '';
      vi.restoreAllMocks();
    });
    const onScreen = { left: 100, top: 400, width: 200, height: 100 };

    it("cuts to the viewport, not the scrolled root's own box", () => {
      scrolled();
      root.style.cssText = 'overflow-x: hidden; overflow-y: scroll';
      const { tile } = nest('', '');
      expect(clipToAncestors(tile, onScreen)).toEqual(onScreen);
    });

    it("reads a body's overflow, handed to the viewport, as the viewport's", () => {
      scrolled();
      document.body.style.cssText = BOTH;
      const { tile } = nest('', '');
      expect(clipToAncestors(tile, onScreen)).toEqual(onScreen);
      expect(clipToAncestors(tile, { ...onScreen, top: 750 }).height).toBe(50);
    });
  });

  it('is zero-sized where nothing shows', () => {
    const { outer, tile } = nest(BOTH, '');
    stubBox(outer, 400, 0, 100, 1000);
    expect(clipToAncestors(tile, box).width).toBe(0);
  });
});

describe('useTiledSurface visible rects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const flush = (): void => {
    act(() => {
      vi.advanceTimersByTime(64);
    });
  };

  it('reports the cut rect beside the whole one, and re-tiles when only the cut moves', () => {
    const frames: SurfaceFrame[] = [];
    let viewport: HTMLElement | null = null;
    let handle: SurfaceHandle | null = null;
    function Harness() {
      const surface = useTiledSurface({ onFrame: (f) => frames.push(f) });
      handle = surface;
      return (
        <div
          ref={(el) => {
            if (!el) return;
            stubBox(el, 0, 0, 800, 600);
            surface.containerRef(el);
          }}
        >
          <div
            ref={(el) => {
              if (!el) return;
              el.style.overflowX = 'hidden';
              stubBox(el, 0, 0, 300, 600);
              viewport = el;
            }}
          >
            <div
              ref={(el) => {
                if (!el) return;
                stubBox(el, 200, 50, 400, 100);
                surface.registerTile('a', el);
              }}
            />
          </div>
        </div>
      );
    }
    render(<Harness />);
    flush();
    const first = frames.at(-1);
    expect(first?.rects.get('a')).toEqual({ x: 200, y: 50, width: 400, height: 100 });
    expect(first?.visible.get('a')).toEqual({ x: 200, y: 50, width: 100, height: 100 });

    // The viewport narrows past the tile, which has not moved.
    flush();
    const settled = frames.length;
    stubBox(viewport as unknown as HTMLElement, 0, 0, 150, 600);
    act(() => (handle as unknown as SurfaceHandle).invalidateRects());
    flush();
    const moved = frames[settled];
    expect(moved?.retiled).toBe(true);
    expect(moved?.rects.get('a')).toEqual({ x: 200, y: 50, width: 400, height: 100 });
    expect(moved?.visible.get('a')).toEqual({ x: 200, y: 50, width: 0, height: 100 });
  });
});
