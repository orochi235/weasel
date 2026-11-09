import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UnitField } from './UnitField';

afterEach(cleanup);

function setup(value: number) {
  const onChange = vi.fn();
  render(<UnitField value={value} onChange={onChange} minValue={0} maxValue={10} endless="max" aria-label="Cap" />);
  return { onChange, field: screen.getByRole('spinbutton', { name: 'Cap' }) };
}

describe('UnitField at an endless end', () => {
  it('commits infinity typed, where a bound would clamp anything else', () => {
    const { onChange, field } = setup(5);
    fireEvent.change(field, { target: { value: '∞' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(Infinity);
  });

  it('steps one past its bound to infinity, and back down from it', () => {
    const up = setup(10);
    fireEvent.keyDown(up.field, { key: 'ArrowUp' });
    expect(up.onChange).toHaveBeenCalledWith(Infinity);
    cleanup();
    const down = setup(Infinity);
    fireEvent.keyDown(down.field, { key: 'ArrowDown' });
    expect(down.onChange).toHaveBeenCalledWith(10);
  });

  it('leaves the increment stepper live at the bound, as the arrow key steps past it', () => {
    render(<UnitField value={10} onChange={() => {}} minValue={0} maxValue={10} endless="max" steppers aria-label="Cap" />);
    expect(screen.getByRole('button', { name: 'Increment' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrement' })).not.toBeDisabled();
    cleanup();
    render(<UnitField value={Infinity} onChange={() => {}} minValue={0} maxValue={10} endless="max" steppers aria-label="Cap" />);
    expect(screen.getByRole('button', { name: 'Increment' })).toBeDisabled();
  });
});

describe('UnitField with no endless end', () => {
  it('commits nothing for infinity typed where no bound clamps it, and shows the value again', () => {
    const onChange = vi.fn();
    const onInput = vi.fn();
    render(<UnitField value={5} onChange={onChange} onInput={onInput} aria-label="Width" />);
    const field = screen.getByRole('spinbutton', { name: 'Width' });
    fireEvent.change(field, { target: { value: '∞' } });
    fireEvent.blur(field);
    expect(onChange).not.toHaveBeenCalled();
    expect(onInput).not.toHaveBeenCalledWith(Infinity);
    expect(field).toHaveValue('5');
  });
});
