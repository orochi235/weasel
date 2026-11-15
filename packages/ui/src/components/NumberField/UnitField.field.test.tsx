import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField';
import { UnitField } from './UnitField';

const none = (): void => {};

// UnitField takes NumberField's label, description and error slots and its form integration; these hold both
// to the same reading.
describe('UnitField, as NumberField', () => {
  it('is named by its label, which a click on focuses it through', () => {
    render(<UnitField label="Width" value={2} onChange={none} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });
    expect(screen.getByText('Width').tagName).toBe('LABEL');
    expect(screen.getByLabelText('Width')).toBe(input);
  });

  it.each([
    ['UnitField', <UnitField key="u" label="Width" description="In centimeters." value={2} onChange={none} />, 'spinbutton'],
    ['NumberField', <NumberField key="n" label="Width" description="In centimeters." value={2} />, 'textbox'],
  ] as const)('%s is described by its description', (_, el, role) => {
    render(el);
    expect(screen.getByRole(role)).toHaveAccessibleDescription('In centimeters.');
  });

  it.each([
    ['UnitField', <UnitField key="u" label="Width" errorMessage="Too wide." isInvalid value={2} onChange={none} />, 'spinbutton'],
    ['NumberField', <NumberField key="n" label="Width" errorMessage="Too wide." isInvalid value={2} />, 'textbox'],
  ] as const)('%s shows its error while invalid, which describes it', (_, el, role) => {
    render(el);
    const input = screen.getByRole(role);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Too wide.');
  });

  it('shows no error while valid', () => {
    render(<UnitField label="Width" errorMessage="Too wide." value={2} onChange={none} />);
    expect(screen.queryByText('Too wide.')).toBeNull();
    expect(screen.getByRole('spinbutton')).not.toHaveAttribute('aria-invalid');
  });

  it('keeps a description of the caller’s own beside its own', () => {
    render(
      <>
        <span id="note">Mind the bleed.</span>
        <UnitField label="Width" description="In centimeters." aria-describedby="note" value={2} onChange={none} />
      </>,
    );
    expect(screen.getByRole('spinbutton')).toHaveAccessibleDescription('In centimeters. Mind the bleed.');
  });

  it('submits its value as a number under its name', () => {
    const { container } = render(
      <form>
        <UnitField label="Width" name="width" value={2.5} accepts={{ cm: 1, mm: 0.1 }} onChange={none} />
      </form>,
    );
    expect(new FormData(container.querySelector('form')!).get('width')).toBe('2.5');
  });

  it('submits nothing for a mixed value', () => {
    const { container } = render(
      <form>
        <UnitField name="width" aria-label="Width" value={2} mixed onChange={none} />
      </form>,
    );
    expect(new FormData(container.querySelector('form')!).get('width')).toBe('');
  });

  it('calls onBlur after committing what was typed', () => {
    const order: string[] = [];
    const onChange = vi.fn(() => order.push('change'));
    const onBlur = vi.fn(() => order.push('blur'));
    render(<UnitField label="Width" value={2} onChange={onChange} onBlur={onBlur} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(3);
    expect(order).toEqual(['change', 'blur']);
  });

  it('marks itself required', () => {
    render(<UnitField label="Width" isRequired value={2} onChange={none} />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-required', 'true');
  });
});
