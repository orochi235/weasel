import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GradientFill } from '@weasel-js/core';
import { GradientHandles } from './GradientHandles';

const STOPS = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

/** A 2× zoom panned by (10, 20) — enough that a bug confusing gradient
 *  space with overlay pixels cannot pass. */
const toScreen = (p: { x: number; y: number }) => ({ x: p.x * 2 + 10, y: p.y * 2 + 20 });
const toLocal = (p: { x: number; y: number }) => ({ x: (p.x - 10) / 2, y: (p.y - 20) / 2 });

beforeAll(() => {
  // jsdom implements neither pointer capture nor SVG layout.
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => {} } as DOMRect;
  };
});

function drag(label: string, to: { x: number; y: number }): void {
  const handle = screen.getByLabelText(label);
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: to.x, clientY: to.y, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientX: to.x, clientY: to.y, pointerId: 1 });
}

describe('GradientHandles', () => {
  const linear: GradientFill = {
    fill: 'linear-gradient',
    from: { x: 0, y: 0 },
    to: { x: 50, y: 0 },
    stops: STOPS,
    units: 'local',
  };

  it('positions linear endpoints through toScreen', () => {
    render(<GradientHandles value={linear} toScreen={toScreen} toLocal={toLocal} onChange={() => {}} width={400} height={300} />);
    expect(screen.getByLabelText('Gradient start')).toHaveAttribute('cx', '10');
    expect(screen.getByLabelText('Gradient end')).toHaveAttribute('cx', '110');
  });

  it('maps a dragged endpoint back into gradient space', () => {
    const onChange = vi.fn();
    render(<GradientHandles value={linear} toScreen={toScreen} toLocal={toLocal} onChange={onChange} width={400} height={300} />);
    drag('Gradient end', { x: 210, y: 120 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 50 },
      units: 'local',
    });
  });

  it('writes nothing when a handle is pressed and released without moving', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<GradientHandles value={linear} toScreen={toScreen} toLocal={toLocal} onInput={onInput} onChange={onChange} width={400} height={300} />);
    const handle = screen.getByLabelText('Gradient start');
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 20, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onInput).not.toHaveBeenCalled();
  });

  it('restores the preview instead of committing when the pointer is canceled', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<GradientHandles value={linear} toScreen={toScreen} toLocal={toLocal} onInput={onInput} onChange={onChange} width={400} height={300} />);
    const handle = screen.getByLabelText('Gradient start');
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 90, clientY: 120, pointerId: 1 });
    fireEvent.pointerCancel(handle, { clientX: 90, clientY: 120, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    // Last live value puts the endpoint back at its pre-drag position.
    expect(onInput.mock.calls.at(-1)![0]).toMatchObject({ from: { x: 0, y: 0 } });
  });

  it('moves a focused handle with the arrow keys', () => {
    const onChange = vi.fn();
    render(<GradientHandles value={linear} toScreen={toScreen} toLocal={toLocal} onChange={onChange} width={400} height={300} />);
    const handle = screen.getByLabelText('Gradient start');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    // One overlay pixel right, mapped back through the 2× transform.
    expect(onChange.mock.calls[0][0]).toMatchObject({ from: { x: 0.5, y: 0 } });
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true });
    expect(onChange.mock.calls[1][0]).toMatchObject({ from: { x: 0, y: 5 } });
  });

  it('previews during the drag and commits once at the end', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<GradientHandles value={linear} toScreen={toScreen} toLocal={toLocal} onInput={onInput} onChange={onChange} width={400} height={300} />);
    const handle = screen.getByLabelText('Gradient start');
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 30, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 50, clientY: 60, pointerId: 1 });
    expect(onInput).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { clientX: 50, clientY: 60, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    // Commits where the drag ended, not where the gradient started.
    expect(onChange.mock.calls[0][0]).toMatchObject({ from: { x: 20, y: 20 } });
  });

  const radial: GradientFill = {
    fill: 'radial-gradient', center: { x: 50, y: 50 }, radius: 25, stops: STOPS,
  };

  it('derives a radial radius from the distance dragged, in gradient space', () => {
    const onChange = vi.fn();
    render(<GradientHandles value={radial} toScreen={toScreen} toLocal={toLocal} onChange={onChange} width={400} height={300} />);
    // Screen (230, 120) is local (110, 50) — 60 from the center at (50, 50).
    drag('Gradient radius', { x: 230, y: 120 });
    expect(onChange.mock.calls[0][0]).toMatchObject({ fill: 'radial-gradient', radius: 60 });
  });

  it('never commits a zero radius, which would divide by zero in the shader', () => {
    const onChange = vi.fn();
    render(<GradientHandles value={radial} toScreen={toScreen} toLocal={toLocal} onChange={onChange} width={400} height={300} />);
    // Drop the radius handle exactly on the center.
    drag('Gradient radius', { x: 110, y: 120 });
    expect(onChange.mock.calls[0][0].radius).toBeGreaterThan(0);
  });

  const conic: GradientFill = {
    fill: 'conic-gradient', center: { x: 50, y: 50 }, angle: 0, stops: STOPS,
  };

  it('derives a conic angle from the arm direction', () => {
    const onChange = vi.fn();
    render(<GradientHandles value={conic} toScreen={toScreen} toLocal={toLocal} onChange={onChange} width={400} height={300} />);
    // Screen (110, 220) is local (50, 100) — straight below the center.
    drag('Gradient angle', { x: 110, y: 220 });
    expect(onChange.mock.calls[0][0].angle).toBeCloseTo(Math.PI / 2);
  });

  it('renders only the handles its kind has', () => {
    const { rerender } = render(
      <GradientHandles value={linear} toScreen={toScreen} toLocal={toLocal} onChange={() => {}} width={400} height={300} />,
    );
    expect(screen.queryByLabelText('Gradient radius')).not.toBeInTheDocument();

    rerender(<GradientHandles value={radial} toScreen={toScreen} toLocal={toLocal} onChange={() => {}} width={400} height={300} />);
    expect(screen.getByLabelText('Gradient radius')).toBeInTheDocument();
    expect(screen.queryByLabelText('Gradient start')).not.toBeInTheDocument();
  });
});
