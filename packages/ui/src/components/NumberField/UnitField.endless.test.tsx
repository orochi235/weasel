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
});
