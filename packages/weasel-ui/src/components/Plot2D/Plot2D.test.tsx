import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { Plot2D, type Plot2DHandle } from './Plot2D';

describe('Plot2D — rendering', () => {
  it('renders an svg with the configured width/height/viewBox', () => {
    const { container } = render(<Plot2D width={200} height={100} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('200');
    expect(svg.getAttribute('height')).toBe('100');
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 100');
  });

  it('renders grid lines when grid is set', () => {
    const { container } = render(<Plot2D width={200} height={100} grid={{}} />);
    expect(container.querySelectorAll('[data-plot-element="grid"]').length).toBe(6);
  });

  it('honors grid.divisions', () => {
    const { container } = render(
      <Plot2D width={200} height={100} grid={{ divisions: 5 }} />,
    );
    expect(container.querySelectorAll('[data-plot-element="grid"]').length).toBe(10);
  });

  it('renders no grid when grid is false / null / omitted', () => {
    for (const grid of [undefined, false as const, null]) {
      const { container } = render(<Plot2D width={200} height={100} grid={grid} />);
      expect(container.querySelectorAll('[data-plot-element="grid"]').length).toBe(0);
    }
  });

  it('renders axes by default', () => {
    const { container } = render(<Plot2D width={200} height={100} />);
    expect(container.querySelectorAll('[data-plot-element="axis"]').length).toBe(2);
  });

  it('renders no axes when axes={false}', () => {
    const { container } = render(<Plot2D width={200} height={100} axes={false} />);
    expect(container.querySelectorAll('[data-plot-element="axis"]').length).toBe(0);
  });

  it('renders children inside the svg', () => {
    const { container } = render(
      <Plot2D width={200} height={100}>
        <circle data-testid="child" cx={10} cy={10} r={3} />
      </Plot2D>,
    );
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });
});

describe('Plot2D — ref handle', () => {
  it('exposes working plotToModel / modelToPlot', () => {
    const ref = createRef<Plot2DHandle>();
    render(<Plot2D ref={ref} width={200} height={100} />);
    const h = ref.current!;
    // (0, height) plot = (0, 0) model (bottom-left).
    const m = h.plotToModel({ x: 0, y: 100 });
    expect(m.x).toBeCloseTo(0, 6);
    expect(m.y).toBeCloseTo(0, 6);
    // (200, 0) plot = (1, 1) model (top-right).
    const m2 = h.plotToModel({ x: 200, y: 0 });
    expect(m2.x).toBeCloseTo(1, 6);
    expect(m2.y).toBeCloseTo(1, 6);
    // Round-trip.
    const p = h.modelToPlot({ x: 0.5, y: 0.5 });
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(50, 6);
  });

  it('exposes width and height', () => {
    const ref = createRef<Plot2DHandle>();
    render(<Plot2D ref={ref} width={200} height={100} />);
    expect(ref.current!.width).toBe(200);
    expect(ref.current!.height).toBe(100);
  });

  it('clientToPlot subtracts the svg rect origin', () => {
    const ref = createRef<Plot2DHandle>();
    render(<Plot2D ref={ref} width={200} height={100} />);
    const svg = ref.current!.svg!;
    // jsdom returns 0,0,0,0 for getBoundingClientRect by default; mock.
    svg.getBoundingClientRect = () => ({
      left: 10, top: 20, right: 210, bottom: 120,
      width: 200, height: 100, x: 10, y: 20, toJSON: () => ({}),
    });
    const p = ref.current!.clientToPlot({ clientX: 30, clientY: 50 });
    expect(p.x).toBeCloseTo(20, 6);
    expect(p.y).toBeCloseTo(30, 6);
  });

  it('honors xRange / yRange in the transforms', () => {
    const ref = createRef<Plot2DHandle>();
    render(
      <Plot2D ref={ref} width={200} height={100} xRange={[-5, 5]} yRange={[0, 100]} />,
    );
    const h = ref.current!;
    const m = h.plotToModel({ x: 100, y: 50 });
    expect(m.x).toBeCloseTo(0, 6);
    expect(m.y).toBeCloseTo(50, 6);
  });
});

describe('Plot2D — pointer forwarding', () => {
  it('passes plot + model coords to onPointerDown', () => {
    const onPointerDown = vi.fn();
    const { container } = render(
      <Plot2D width={200} height={100} onPointerDown={onPointerDown} />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    const coords = onPointerDown.mock.calls[0][1];
    // Default rect origin is (0,0) in jsdom — plot coords equal client coords.
    expect(coords.plot.x).toBeCloseTo(100, 6);
    expect(coords.plot.y).toBeCloseTo(50, 6);
    // Default ranges [0,1] — model (0.5, 0.5).
    expect(coords.model.x).toBeCloseTo(0.5, 6);
    expect(coords.model.y).toBeCloseTo(0.5, 6);
  });
});
