import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GradientFill } from '@weasel-js/core';
import { GradientEditor } from './GradientEditor';

const LINEAR: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 100, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'local',
};

describe('GradientEditor', () => {
  it('renders one color swatch per stop', () => {
    render(<GradientEditor value={LINEAR} onChange={() => {}} />);
    expect(screen.getByLabelText('Stop 1 at 0%')).toBeInTheDocument();
    expect(screen.getByLabelText('Stop 2 at 100%')).toBeInTheDocument();
  });

  it('recoloring a stop commits the whole gradient, geometry intact', () => {
    const onChange = vi.fn();
    render(<GradientEditor value={LINEAR} onChange={onChange} />);
    const swatch = screen.getByLabelText('Stop 1 at 0%');
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      units: 'local',
      stops: [
        { offset: 0, color: '#00ff00ff' },
        { offset: 1, color: '#0000ffff' },
      ],
    });
  });

  it('previews a recolor through onInput without committing it', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<GradientEditor value={LINEAR} onInput={onInput} onChange={onChange} />);
    fireEvent.input(screen.getByLabelText('Stop 1 at 0%'), { target: { value: '#00ff00' } });

    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switching kind preserves stops, units and opacity', () => {
    const onChange = vi.fn();
    render(<GradientEditor value={{ ...LINEAR, opacity: 0.4 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Radial' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      fill: 'radial-gradient',
      center: { x: 50, y: 0 },
      radius: 50,
      units: 'local',
      opacity: 0.4,
      stops: LINEAR.stops,
    });
  });

  it('hides the kind switch when the surrounding UI owns it', () => {
    render(<GradientEditor value={LINEAR} onChange={() => {}} kindSwitch={false} />);
    expect(screen.queryByRole('radio', { name: 'Radial' })).not.toBeInTheDocument();
  });

  it('addresses stops by array position, so an out-of-order list recolors the right one', () => {
    const onChange = vi.fn();
    const unordered: GradientFill = {
      ...LINEAR,
      stops: [
        { offset: 1, color: '#0000ffff' },
        { offset: 0, color: '#ff0000ff' },
      ],
    };
    render(<GradientEditor value={unordered} onChange={onChange} />);
    // The row is sorted for display, so the leftmost swatch is stops[1].
    const swatch = screen.getByLabelText('Stop 2 at 0%');
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);

    expect(onChange.mock.calls[0][0].stops).toEqual([
      { offset: 1, color: '#0000ffff' },
      { offset: 0, color: '#00ff00ff' },
    ]);
  });
});
