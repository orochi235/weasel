/**
 * `useTiledSurface` was built, exported and tested, but nothing mounted a
 * `SurfaceContext` in production — so `useSurfaceOptional()` always answered
 * null and a tile registered from inside a trial reached nothing.
 *
 * The surface's layers sit in `.lk-lab__body` beside the workspace rather than
 * wrapped around it: `.lk-lab__body > .lk-workspace-host { min-width: 0 }` is a
 * direct-child selector, so an extra element between them silently drops that
 * rule.
 */
import { act } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { type ReactNode, useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import {
  useSurfaceCanvas,
  useSurfaceOptional,
  useSurfaceTile,
  useTileId,
} from '../surface/useSurfaceTile';
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

interface SeenCanvases {
  over: HTMLCanvasElement | null;
  under: HTMLCanvasElement | null;
  byDefault: HTMLCanvasElement | null;
}
let seenCanvases: SeenCanvases = { over: null, under: null, byDefault: null };

function Probe() {
  seen = useSurfaceOptional();
  paneTileId = useTileId('pane');
  seenCanvases = {
    over: useSurfaceCanvas('over'),
    under: useSurfaceCanvas('under'),
    byDefault: useSurfaceCanvas(),
  };
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
  it('puts a surface handle in reach of an instrument', async () => {
    seen = 'not-rendered';
    await renderSettled(<Lab instruments={[probeInstrument]} defaultInstrument="Probe" />, {
      wrapper: withIcons,
    });
    expect(seen).not.toBe('not-rendered');
    expect(seen).not.toBeNull();
    expect(typeof (seen as unknown as SurfaceHandle).registerTile).toBe('function');
  });

  it('stacks an under and an over buffer, each in its own layer of the lab body', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />,
      { wrapper: withIcons },
    );
    const layers = container.querySelectorAll('.lk-lab__body > .lk-lab__layer');
    // Source order, because the z-index that separates them is in a stylesheet
    // jsdom does not resolve — this is a proxy for the stacking, not proof of
    // it. The real check is a browser.
    expect([...layers].map((l) => l.className)).toEqual([
      'lk-lab__layer lk-lab__layer--under',
      'lk-lab__layer lk-lab__layer--over',
    ]);
    for (const layer of layers)
      expect(layer.querySelector('canvas.lk-lab__surface')).not.toBeNull();
  });

  it('measures tile rects against the over layer', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />,
      { wrapper: withIcons },
    );
    expect((seen as SurfaceHandle).getContainer()).toBe(
      container.querySelector('.lk-lab__layer--over'),
    );
  });

  it('hands a tenant whichever of the two it asks for', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />,
      { wrapper: withIcons },
    );
    const [underEl, overEl] = [...container.querySelectorAll('canvas.lk-lab__surface')];
    expect(seenCanvases.over).toBe(overEl);
    expect(seenCanvases.under).toBe(underEl);
    expect(overEl).not.toBe(underEl);
  });

  it('defaults a tenant to the buffer over the trials', async () => {
    // Every tenant predating the split wants the over one: the surface was
    // built for marks that annotate an instrument.
    const { container } = await renderSettled(
      <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />,
      { wrapper: withIcons },
    );
    const [underEl, overEl] = [...container.querySelectorAll('canvas.lk-lab__surface')];
    expect(seenCanvases.byDefault).toBe(overEl);
    expect(seenCanvases.byDefault).not.toBe(underEl);
  });

  it('mounts no buffer of its own when a host already owns the surface', async () => {
    function Host({ children }: { children: ReactNode }) {
      const surface = useTiledSurface({ onFrame: () => {} });
      return (
        <SurfaceContext.Provider value={surface}>
          <div ref={surface.containerRef}>{children}</div>
        </SurfaceContext.Provider>
      );
    }
    const { container } = await renderSettled(
      <Host>
        <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />
      </Host>,
      { wrapper: withIcons },
    );
    expect(container.querySelectorAll('canvas.lk-lab__surface')).toHaveLength(0);
  });

  it('keeps the workspace host a direct child of the lab body', async () => {
    // The min-width:0 rule that keeps the flex row from overflowing is
    // `.lk-lab__body > .lk-workspace-host`. An element inserted between them
    // drops it, and jsdom cannot see the overflow that follows.
    const { container } = await renderSettled(
      <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />,
      { wrapper: withIcons },
    );
    const body = container.querySelector('.lk-lab__body');
    expect(body).not.toBeNull();
    expect(body?.querySelector(':scope > .lk-workspace-host > .lk-workspace')).not.toBeNull();
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

  it('publishes a rect for a tile an instrument registered', async () => {
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

    await renderSettled(
      <Host>
        <Lab instruments={[probeInstrument]} defaultInstrument="Probe" />
      </Host>,
      { wrapper: withIcons },
    );

    // The instrument's own div is the tile. Give it a box the container did
    // not have, so a rect composed against the wrong origin is visible.
    const pane = document.querySelector('[data-testid="pane"]') as HTMLElement;
    expect(pane).not.toBeNull();
    stubBox(pane, 240, 100, 320, 200);

    await act(async () => {
      handle?.invalidateRects();
      handle?.invalidate(paneTileId);
    });
    await act(async () => {
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

describe('<Lab> under an owner that offers no top buffer', () => {
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

  let top: HTMLCanvasElement | null = null;
  const topInstrument = defineInstrument<Record<string, never>, Record<string, never>>({
    name: 'Top',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: function TopProbe() {
      top = useSurfaceCanvas('top');
      return null;
    },
  });

  /** Publishes `over` and `under` only, as a host with no whole-surface tenant of its own would. */
  function Host({ children }: { children: ReactNode }) {
    const surface = useTiledSurface({ onFrame: () => {} });
    const [canvases] = useState(() => ({
      over: document.createElement('canvas'),
      under: document.createElement('canvas'),
    }));
    return (
      <SurfaceContext.Provider value={surface}>
        <SurfaceCanvasContext.Provider value={canvases}>
          <div
            data-testid="host"
            ref={(el) => {
              if (!el) return;
              stubBox(el, 0, 0, 800, 600);
              surface.containerRef(el);
            }}
          >
            {children}
          </div>
        </SurfaceCanvasContext.Provider>
      </SurfaceContext.Provider>
    );
  }

  it("makes its own top buffer on the host's surface, sized to it", async () => {
    top = null;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByTestId } = await renderSettled(
      <Host>
        <Lab instruments={[topInstrument]} defaultInstrument="Top" />
      </Host>,
      { wrapper: withIcons },
    );
    await act(async () => {
      vi.advanceTimersByTime(64);
    });
    // Assigned in a render, so TS narrows it to the null set above.
    const seenTop = top as HTMLCanvasElement | null;
    expect(seenTop).not.toBeNull();
    // On the host's container, which is what the tiles' rects are measured against.
    expect(seenTop?.parentElement).toBe(getByTestId('host'));
    expect([seenTop?.width, seenTop?.height]).toEqual([800, 600]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('<Lab> pages', () => {
  it("gives the title a way back to the project's other labs", async () => {
    const { getByRole } = await renderSettled(
      <Lab
        instruments={[probeInstrument]}
        defaultInstrument="Probe"
        title="kliegsminister"
        path="/kliegsminister"
        pages={[
          { href: '/kliegsminister', label: 'kliegsminister' },
          { href: '/stats', label: 'corpus stats' },
        ]}
      />,
      { wrapper: withIcons },
    );
    // A switcher, not a bare heading: the lab it came from has to be reachable.
    expect(getByRole('button', { name: /kliegsminister/ })).toBeTruthy();
  });

  it('leaves the title a plain heading when there are no other labs', async () => {
    const { getByRole, queryByRole } = await renderSettled(
      <Lab instruments={[probeInstrument]} defaultInstrument="Probe" title="solo" />,
      { wrapper: withIcons },
    );
    expect(getByRole('heading', { name: 'solo' })).toBeTruthy();
    expect(queryByRole('button', { name: /solo/ })).toBeNull();
  });
});
