import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { useState } from 'react';
import { RangeSlider } from './RangeSlider';

describe('RangeSlider', () => {
  it('renders a single-value group with one thumb by default', () => {
    render(<RangeSlider label="Opacity" defaultValue={40} minValue={0} maxValue={100} />);
    expect(screen.getByRole('group', { name: 'Opacity' })).toBeTruthy();
    expect(screen.getAllByRole('slider').length).toBe(1);
  });

  it('exposes the current value on the thumb input', () => {
    render(<RangeSlider label="X" defaultValue={42} minValue={0} maxValue={100} />);
    const thumb = screen.getByRole('slider') as HTMLInputElement;
    expect(thumb.value).toBe('42');
  });

  it('responds to keyboard arrows', () => {
    function Wrap() {
      const [v, setV] = useState(10);
      return <RangeSlider label="Q" value={v} onChange={setV as (v: number | number[]) => void} minValue={0} maxValue={100} />;
    }
    render(<Wrap />);
    const thumb = screen.getByRole('slider') as HTMLInputElement;
    act(() => { thumb.focus(); });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb.value).toBe('11');
  });

  it('renders two thumbs when value is an array', () => {
    render(<RangeSlider label="Range" defaultValue={[20, 80]} minValue={0} maxValue={100} />);
    expect(screen.getAllByRole('slider').length).toBe(2);
  });

  it('fires onChange when changed', () => {
    const onChange = vi.fn();
    render(<RangeSlider label="X" defaultValue={5} onChange={onChange} minValue={0} maxValue={10} />);
    const thumb = screen.getByRole('slider');
    act(() => { thumb.focus(); });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(6);
  });
});
