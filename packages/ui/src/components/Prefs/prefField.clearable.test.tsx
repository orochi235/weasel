import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefNumber } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from '../Properties/PropertyField';
import { prefFieldProps } from './prefField';

const number = (extra: Partial<PrefNumber> = {}): PrefNumber =>
  ({ kind: 'number', name: 'Gap', description: '', default: 4, ...extra }) as PrefNumber;

function field(pref: PrefNumber, value: unknown) {
  const setValue = vi.fn();
  const props = prefFieldProps(pref, { value, setValue }, 'form');
  if (props?.kind !== 'number') throw new Error('not a number field');
  render(<PropertyField {...props} label="Gap" />);
  return { setValue, input: screen.getByRole('spinbutton', { name: 'Gap' }) };
}

describe('prefFieldProps for a clearable number', () => {
  it('writes undefined when the field is emptied and left', () => {
    const { setValue, input } = field(number({ clearable: true }), 3);
    input.focus();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(setValue.mock.calls).toEqual([[undefined]]);
  });

  it('puts the value back in a number that is not clearable', () => {
    const { setValue, input } = field(number(), 3);
    input.focus();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(setValue).not.toHaveBeenCalled();
    expect(input).toHaveValue('3');
  });

  it('bounds the value by a minimum alone', () => {
    const { setValue, input } = field(number({ min: 2 }), 3);
    input.focus();
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);
    expect(setValue.mock.calls).toEqual([[2]]);
  });
});
