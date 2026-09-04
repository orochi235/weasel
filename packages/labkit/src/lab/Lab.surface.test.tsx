/**
 * `useTiledSurface` was built, exported and tested, but nothing mounted a
 * `SurfaceContext` in production — so `useSurfaceOptional()` always answered
 * null and a tile registered from inside a trial reached nothing.
 *
 * The surface is anchored to `.lk-lab__body` rather than wrapped around the
 * workspace: `.lk-lab__body > .lk-workspace { min-width: 0 }` is a direct-child
 * selector, so an extra element between them silently drops that rule.
 */
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { SurfaceContext } from '../surface/SurfaceContext';
import { useSurfaceOptional, useSurfaceTile, useTileId } from '../surface/useSurfaceTile';
import type { SurfaceFrame, SurfaceHandle } from '../surface/useTiledSurface';
import { useTiledSurface } from '../surface/useTiledSurface';
import { Lab } from './Lab';

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

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let seen: SurfaceHandle | null | 'not-rendered' = 'not-rendered';
/** The key the probe's tile is actually registered under: a tile inside a
 *  trial is scoped by it, and the trial's id is minted by the store. */
let paneTileId = 'pane';

function Probe() {
  seen = useSurfaceOptional();
  paneTileId = useTileId('pane');
  const tile = useSurfaceTile('pane');
  return <div data-testid="pane" ref={tile} />;
}

const probeInstrument = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Probe',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Probe />,
});

describe('<Lab> surface provider', () => {
  it('puts a surface handle in reach of an instrument', () => {
    seen = 'not-rendered';
    render(<Lab instruments={[probeInstrument]} defaultInstrument="Probe" />);
    expect(seen).not.toBe('not-rendered');
    expect(seen).not.toBeNull();
    expect(typeof (seen as unknown as SurfaceHandle).registerTile).toBe('function');
  });

  it('mounts one inert buffer inside the lab body', () => {
    const { container } = render(<Lab instruments={[probeInstrument]} defaultInstrument="Probe" />);
    const canvases = container.querySelectorAll('.lk-lab__body > canvas.lk-lab__surface');
    expect(canvases).toHaveLength(1);
  });

  it('mounts no buffer of its own when a host already owns the surface', () => {
    function Host({ children }: { children: ReactNode }) {
      const surface = useTiledSurface({ onFrame: () => {} });
      return (
        <SurfaceContext.Provider value={surface}>
          <div ref={surface.containerRef}>{children}</div>
        </SurfaceContext.Provider>
      );
    }
    const { container } = render(
      <Host>
        <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />
      </Host>,
    );
    expect(container.querySelectorAll('canvas.lk-lab__surface')).toHaveLength(0);
  });

  it('keeps the workspace a direct child of the lab body', () => {
    // The min-width:0 rule that keeps the flex row from overflowing is
    // `.lk-lab__body > .lk-workspace`. An element inserted between them drops
    // it, and jsdom cannot see the overflow that follows.
    const { container } = render(<Lab instruments={[probeInstrument]} defaultInstrument="Probe" />);
    const body = container.querySelector('.lk-lab__body');
    expect(body).not.toBeNull();
    expect(body?.querySelector(':scope > .lk-workspace')).not.toBeNull();
  });
});

describe('<Lab> tile round trip', () => {
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

  it('publishes a rect for a tile an instrument registered', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;

    function Host({ children }: { children: ReactNode }) {
      const surface = useTiledSurface({ onFrame: (f) => frames.push(f) });
      handle = surface;
      return (
        <SurfaceContext.Provider value={surface}>
          <div
            ref={(el) => {
              if (!el) return;
              stubBox(el, 0, 0, 800, 600);
              surface.containerRef(el);
            }}
          >
            {children}
          </div>
        </SurfaceContext.Provider>
      );
    }

    render(
      <Host>
        <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />
      </Host>,
    );

    // The instrument's own div is the tile. Give it a box the container did
    // not have, so a rect composed against the wrong origin is visible.
    const pane = document.querySelector('[data-testid="pane"]') as HTMLElement;
    expect(pane).not.toBeNull();
    stubBox(pane, 240, 100, 320, 200);

    act(() => {
      handle?.invalidateRects();
      handle?.invalidate(paneTileId);
    });
    act(() => {
      vi.advanceTimersByTime(64);
    });

    // Assert the frame fired at all before asserting its contents — a test
    // that passes because nothing ran is the failure mode this arc keeps
    // hitting.
    expect(frames.length).toBeGreaterThan(0);
    expect(paneTileId).not.toBe('pane');
    const rect = frames[frames.length - 1]?.rects.get(paneTileId);
    expect(rect).toEqual({ x: 240, y: 100, w: 320, h: 200 });
  });
});
