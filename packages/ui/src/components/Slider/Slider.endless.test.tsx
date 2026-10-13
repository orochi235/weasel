import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';
import { endless, unit } from '@weasel-js/quantity';

describe('Slider endless', () => {
  it('sits a thumb given Infinity at a stop one step past the range, and reads the display’s word', () => {
    const { getByRole, container } = render(
      <Slider min={0} max={5000} step={50} endless="max" display={endless(unit('ms'), 'never')} readoutPlacement="inline-after" thumbs={[{ value: Infinity }]} onInput={() => {}} />,
    );
    const thumb = getByRole('slider');
    expect(thumb).toHaveAttribute('aria-valuenow', '5050');
    expect(thumb).toHaveAttribute('aria-valuemax', '5050');
    expect(thumb).toHaveAttribute('aria-valuetext', 'never');
    expect(container.querySelector('[data-readout="inline"]')!.textContent).toBe('never');
  });

  it('reports Infinity at the stop and a number off it', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { getByRole } = render(<Slider min={0} max={100} step={10} endless="max" thumbs={[{ value: 90 }]} onInput={onInput} onChange={onChange} />);
    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith([{ value: 100 }]);
    fireEvent.keyDown(getByRole('slider'), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith([{ value: Infinity }]);
    fireEvent.keyDown(getByRole('slider'), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith([{ value: 0 }]);
  });

  it('opens the min end to -Infinity, read as −∞ by default', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Slider min={0} max={100} endless="min" readoutPlacement="inline-after" thumbs={[{ value: -Infinity }]} onInput={() => {}} onChange={onChange} />);
    expect(getByRole('slider')).toHaveAttribute('aria-valuetext', 'minus infinity');
    fireEvent.keyDown(getByRole('slider'), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith([{ value: 100 }]);
  });

  it('adds a stop for infinity after the last of evenly spaced stops, labeled with its word', () => {
    const onChange = vi.fn();
    const { getByRole, container } = render(
      <Slider min={0} max={60} stops={[1, 5, 60]} spacing="even" snap="strict" endless="max" display={endless(unit('s'), 'never')} thumbs={[{ value: 60 }]} onInput={() => {}} onChange={onChange} />,
    );
    const labels = [...container.querySelectorAll('[data-slider-stop-label]')].map(el => el.textContent);
    expect(labels).toContain('never');
    fireEvent.keyDown(getByRole('slider'), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith([{ value: Infinity }]);
  });

  it('steps a stepless thumb off the infinity stop and back onto it with the arrow keys', () => {
    const onInput = vi.fn();
    const at = (value: number) => render(<Slider min={0} max={100} endless="max" thumbs={[{ value }]} onInput={onInput} />);
    let view = at(Infinity);
    fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 100 }]);
    view.unmount();
    view = at(100);
    fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: Infinity }]);
    view.unmount();
    view = at(50);
    fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 51 }]);
    view.unmount();
    view = at(95);
    fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowRight', shiftKey: true });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 100 }]);
  });

  it('steps a stepless thumb off and onto the minus infinity stop', () => {
    const onInput = vi.fn();
    const at = (value: number) => render(<Slider min={0} max={100} endless="min" thumbs={[{ value }]} onInput={onInput} />);
    let view = at(-Infinity);
    fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 0 }]);
    view.unmount();
    view = at(0);
    fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: -Infinity }]);
  });

  it('reaches the infinity stop from the last of linearly spaced stops', () => {
    const onInput = vi.fn();
    const { getByRole } = render(
      <Slider min={0} max={100} stops={[0, 50, 100]} snap="strict" endless="max" thumbs={[{ value: 100 }]} onInput={onInput} />,
    );
    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: Infinity }]);
  });
});
