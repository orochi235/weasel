import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnitField } from './UnitField';

function setup(props: Partial<Parameters<typeof UnitField>[0]> = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(<UnitField value={5} onChange={onChange} onClear={onClear} aria-label="Width" {...props} />);
  return { onChange, onClear, field: screen.getByRole('spinbutton', { name: 'Width' }) };
}

describe('UnitField onClear', () => {
  it('is what a field emptied and left calls, in place of putting the value back', () => {
    const { onChange, onClear, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '  ' } });
    fireEvent.blur(field);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is called on Enter too', () => {
    const { onClear, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('is not called when the emptying ends in Escape', () => {
    const { onClear, field } = setup();
    field.focus();
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onClear).not.toHaveBeenCalled();
    expect(field).toHaveValue('5');
  });

  it('is not called for a field that held nothing already, nor for text that does not read', () => {
    const { onClear, field } = setup({ value: Number.NaN });
    field.focus();
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    field.focus();
    fireEvent.change(field, { target: { value: 'abc' } });
    fireEvent.blur(field);
    expect(onClear).not.toHaveBeenCalled();
  });
});
