import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { logScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';
import { stubRect } from '../Slider/testing/stubRect';
import { PropertyField } from './PropertyField';
import { trackPlace } from './sliderScale';

/** A segment count over 1..1000 on a log track, holding its own value. */
function Count({ start = 16, stops, endless, scale = logScale, onInput = () => {}, onChange = () => {} }: {
  start?: number;
  stops?: number[];
  endless?: 'max';
  scale?: ContinuousScaleFactory;
  onInput?: (n: number) => void;
  onChange?: (n: number) => void;
}) {
  const [v, setV] = useState(start);
  return (
    <PropertyField
      kind="number"
      control="slider"
      label="Segments"
      value={v}
      min={1}
      max={1000}
      step={1}
      stops={stops}
      endless={endless}
      scale={scale}
      onInput={(n) => {
        setV(n);
        onInput(n);
      }}
      onChange={onChange}
    />
  );
}

const track = () => {
  const el = screen.getByRole('slider') as HTMLInputElement;
  stubRect(el, { width: 300 });
  return el;
};

describe('a slider on a scaled track', () => {
  it('runs its input along the track and places the value by the scale', () => {
    render(<Count start={10} />);
    const el = track();
    expect([el.min, el.max, el.step]).toEqual(['0', '1', 'any']);
    expect(Number(el.value)).toBeCloseTo(1 / 3, 9);
  });

  it('reads a drag back into value units, rounded by step', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<Count onInput={onInput} onChange={onChange} />);
    const el = track();
    fireEvent.pointerDown(el);
    fireEvent.input(el, { target: { value: '0.5' } });
    expect(onInput).toHaveBeenLastCalledWith(32);
    fireEvent.pointerUp(window);
    fireEvent.change(el);
    expect(onChange.mock.calls).toEqual([[32]]);
  });

  it('steps the arrow keys on the track by step, in value units, stopping at a stop they cross', () => {
    const onInput = vi.fn();
    render(<Count start={9} stops={[10]} onInput={onInput} />);
    const el = track();
    fireEvent.keyDown(el, { key: 'ArrowUp' });
    expect(onInput).toHaveBeenLastCalledWith(10);
    fireEvent.keyDown(el, { key: 'ArrowUp' });
    expect(onInput).toHaveBeenLastCalledWith(11);
    fireEvent.keyDown(el, { key: 'End' });
    expect(onInput).toHaveBeenLastCalledWith(1000);
  });

  it('steps the horizontal arrows as the vertical ones, as an unscaled track does', () => {
    const onInput = vi.fn();
    render(<Count start={9} onInput={onInput} />);
    const el = track();
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith(10);
    fireEvent.keyDown(el, { key: 'ArrowLeft' });
    fireEvent.keyDown(el, { key: 'ArrowLeft' });
    expect(onInput).toHaveBeenLastCalledWith(8);
  });

  it('mirrors the horizontal arrows on a right-to-left track', () => {
    const place = trackPlace(logScale, 1, 1000, 1, undefined);
    expect(place.keyStep('ArrowRight', 9, 'rtl')).toBe(8);
    expect(place.keyStep('ArrowLeft', 9, 'rtl')).toBe(10);
    expect(place.keyStep('ArrowUp', 9, 'rtl')).toBe(10);
  });

  it('draws a stop where the scale puts it, and a drag near one lands on it', () => {
    const onInput = vi.fn();
    render(<Count stops={[100]} onInput={onInput} />);
    const el = track();
    expect(el.style.getPropertyValue('--wzl-range-stop-at')).toMatch(/^calc\(66\.66666666666\d*% /);
    fireEvent.pointerDown(el);
    fireEvent.input(el, { target: { value: '0.67' } });
    expect(onInput).toHaveBeenLastCalledWith(100);
  });

  it('reaches an endless end at the end of the track', () => {
    const onInput = vi.fn();
    render(<Count endless="max" onInput={onInput} />);
    fireEvent.input(track(), { target: { value: '1' } });
    expect(onInput).toHaveBeenLastCalledWith(Infinity);
  });
});
