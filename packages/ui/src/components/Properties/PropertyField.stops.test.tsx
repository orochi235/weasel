import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { stubRect } from '../Slider/testing/stubRect';
import { PropertyField } from './PropertyField';
import { catchStop } from './sliderStops';

/** A slider over 0..100 holding its own value, reporting moves and the release apart. */
function Detents({ start = 40, step = 1, onInput = () => {}, onChange = () => {} }: {
  start?: number;
  step?: number;
  onInput?: (n: number) => void;
  onChange?: (n: number) => void;
}) {
  const [v, setV] = useState(start);
  return (
    <PropertyField
      kind="number"
      control="slider"
      label="Level"
      value={v}
      min={0}
      max={100}
      step={step}
      stops={[50]}
      onInput={(n) => {
        setV(n);
        onInput(n);
      }}
      onChange={onChange}
    />
  );
}

// jsdom lays nothing out: 200px of track puts the 8px pull at 4 units either side of a stop.
function track(): HTMLInputElement {
  const el = screen.getByRole('slider') as HTMLInputElement;
  stubRect(el, { width: 200 });
  return el;
}

describe('a slider with stops', () => {
  it('lands a drag passing near a stop on it', () => {
    const onInput = vi.fn();
    render(<Detents onInput={onInput} />);
    const el = track();
    fireEvent.pointerDown(el);
    fireEvent.input(el, { target: { value: '53' } });
    expect(onInput).toHaveBeenLastCalledWith(50);
    fireEvent.input(el, { target: { value: '60' } });
    expect(onInput).toHaveBeenLastCalledWith(60);
  });

  it('lets a drag with alt held pass a stop by', () => {
    const onInput = vi.fn();
    render(<Detents onInput={onInput} />);
    const el = track();
    fireEvent.pointerDown(el, { altKey: true });
    fireEvent.input(el, { target: { value: '53' } });
    expect(onInput).toHaveBeenLastCalledWith(53);
  });

  it('commits a drag once, on release, at the stop it caught', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<Detents onInput={onInput} onChange={onChange} />);
    const el = track();
    fireEvent.pointerDown(el);
    for (const at of ['44', '48', '52']) fireEvent.input(el, { target: { value: at } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(window);
    fireEvent.change(el);
    expect(onInput.mock.calls.map(([n]) => n)).toEqual([44, 50, 50]);
    expect(onChange.mock.calls).toEqual([[50]]);
  });

  it('stops a key step on the track at a stop it crosses, and leaves it on the next', () => {
    const onInput = vi.fn();
    render(<Detents start={48} step={5} onInput={onInput} />);
    const el = track();
    fireEvent.input(el, { target: { value: '53' } });
    expect(onInput).toHaveBeenLastCalledWith(50);
    fireEvent.input(el, { target: { value: '55' } });
    expect(onInput).toHaveBeenLastCalledWith(55);
  });

  it('stops the readout arrow keys at a stop they cross', () => {
    const onChange = vi.fn();
    render(<Detents start={48} step={5} onChange={onChange} />);
    const readout = screen.getByRole('spinbutton');
    fireEvent.keyDown(readout, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(50);
    fireEvent.keyDown(readout, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(55);
  });

  it('draws each stop on the track', () => {
    render(<Detents />);
    const el = screen.getByRole('slider');
    expect(el.style.getPropertyValue('--wzl-range-stop-at')).toBe(
      'calc(50% + 0 * (var(--wzl-slider-thumb-size) - 1px)) 50%',
    );
  });

  it('leaves a track without stops as it was', () => {
    render(<PropertyField kind="number" control="slider" label="Op" value={5} min={0} max={10} onChange={() => {}} />);
    expect(screen.getByRole('slider').getAttribute('style')).toBeNull();
  });
});

describe('catchStop', () => {
  it('takes the first stop a move crosses, either way', () => {
    expect(catchStop(0, 10, [3, 6])).toBe(3);
    expect(catchStop(10, 0, [3, 6])).toBe(6);
  });

  it('passes a move that crosses none, or leaves from one', () => {
    expect(catchStop(0, 2, [3])).toBe(2);
    expect(catchStop(3, 5, [3])).toBe(5);
  });
});
