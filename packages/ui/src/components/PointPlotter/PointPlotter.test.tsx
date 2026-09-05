import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { PointPlotter } from './PointPlotter';
import type { ControlPoint } from '../CurveEditor';

// jsdom returns 0,0 rect by default, so plot coords equal client coords
// in these tests (no transform). That's the simplest case to test.

describe('PointPlotter — rendering', () => {
  it('renders one anchor per value entry at the right plot position', () => {
    const value: ControlPoint[] = [
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
    ];
    const { container } = render(
      <PointPlotter value={value} onInput={() => {}} width={200} height={100} />,
    );
    const circles = container.querySelectorAll('circle[data-anchor-index]');
    expect(circles.length).toBe(2);
    expect(Number(circles[0].getAttribute('cx'))).toBeCloseTo(50, 6);
    expect(Number(circles[1].getAttribute('cx'))).toBeCloseTo(150, 6);
  });

  it('does not render a curve <path>', () => {
    const value: ControlPoint[] = [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.7 }];
    const { container } = render(
      <PointPlotter value={value} onInput={() => {}} width={200} height={100} />,
    );
    expect(container.querySelector('path')).toBeNull();
  });

  it('renders a locked point as a diamond rect', () => {
    const value: ControlPoint[] = [{ x: 0.5, y: 0.5, locked: true }];
    const { container } = render(
      <PointPlotter value={value} onInput={() => {}} width={200} height={100} />,
    );
    expect(container.querySelector('circle[data-anchor-index]')).toBeNull();
    expect(container.querySelector('rect[data-anchor-index]')).not.toBeNull();
  });
});

describe('PointPlotter — drag', () => {
  it('fires onInput during drag and onChange on release', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const initial: ControlPoint[] = [{ x: 0.5, y: 0.5 }];
    const { container } = render(
      <PointPlotter
        value={initial}
        onInput={onInput}
        onChange={onChange}
        width={200} height={100}
      />,
    );
    const anchor = container.querySelector('circle[data-anchor-index]')!;
    fireEvent.pointerDown(anchor, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1 });
    expect(onInput).toHaveBeenCalled();
    const lastNext = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(lastNext[0].x).toBeCloseTo(0.6, 6);
    expect(lastNext[0].y).toBeCloseTo(0.7, 6);

    fireEvent.pointerUp(document, { clientX: 120, clientY: 30, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, prev] = onChange.mock.calls[0];
    expect(prev).toEqual(initial);
    expect(next[0].x).toBeCloseTo(0.6, 6);
  });
});

describe('PointPlotter — add / delete', () => {
  it('inserts a point when clicking empty space (addPointMode=click-empty)', () => {
    const onInput = vi.fn();
    const value: ControlPoint[] = [{ x: 0.2, y: 0.5 }];
    const { container } = render(
      <PointPlotter
        value={value}
        onInput={onInput}
        width={200} height={100}
        addPointMode="click-empty"
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 160, clientY: 40, pointerId: 1, button: 0 });
    expect(onInput).toHaveBeenCalled();
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last.length).toBe(2);
  });

  it('refuses insertion when value.length >= maxPoints', () => {
    const onInput = vi.fn();
    const { container } = render(
      <PointPlotter
        value={[{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }]}
        onInput={onInput}
        width={200} height={100}
        maxPoints={2}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 160, clientY: 40, pointerId: 1, button: 0 });
    expect(onInput).not.toHaveBeenCalled();
  });

  it('refuses insertion when addPointMode=never', () => {
    const onInput = vi.fn();
    const { container } = render(
      <PointPlotter
        value={[{ x: 0.5, y: 0.5 }]}
        onInput={onInput}
        width={200} height={100}
        addPointMode="never"
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1, button: 0 });
    expect(onInput).not.toHaveBeenCalled();
  });

  it('deletes a point on shift+click', () => {
    const onInput = vi.fn();
    const value: ControlPoint[] = [
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
    ];
    const { container } = render(
      <PointPlotter value={value} onInput={onInput} width={200} height={100} />,
    );
    const anchor = container.querySelectorAll('circle[data-anchor-index]')[1];
    fireEvent.pointerDown(anchor, { clientX: 150, clientY: 50, pointerId: 1, shiftKey: true });
    expect(onInput).toHaveBeenCalled();
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last.length).toBe(1);
    expect(last[0].x).toBeCloseTo(0.25, 6);
  });

  it('refuses delete when value.length <= minPoints', () => {
    const onInput = vi.fn();
    const { container } = render(
      <PointPlotter
        value={[{ x: 0.5, y: 0.5 }]}
        onInput={onInput}
        width={200} height={100}
        minPoints={1}
      />,
    );
    const anchor = container.querySelector('circle[data-anchor-index]')!;
    fireEvent.pointerDown(anchor, { clientX: 100, clientY: 50, pointerId: 1, shiftKey: true });
    expect(onInput).not.toHaveBeenCalled();
  });
});
