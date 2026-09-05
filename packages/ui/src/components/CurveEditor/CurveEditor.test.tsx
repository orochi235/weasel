import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

describe('CurveEditor — rendering', () => {
  it('renders an SVG with the configured width and height', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
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
      <CurveEditor value={value} onInput={() => {}} width={200} height={100} />,
    );
    const circles = container.querySelectorAll('[data-anchor-index]');
    expect(circles.length).toBe(3);
  });

  it('renders a path element for the curve when there are >= 2 anchors', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
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
        onInput={() => {}}
        width={200}
        height={100}
      />,
    );
    expect(container.querySelector('path')).toBeNull();
    expect(container.querySelectorAll('[data-anchor-index]').length).toBe(1);
  });
});

describe('CurveEditor — drag', () => {
  it('fires onInput when an anchor is dragged', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onInput={onInput}
        width={200}
        height={100}
      />,
    );
    const circles = container.querySelectorAll('[data-anchor-index]');
    const middle = circles[1] as Element;

    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1 });

    expect(onInput).toHaveBeenCalled();
    const lastCall = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(3);
    expect(lastCall[1].x).not.toBe(0.5);
  });

  it('fires onChange once with (next, prev) on pointerup', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const initial = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
    const { container } = render(
      <CurveEditor
        value={initial}
        onInput={onInput}
        onChange={onChange}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;

    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 120, clientY: 30, pointerId: 1 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, prev] = onChange.mock.calls[0];
    expect(prev).toEqual(initial);
    expect(next[1].x).not.toBe(0.5);
  });

  it('clamps x between neighbors in 1D mode', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onInput={onInput}
        domain="1d"
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[1].x).toBeLessThanOrEqual(1.0);
    expect(last[1].x).toBeGreaterThanOrEqual(0);
  });

  it('does NOT clamp x to neighbors in 2D mode (still clamps to canvas)', () => {
    const onInput = vi.fn();
    // Use a configuration where the right neighbor is at 0.8 — well
    // inside the [0, 1] canvas range — so we can distinguish
    // neighbor-clamping (1D) from canvas-clamping (always).
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.4, y: 0.4 }, { x: 0.8, y: 0.8 }]}
        onInput={onInput}
        domain="2d"
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    // In 2D, the middle anchor can exceed the right neighbor's x (0.8)…
    expect(last[1].x).toBeGreaterThan(0.8);
    // …but is still clamped to the canvas's xMax (1.0).
    expect(last[1].x).toBeLessThanOrEqual(1.0);
  });

  // Regression: when modelRange has yMin > yMax (e.g. yRange=[100,0] for
  // SVG-style coords), the final clamp `Math.max(yMin, Math.min(yMax, ny))`
  // collapses every drag to the same value. Same for inverted xRange.
  it('clamps dragged anchors to the visible plot with inverted yRange', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 50 }, { x: 1, y: 50 }]}
        onInput={onInput}
        xRange={[0, 1]}
        yRange={[100, 0]}
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    // Move the pointer to the middle of the plot vertically. In an
    // inverted yRange, plotY=30 corresponds to modelY=30 (not 100).
    fireEvent.pointerDown(first, { clientX: 0, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 30, pointerId: 1 });

    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].y).toBeGreaterThanOrEqual(0);
    expect(last[0].y).toBeLessThanOrEqual(100);
    // The pre-fix bug snapped y to 100 (yMax under the old non-normalised
    // clamp). Verify the new value reflects the pointer position.
    expect(last[0].y).toBeLessThan(100);
    expect(last[0].y).toBeGreaterThan(0);
  });

  it('clamps dragged anchors to the visible plot with inverted xRange', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }]}
        onInput={onInput}
        xRange={[1, 0]}
        yRange={[0, 1]}
        width={200}
        height={100}
        domain="2d"
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 100, pointerId: 1 });

    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].x).toBeGreaterThanOrEqual(0);
    expect(last[0].x).toBeLessThanOrEqual(1);
    // The pre-fix bug snapped x to 1 (xMin under the old non-normalised
    // clamp, since min > max collapses).
    expect(last[0].x).toBeLessThan(1);
    expect(last[0].x).toBeGreaterThan(0);
  });

  it('drags past the plot clamp to the correct edge under inverted yRange', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 50 }, { x: 1, y: 50 }]}
        onInput={onInput}
        xRange={[0, 1]}
        yRange={[100, 0]}
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    // Drag way above the plot — clamp should hit yHi=100 (not collapse).
    fireEvent.pointerDown(first, { clientX: 0, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: -500, pointerId: 1 });
    let last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].y).toBeLessThanOrEqual(100);
    expect(last[0].y).toBeGreaterThanOrEqual(0);

    // Drag way below — clamp should hit yLo=0.
    fireEvent.pointerMove(document, { clientX: 0, clientY: 600, pointerId: 1 });
    last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].y).toBeLessThanOrEqual(100);
    expect(last[0].y).toBeGreaterThanOrEqual(0);
  });
});

describe('CurveEditor — add and delete', () => {
  it('adds an anchor on empty-plot click when addPointMode="click-empty"', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={onInput}
        onChange={onChange}
        addPointMode="click-empty"
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 2 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0];
    expect(next).toHaveLength(3);
  });

  it('adds an anchor on curve click when addPointMode="click-curve"', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={onInput}
        onChange={onChange}
        addPointMode="click-curve"
        width={200}
        height={100}
      />,
    );
    // Click near the middle of the curve (which is on the y=x line for a
    // two-anchor [(0,0),(1,1)] curve, so model (0.5, 0.5) is plot (100, 50)).
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 3 });
    // After pointerDown alone, onInput has fired (insertion + drag-in-progress)
    // but commit waits for pointerUp.
    expect(onInput).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(document, { clientX: 100, clientY: 50, pointerId: 3 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0];
    expect(next).toHaveLength(3);
  });

  it('does not add on click when addPointMode="never"', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        onChange={onChange}
        addPointMode="never"
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 4 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('inserts at x-sorted index in 1D mode (click-empty)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        onChange={onChange}
        domain="1d"
        addPointMode="click-empty"
        width={200}
        height={100}
      />,
    );
    // Click at plot (50, 50) → model (0.25, 0.5). Should insert at index 1.
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 50, pointerId: 5 });

    const [next] = onChange.mock.calls[0];
    expect(next[1].x).toBeCloseTo(0.25, 2);
    expect(next).toHaveLength(3);
  });

  it('refuses to delete when at minPoints floor', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        onChange={onChange}
        minPoints={3}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 50, shiftKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses to add when at maxPoints ceiling', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        onChange={onChange}
        addPointMode="click-empty"
        maxPoints={2}
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 51 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes an anchor on shift+click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        onChange={onChange}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, {
      clientX: 100, clientY: 50, pointerId: 6, shiftKey: true,
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0];
    expect(next).toHaveLength(2);
    expect(next).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });
});

describe('CurveEditor — endpoint constraints', () => {
  it('pinned-x: first anchor x locked to xRange[0]', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={onInput}
        endpoints="pinned-x"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 0, clientY: 100, pointerId: 7 });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 30, pointerId: 7 });

    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].x).toBe(0);   // x clamped to xRange[0]
    expect(last[0].y).not.toBe(0); // y is editable
  });

  it('pinned-both: an endpoint away from the corner holds its own position', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0.3 }, { x: 1, y: 0.8 }]}
        onInput={onInput}
        endpoints="pinned-both"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 0, clientY: 70, pointerId: 9 });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 30, pointerId: 9 });

    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].x).toBeCloseTo(0, 6);
    expect(last[0].y).toBeCloseTo(0.3, 6);
  });

  it('pinned-both: first anchor stays at the corner', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={onInput}
        endpoints="pinned-both"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 0, clientY: 100, pointerId: 8 });
    fireEvent.pointerMove(document, { clientX: 60, clientY: 30, pointerId: 8 });

    expect(onInput).toHaveBeenCalled();
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].x).toBe(0);
    expect(last[0].y).toBe(0);
  });

  it('pinned endpoints cannot be deleted via shift+click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        onChange={onChange}
        endpoints="pinned-x"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('[data-anchor-index]')[0] as Element;
    fireEvent.pointerDown(first, {
      clientX: 0, clientY: 100, pointerId: 9, shiftKey: true,
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders pinned endpoints with the pinned visual class', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onInput={() => {}}
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
        onInput={() => {}}
        grid={{}}
        width={200}
        height={100}
      />,
    );
    const gridLines = container.querySelectorAll('[data-plot-element="grid"]');
    expect(gridLines.length).toBeGreaterThan(0);
  });

  it('omits grid lines when grid is omitted, false, or null', () => {
    for (const grid of [undefined, false as const, null]) {
      const { container } = render(
        <CurveEditor
          value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
          onInput={() => {}}
          grid={grid}
          width={200}
          height={100}
        />,
      );
      expect(container.querySelectorAll('[data-plot-element="grid"]').length).toBe(0);
    }
  });

  it('honors grid.divisions count', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        grid={{ divisions: 5 }}
        width={200}
        height={100}
      />,
    );
    // 5 divisions × 2 axes = 10 internal grid lines.
    const gridLines = container.querySelectorAll('[data-plot-element="grid"]');
    expect(gridLines.length).toBe(10);
  });

  it('renders axis lines by default', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
        width={200}
        height={100}
      />,
    );
    const axes = container.querySelectorAll('[data-plot-element="axis"]');
    expect(axes.length).toBe(2);
  });

  it('omits axis lines when axes is false or null', () => {
    for (const axes of [false as const, null]) {
      const { container } = render(
        <CurveEditor
          value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
          onInput={() => {}}
          axes={axes}
          width={200}
          height={100}
        />,
      );
      expect(container.querySelectorAll('[data-plot-element="axis"]').length).toBe(0);
    }
  });

  it('renders a fill path in 1D mode when fill is configured', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={() => {}}
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
        onInput={() => {}}
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
          onInput={() => {}}
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
        onInput={() => {}}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1];
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 10 });
    expect(middle.getAttribute('class')).toMatch(/active/);
    fireEvent.pointerUp(document, { clientX: 100, clientY: 50, pointerId: 10 });
    expect(middle.getAttribute('class')).not.toMatch(/active/);
  });
});

describe('CurveEditor — pointer session', () => {
  function dragging() {
    const onChange = vi.fn();
    const onInput = vi.fn();
    const initial = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
    const { container } = render(
      <CurveEditor value={initial} onInput={onInput} onChange={onChange} width={200} height={100} />,
    );
    const svg = container.querySelector('svg')!;
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    return { svg, onInput, onChange };
  }

  it('commits a release that lands outside the plot', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const { onChange } = dragging();
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 900, clientY: 900, pointerId: 1, bubbles: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    outside.remove();
  });

  // The session cancels on `lostpointercapture` whether or not it asked for
  // capture, so this asserts the wiring, not a path a browser reaches here.
  it('cancels the gesture when the plot loses pointer capture', () => {
    const { svg, onInput, onChange } = dragging();
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1, buttons: 1 });
    const moves = onInput.mock.calls.length;
    fireEvent(svg, new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    fireEvent.pointerMove(document, { clientX: 160, clientY: 10, pointerId: 1, buttons: 1 });
    expect(onInput.mock.calls.length).toBe(moves);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats a move with no button held as the release it missed', () => {
    const { onInput, onChange } = dragging();
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1, buttons: 1 });
    const moves = onInput.mock.calls.length;
    fireEvent.pointerMove(document, { clientX: 160, clientY: 10, pointerId: 1, buttons: 0 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onInput.mock.calls.length).toBe(moves);
  });

  it('unmounting mid-gesture stops the drag reaching the document', () => {
    const onInput = vi.fn();
    const { container, unmount } = render(
      <CurveEditor value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]} onInput={onInput} width={200} height={100} />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    unmount();
    onInput.mockClear();
    fireEvent.pointerMove(document, { clientX: 160, clientY: 10, pointerId: 1, buttons: 1 });
    expect(onInput).not.toHaveBeenCalled();
  });
});

// PROXY ASSERTION — see Ruler.test.tsx for why this is asserted rather than the
// browser behaviour it stands in for. Consumers render their own SVG chrome
// into the plot through `children`, and capture would kill the click on it.
describe('CurveEditor — pointer capture', () => {
  it('never captures the pointer', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    const { container } = render(
      <CurveEditor value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]} onInput={() => {}} width={200} height={100} />,
    );
    const middle = container.querySelectorAll('[data-anchor-index]')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 120, clientY: 30, pointerId: 1 });
    expect(capture).not.toHaveBeenCalled();
  });
});
