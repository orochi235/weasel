import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyControl } from './PropertyField';

type Bounds = { min?: number; max?: number; endless?: 'max' };

function slider(value: number, bounds: Bounds) {
  const onChange = vi.fn();
  render(<PropertyControl kind="number" control="slider" name="Gap" value={value} {...bounds} onChange={onChange} />);
  return {
    onChange,
    track: screen.getByRole('slider', { name: 'Gap' }) as HTMLInputElement,
    readout: screen.getByRole('spinbutton', { name: 'Gap' }),
  };
}

function type(readout: HTMLElement, text: string) {
  fireEvent.focus(readout);
  fireEvent.change(readout, { target: { value: text } });
  fireEvent.blur(readout);
}

describe('a slider with one end of its range missing', () => {
  it('runs its track 100 on from the end it has', () => {
    expect(slider(250, { min: 200 }).track).toHaveAttribute('min', '200');
    expect(screen.getByRole('slider')).toHaveAttribute('max', '300');
  });

  it('runs its track 100 back from a lone max', () => {
    const { track } = slider(-20, { max: -10 });
    expect(track).toHaveAttribute('min', '-110');
    expect(track).toHaveAttribute('max', '-10');
  });

  it('writes the track’s positions as they are', () => {
    const { track, onChange } = slider(250, { min: 200 });
    fireEvent.change(track, { target: { value: '300' } });
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it('takes a typed value past the open end, and holds one back at the end it has', () => {
    const { readout, onChange } = slider(250, { min: 200 });
    type(readout, '5000');
    expect(onChange).toHaveBeenLastCalledWith(5000);
    type(readout, '50');
    expect(onChange).toHaveBeenLastCalledWith(200);
  });

  it('pins the thumb at the open end for a value past it, and reads the value itself', () => {
    const { track, readout } = slider(5000, { min: 200 });
    expect(track.value).toBe('300');
    expect(readout).toHaveValue('5000');
  });

  it('steps the readout on past the open end, and stops at the end it has', () => {
    const { readout, onChange } = slider(5000, { min: 200 });
    fireEvent.keyDown(readout, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(5001);
    fireEvent.keyDown(readout, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(200);
  });

  it('names only the end it has to assistive tech', () => {
    const { readout } = slider(250, { min: 200 });
    expect(readout).toHaveAttribute('aria-valuemin', '200');
    expect(readout).not.toHaveAttribute('aria-valuemax');
  });

  it('keeps an endless missing end standing for infinity past its stop', () => {
    const { readout, onChange } = slider(50, { min: 0, endless: 'max' });
    type(readout, '5000');
    expect(onChange).toHaveBeenLastCalledWith(Infinity);
  });
});
