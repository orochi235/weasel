import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { PointPicker } from './PointPicker';

// jsdom returns 0,0 rect by default, so plot coords equal client coords
// in these tests (no transform). That's the simplest case to test.

describe('PointPicker — rendering', () => {
  it('renders a single circle at the right plot position', () => {
    const { container } = render(
      <PointPicker
        value={{ x: 0.5, y: 0.5 }}
        onChange={() => {}}
        width={200} height={100}
      />,
    );
    const circles = container.querySelectorAll('circle[data-point]');
    expect(circles.length).toBe(1);
    // Model (0.5, 0.5) → plot (100, 50).
    expect(Number(circles[0].getAttribute('cx'))).toBeCloseTo(100, 6);
    expect(Number(circles[0].getAttribute('cy'))).toBeCloseTo(50, 6);
  });

  it('renders as a locked diamond when locked', () => {
    const { container } = render(
      <PointPicker
        value={{ x: 0.5, y: 0.5 }}
        onChange={() => {}}
        width={200} height={100}
        locked
      />,
    );
    expect(container.querySelector('circle[data-point]')).toBeNull();
    const rect = container.querySelector('[data-point="locked"]');
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute('class')).toMatch(/locked/);
  });
});

describe('PointPicker — drag', () => {
  it('fires onChange during drag and onChangeCommit on release', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const initial = { x: 0.5, y: 0.5 };
    const { container } = render(
      <PointPicker
        value={initial}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        width={200} height={100}
      />,
    );
    const circle = container.querySelector('circle[data-point]')!;
    fireEvent.pointerDown(circle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 30, pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    const lastNext = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // plot (120, 30) → model (0.6, 0.7).
    expect(lastNext.x).toBeCloseTo(0.6, 6);
    expect(lastNext.y).toBeCloseTo(0.7, 6);

    fireEvent.pointerUp(window, { clientX: 120, clientY: 30, pointerId: 1 });
    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next, prev] = onChangeCommit.mock.calls[0];
    expect(prev).toEqual(initial);
    expect(next.x).toBeCloseTo(0.6, 6);
  });

  it('clamps drag to plot bounds', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PointPicker
        value={{ x: 0.5, y: 0.5 }}
        onChange={onChange}
        width={200} height={100}
      />,
    );
    const circle = container.querySelector('circle[data-point]')!;
    fireEvent.pointerDown(circle, { clientX: 100, clientY: 50, pointerId: 2 });
    fireEvent.pointerMove(window, { clientX: 9999, clientY: -9999, pointerId: 2 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last.x).toBeLessThanOrEqual(1);
    expect(last.x).toBeGreaterThanOrEqual(0);
    expect(last.y).toBeLessThanOrEqual(1);
    expect(last.y).toBeGreaterThanOrEqual(0);
  });

  it('refuses to drag when locked', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const { container } = render(
      <PointPicker
        value={{ x: 0.5, y: 0.5 }}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        width={200} height={100}
        locked
      />,
    );
    const target = container.querySelector('[data-point="locked"]')!;
    fireEvent.pointerDown(target, { clientX: 100, clientY: 50, pointerId: 3 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 30, pointerId: 3 });
    fireEvent.pointerUp(window, { clientX: 120, clientY: 30, pointerId: 3 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onChangeCommit).not.toHaveBeenCalled();
  });
});
