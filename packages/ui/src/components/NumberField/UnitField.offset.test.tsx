import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { UnitField } from './UnitField';

const CM = { mm: 0.1, cm: 1 };

function type(text: string, props: Partial<Parameters<typeof UnitField>[0]> = {}) {
  const onChange = vi.fn();
  render(<UnitField value={5} onChange={onChange} accepts={CM} aria-label="X" {...props} />);
  const field = screen.getByRole('spinbutton', { name: 'X' });
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
  return { onChange, field };
}

describe('UnitField offsets', () => {
  it('sends += and -= to onOffset as an amount, units read', () => {
    const onOffset = vi.fn();
    const { onChange } = type('-= 20mm', { onOffset });
    expect(onOffset).toHaveBeenCalledWith(-2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes an offset in a mixed field, which has no value of its own', () => {
    const onOffset = vi.fn();
    type('+=3', { value: NaN, onOffset });
    expect(onOffset).toHaveBeenCalledWith(3);
  });

  it('adds an offset to the value without onOffset', () => {
    expect(type('+=3').onChange).toHaveBeenCalledWith(8);
  });

  it('commits nothing for an offset that does not read, showing the value again', () => {
    const onOffset = vi.fn();
    const { onChange, field } = type('+=lots', { onOffset });
    expect(onOffset).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('5');
  });
});
