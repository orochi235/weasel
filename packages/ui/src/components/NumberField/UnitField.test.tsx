import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { UnitField } from './UnitField';

const CM = { mm: 0.1, cm: 1, m: 100 };

function setup(props: Partial<Parameters<typeof UnitField>[0]> = {}) {
  const onChange = vi.fn();
  render(<UnitField value={5} onChange={onChange} accepts={CM} aria-label="Width" {...props} />);
  return { onChange, field: screen.getByRole('textbox', { name: 'Width' }) };
}

describe('UnitField', () => {
  it('shows the value', () => {
    expect(setup().field).toHaveValue('5');
  });

  it('shows an empty field and its placeholder for NaN', () => {
    const { field } = setup({ value: NaN, placeholder: 'Mixed' });
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'Mixed');
  });

  it('commits a typed unit converted to the unit it shows', () => {
    const { onChange, field } = setup();
    fireEvent.change(field, { target: { value: '12mm' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(1.2);
  });

  it('commits nothing for unreadable text, and shows the value again', () => {
    const { onChange, field } = setup();
    fireEvent.change(field, { target: { value: '12ft' } });
    fireEvent.blur(field);
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('5');
  });

  it('commits once on Enter', () => {
    const { onChange, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '2m' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(200);
  });

  it('commits nothing on Escape', () => {
    const { onChange, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('5');
  });

  it('clamps to its bounds', () => {
    const { onChange, field } = setup({ minValue: 0, maxValue: 10 });
    fireEvent.change(field, { target: { value: '1m' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('steps with the arrow keys, from what is typed', () => {
    const { onChange, field } = setup({ step: 0.5 });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(5.5);
    fireEvent.change(field, { target: { value: '20mm' } });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });
});
