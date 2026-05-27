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
    const circles = container.querySelectorAll('circle');
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
    expect(container.querySelectorAll('circle').length).toBe(1);
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
    const circles = container.querySelectorAll('circle');
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
    const middle = container.querySelectorAll('circle')[1] as Element;

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
    const middle = container.querySelectorAll('circle')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[1].x).toBeLessThanOrEqual(1.0);
    expect(last[1].x).toBeGreaterThanOrEqual(0);
  });

  it('does NOT clamp x in 2D mode', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={onChange}
        domain="2d"
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('circle')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[1].x).toBeGreaterThan(1.0);
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
    const middle = container.querySelectorAll('circle')[1] as Element;
    fireEvent.pointerDown(middle, {
      clientX: 100, clientY: 50, pointerId: 6, shiftKey: true,
    });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next] = onChangeCommit.mock.calls[0];
    expect(next).toHaveLength(2);
    expect(next).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });
});
