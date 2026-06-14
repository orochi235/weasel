import { render } from '@testing-library/react';
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
});
