import { fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CanvasStack } from './CanvasStack';
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
