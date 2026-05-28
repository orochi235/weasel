import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

describe('CurveEditor — rendering', () => {
  it('renders an SVG with the configured width and height', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('200');
    expect(svg!.getAttribute('height')).toBe('100');
  });

  it('renders one circle per control point', () => {
    const value: ControlPoint[] = [
      { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 },
    ];
    const { container } = render(
      <CurveEditor value={value} onChange={() => {}} width={200} height={100} />,
    );
    const circles = container.querySelectorAll('[data-anchor-index]');
    expect(circles.length).toBe(3);
  });

  it('renders a path element for the curve when there are >= 2 anchors', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).toMatch(/^M/);
  });

  it('renders no path when fewer than 2 anchors', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0.5, y: 0.5 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    expect(container.querySelector('path')).toBeNull();
    expect(container.querySelectorAll('[data-anchor-index]').length).toBe(1);
  });
});

describe('CurveEditor — drag', () => {
  it('fires onChange when an anchor is dragged', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={onChange}
        width={200}
        height={100}
      />,
    );
    const circles = container.querySelectorAll('[data-anchor-index]');
    const middle = circles[1] as Element;

    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 30, pointerId: 1 });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(3);
    expect(lastCall[1].x).not.toBe(0.5);
  });

  it('fires onChangeCommit once with (next, prev) on pointerup', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const initial = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
    const { container } = render(
      <CurveEditor
        value={initial}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;

    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 120, clientY: 30, pointerId: 1 });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next, prev] = onChangeCommit.mock.calls[0];
    expect(prev).toEqual(initial);
    expect(next[1].x).not.toBe(0.5);
  });

  it('clamps x between neighbors in 1D mode', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={onChange}
        domain="1d"
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[1].x).toBeLessThanOrEqual(1.0);
    expect(last[1].x).toBeGreaterThanOrEqual(0);
  });

  it('does NOT clamp x to neighbors in 2D mode (still clamps to canvas)', () => {
    const onChange = vi.fn();
    // Use a configuration where the right neighbor is at 0.8 — well
    // inside the [0, 1] canvas range — so we can distinguish
    // neighbor-clamping (1D) from canvas-clamping (always).
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.4, y: 0.4 }, { x: 0.8, y: 0.8 }]}
        onChange={onChange}
        domain="2d"
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // In 2D, the middle anchor can exceed the right neighbor's x (0.8)…
    expect(last[1].x).toBeGreaterThan(0.8);
    // …but is still clamped to the canvas's xMax (1.0).
    expect(last[1].x).toBeLessThanOrEqual(1.0);
  });
});

describe('CurveEditor — add and delete', () => {
  it('adds an anchor on empty-plot click when addPointMode="click-empty"', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        addPointMode="click-empty"
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 2 });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next] = onChangeCommit.mock.calls[0];
    expect(next).toHaveLength(3);
  });

  it('adds an anchor on curve click when addPointMode="click-curve"', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        addPointMode="click-curve"
        width={200}
        height={100}
      />,
    );
    // Click near the middle of the curve (which is on the y=x line for a
    // two-anchor [(0,0),(1,1)] curve, so model (0.5, 0.5) is plot (100, 50)).
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 3 });
    // After pointerDown alone, onChange has fired (insertion + drag-in-progress)
    // but commit waits for pointerUp.
    expect(onChange).toHaveBeenCalled();
    expect(onChangeCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 100, clientY: 50, pointerId: 3 });
    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next] = onChangeCommit.mock.calls[0];
    expect(next).toHaveLength(3);
  });

  it('does not add on click when addPointMode="never"', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        addPointMode="never"
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 4 });

    expect(onChangeCommit).not.toHaveBeenCalled();
  });

  it('inserts at x-sorted index in 1D mode (click-empty)', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        domain="1d"
        addPointMode="click-empty"
        width={200}
        height={100}
      />,
    );
    // Click at plot (50, 50) → model (0.25, 0.5). Should insert at index 1.
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 50, pointerId: 5 });

    const [next] = onChangeCommit.mock.calls[0];
    expect(next[1].x).toBeCloseTo(0.25, 2);
    expect(next).toHaveLength(3);
  });

  it('refuses to delete when at minPoints floor', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        minPoints={3}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 50, shiftKey: true });
    expect(onChangeCommit).not.toHaveBeenCalled();
  });

  it('refuses to add when at maxPoints ceiling', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        addPointMode="click-empty"
        maxPoints={2}
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 51 });
    expect(onChangeCommit).not.toHaveBeenCalled();
  });

  it('deletes an anchor on shift+click', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, {
      clientX: 100, clientY: 50, pointerId: 6, shiftKey: true,
    });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next] = onChangeCommit.mock.calls[0];
    expect(next).toHaveLength(2);
    expect(next).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });
});

describe('CurveEditor — endpoint constraints', () => {
  it('pinned-x: first anchor x locked to xRange[0]', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        endpoints="pinned-x"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 0, clientY: 100, pointerId: 7 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 30, pointerId: 7 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].x).toBe(0);   // x clamped to xRange[0]
    expect(last[0].y).not.toBe(0); // y is editable
  });

  it('pinned-both: first anchor stays at the corner', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        endpoints="pinned-both"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 0, clientY: 100, pointerId: 8 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 30, pointerId: 8 });

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].x).toBe(0);
    expect(last[0].y).toBe(0);
  });

  it('pinned endpoints cannot be deleted via shift+click', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        endpoints="pinned-x"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, {
      clientX: 0, clientY: 100, pointerId: 9, shiftKey: true,
    });
    expect(onChangeCommit).not.toHaveBeenCalled();
  });

  it('renders pinned endpoints with the pinned visual class', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        endpoints="pinned-both"
        width={200}
        height={100}
      />,
    );
    const circles = container.querySelectorAll('[data-anchor-index]');
    expect(circles[0].getAttribute('class')).toMatch(/pinned/);
    expect(circles[2].getAttribute('class')).toMatch(/pinned/);
    expect(circles[1].getAttribute('class')).not.toMatch(/pinned/);
  });
});

describe('CurveEditor — visual chrome', () => {
  it('renders grid lines when grid is an object', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        grid={{}}
        width={200}
        height={100}
      />,
    );
    const gridLines = container.querySelectorAll('[data-curve-element="grid"]');
    expect(gridLines.length).toBeGreaterThan(0);
  });

  it('omits grid lines when grid is omitted, false, or null', () => {
    for (const grid of [undefined, false as const, null]) {
      const { container } = render(
        <CurveEditor
          value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
          onChange={() => {}}
          grid={grid}
          width={200}
          height={100}
        />,
      );
      expect(container.querySelectorAll('[data-curve-element="grid"]').length).toBe(0);
    }
  });

  it('honors grid.divisions count', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        grid={{ divisions: 5 }}
        width={200}
        height={100}
      />,
    );
    // 5 divisions × 2 axes = 10 internal grid lines.
    const gridLines = container.querySelectorAll('[data-curve-element="grid"]');
    expect(gridLines.length).toBe(10);
  });

  it('renders axis lines by default', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const axes = container.querySelectorAll('[data-curve-element="axis"]');
    expect(axes.length).toBe(2);
  });

  it('omits axis lines when axes is false or null', () => {
    for (const axes of [false as const, null]) {
      const { container } = render(
        <CurveEditor
          value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
          onChange={() => {}}
          axes={axes}
          width={200}
          height={100}
        />,
      );
      expect(container.querySelectorAll('[data-curve-element="axis"]').length).toBe(0);
    }
  });

  it('renders a fill path in 1D mode when fill is configured', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        domain="1d"
        fill={{ side: 'below' }}
        width={200}
        height={100}
      />,
    );
    const fillEl = container.querySelector('[data-curve-element="fill"]');
    expect(fillEl).not.toBeNull();
    const d = fillEl!.getAttribute('d')!;
    expect(d).toMatch(/^M/);
    expect(d).toMatch(/Z$/);
  });

  it('renders fill in 2D mode as well (closes along the chosen edge)', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        domain="2d"
        fill={{ side: 'below' }}
        width={200}
        height={100}
      />,
    );
    const fillEl = container.querySelector('[data-curve-element="fill"]');
    expect(fillEl).not.toBeNull();
  });

  it('omits fill when fill is false, null, or omitted', () => {
    for (const fill of [undefined, false as const, null]) {
      const { container } = render(
        <CurveEditor
          value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
          onChange={() => {}}
          domain="1d"
          fill={fill}
          width={200}
          height={100}
        />,
      );
      expect(container.querySelector('[data-curve-element="fill"]')).toBeNull();
    }
  });

  it('marks the dragged anchor with the active class', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1];
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 10 });
    expect(middle.getAttribute('class')).toMatch(/active/);
    fireEvent.pointerUp(window, { clientX: 100, clientY: 50, pointerId: 10 });
    expect(middle.getAttribute('class')).not.toMatch(/active/);
  });
});
