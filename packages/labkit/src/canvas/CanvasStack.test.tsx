import { act, fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { backingDensity, CanvasStack } from './CanvasStack';
import type { CanvasLayerDescriptor } from './useLayerScheduler';

beforeAll(() => {
  // jsdom's <canvas>.getContext returns null by default; stub a minimal 2D context.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  })) as unknown as HTMLCanvasElement['getContext'];
});

function makeLayers(count: number): CanvasLayerDescriptor[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `layer-${i}`,
    visible: true,
    render: vi.fn(),
  }));
}

describe('<CanvasStack>', () => {
  it('renders one canvas per layer', () => {
    const { container } = render(
      <CanvasStack
        layers={makeLayers(3)}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('canvas')).toHaveLength(3);
  });

  it('calls render functions for visible layers', async () => {
    const layers = makeLayers(2);
    render(
      <CanvasStack
        layers={layers}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
      />,
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(layers[0]?.render).toHaveBeenCalled();
    expect(layers[1]?.render).toHaveBeenCalled();
  });

  it('does not call render for invisible layers', async () => {
    const layers = makeLayers(2);
    if (layers[1]) layers[1].visible = false;
    render(
      <CanvasStack
        layers={layers}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
      />,
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(layers[0]?.render).toHaveBeenCalled();
    expect(layers[1]?.render).not.toHaveBeenCalled();
  });

  it('renders overlay children', () => {
    const { getByText } = render(
      <CanvasStack
        layers={makeLayers(1)}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
      >
        <span>overlay-content</span>
      </CanvasStack>,
    );
    expect(getByText('overlay-content')).toBeInTheDocument();
  });

  it('hit-tests through the declared world spec', () => {
    const rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      rect as unknown as DOMRect,
    );
    const onHitTest = vi.fn();
    const { container } = render(
      <CanvasStack
        layers={makeLayers(1)}
        view={{ zoom: 2, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
        worldSpec={{ origin: { x: 0.5, y: 0.5 }, yAxis: 'up' }}
        onHitTest={onHitTest}
      />,
    );
    const host = container.querySelector('.lk-canvas-stack');
    if (!host) throw new Error('no stack host');
    fireEvent.pointerDown(host, { button: 0, pointerId: 1, clientX: 500, clientY: 200 });
    fireEvent.pointerUp(host, { pointerId: 1, clientX: 500, clientY: 200 });

    // Origin is (400,300); the cursor is 100px right of it and 100px above it,
    // at zoom 2 with y running up.
    expect(onHitTest).toHaveBeenCalledWith({ x: 50, y: 50 });
    vi.restoreAllMocks();
  });
});

describe('<CanvasStack> backing size', () => {
  // jsdom has no `matchMedia`, so the stand-in below is what fires; `Lab.density.browser.test`
  // has a real one.
  it('resizes its canvases when the dpr changes and the box did not', () => {
    const rect = { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      rect as unknown as DOMRect,
    );
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      matches: true,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
    vi.stubGlobal('devicePixelRatio', 1);
    const { container } = render(
      <CanvasStack
        layers={makeLayers(1)}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
      />,
    );
    const canvas = container.querySelector('canvas');
    expect([canvas?.width, canvas?.height]).toEqual([200, 100]);

    vi.stubGlobal('devicePixelRatio', 2);
    act(() => {
      for (const fn of [...listeners]) fn();
    });
    expect([canvas?.width, canvas?.height]).toEqual([400, 200]);

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});

describe('<CanvasStack> under a scaled ancestor', () => {
  it('keeps its layout size and puts the scale into the backing density', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 400,
      right: 800,
      bottom: 400,
    } as unknown as DOMRect);
    // The layout box, as an observer reports it: a quarter of the client rect the ancestor's scale draws.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly fn: ResizeObserverCallback) {}
        observe() {
          const entry = { contentRect: { width: 200, height: 100 } } as ResizeObserverEntry;
          this.fn([entry], this as unknown as ResizeObserver);
        }
        disconnect() {}
      },
    );
    vi.stubGlobal('devicePixelRatio', 2);
    const { container } = render(
      <CanvasStack
        layers={makeLayers(1)}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
      />,
    );
    const canvas = container.querySelector('canvas');
    expect([canvas?.style.width, canvas?.style.height]).toEqual(['200px', '100px']);
    expect([canvas?.width, canvas?.height]).toEqual([1600, 800]);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('caps the density a large magnification asks for, never below the display', () => {
    expect(backingDensity(200, 100, 2, 4)).toBe(8);
    expect(backingDensity(2000, 2000, 2, 8)).toBeCloseTo(2.048);
    expect(backingDensity(8000, 8000, 2, 4)).toBe(2);
    expect(backingDensity(200, 100, 2, 0.5)).toBe(1);
  });
});

describe('<CanvasStack> zoom invariant', () => {
  it('hit-tests a view that arrived with zoom 0 to a finite world point', () => {
    const rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      rect as unknown as DOMRect,
    );
    const onHitTest = vi.fn();
    const { container } = render(
      <CanvasStack
        layers={makeLayers(1)}
        view={{ zoom: 0, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
        onHitTest={onHitTest}
      />,
    );
    const host = container.querySelector('.lk-canvas-stack');
    if (!host) throw new Error('no stack host');
    fireEvent.pointerDown(host, { button: 0, pointerId: 1, clientX: 500, clientY: 200 });
    fireEvent.pointerUp(host, { pointerId: 1, clientX: 500, clientY: 200 });
    const world = onHitTest.mock.calls.at(-1)?.[0] as { x: number; y: number };
    expect(Number.isFinite(world.x) && Number.isFinite(world.y)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('<CanvasStack ticks>', () => {
  it('repaints only the timed layers on a tick', async () => {
    const still: CanvasLayerDescriptor = { id: 'still', visible: true, render: vi.fn() };
    const moving: CanvasLayerDescriptor = {
      id: 'moving',
      visible: true,
      timed: true,
      render: vi.fn(),
    };
    const listeners = new Set<() => void>();
    const ticks = (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    };
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    render(
      <CanvasStack
        layers={[still, moving]}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
        ticks={ticks}
      />,
    );
    await nextFrame();
    vi.mocked(still.render).mockClear();
    vi.mocked(moving.render).mockClear();
    for (const fn of listeners) fn();
    await nextFrame();
    expect(moving.render).toHaveBeenCalledTimes(1);
    expect(still.render).not.toHaveBeenCalled();
  });
});
