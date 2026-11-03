import { act, fireEvent, render, screen } from '@testing-library/react';
import type { PrefNumber } from '@weasel-js/prefs';
import { decimal } from '@weasel-js/quantity';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropertyField } from '../Properties/PropertyField';
import { prefFieldProps } from './prefField';

const length = (extra: Partial<PrefNumber> = {}): PrefNumber =>
  ({ kind: 'number', name: 'Length', description: '', default: 0, unit: { scale: 1, precision: 2, suffix: 'in' }, ...extra }) as PrefNumber;

function field(pref: PrefNumber, value: number) {
  const setValue = vi.fn();
  const props = prefFieldProps(pref, { value, setValue }, 'form');
  if (props?.kind !== 'number') throw new Error('not a number field');
  const view = render(<PropertyField {...props} label="Length" settleWhenIdle />);
  const rerender = (next: number) => {
    const again = prefFieldProps(pref, { value: next, setValue }, 'form');
    if (again?.kind !== 'number') throw new Error('not a number field');
    view.rerender(<PropertyField {...again} label="Length" settleWhenIdle />);
  };
  return { setValue, rerender, input: screen.getByRole('spinbutton', { name: 'Length' }) };
}

afterEach(() => vi.useRealTimers());

describe('a number leaf whose unit sets a precision', () => {
  it('shows that many places, trailing zeros included', () => {
    expect(field(length(), 1.5).input).toHaveValue('1.50');
  });

  it('rounds to it', () => {
    expect(field(length(), 2.214).input).toHaveValue('2.21');
  });

  it('leaves what is typed alone while typing, through an idle settle', () => {
    vi.useFakeTimers();
    const { input, setValue, rerender } = field(length(), 2);
    input.focus();
    fireEvent.change(input, { target: { value: '1.5' } });
    act(() => vi.advanceTimersByTime(5000));
    expect(setValue).toHaveBeenLastCalledWith(1.5);
    rerender(1.5);
    expect(input).toHaveValue('1.5');
  });

  it('pads the committed value once the field is left', () => {
    const { input, setValue, rerender } = field(length(), 2);
    input.focus();
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(setValue).toHaveBeenLastCalledWith(1.5);
    rerender(1.5);
    expect(input).toHaveValue('1.50');
  });

  it("keeps the leaf's own display over the unit's", () => {
    expect(field(length({ display: decimal({ places: 3 }) }), 1.5).input).toHaveValue('1.500');
  });
});
