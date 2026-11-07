import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefNumber } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from '../Properties/PropertyField';
import { prefFieldProps } from './prefField';

const count = (extra: Partial<PrefNumber> = {}): PrefNumber =>
  ({ kind: 'number', name: 'Segments', description: '', default: 16, min: 1, max: 1000, step: 1, control: 'slider', scale: 'log', ...extra }) as PrefNumber;

function drag(pref: PrefNumber, value: number, to: string) {
  const setValue = vi.fn();
  const props = prefFieldProps(pref, { value, setValue });
  if (props?.kind !== 'number') throw new Error('not a number field');
  render(<PropertyField {...props} label="Segments" />);
  fireEvent.input(screen.getByRole('slider'), { target: { value: to } });
  return setValue;
}

describe('a number leaf with a scale', () => {
  it('spaces its slider by the scale and stores a value on its step', () => {
    expect(drag(count(), 16, '0.5')).toHaveBeenLastCalledWith(32);
  });

  it('spaces the shown values under a unit', () => {
    const shownPercent = count({ min: 0.01, max: 10, step: 0.01, unit: { scale: 0.01, suffix: '%' } });
    expect(drag(shownPercent, 0.16, '0.5')).toHaveBeenLastCalledWith(0.32);
  });

  it('runs a linear track in value units', () => {
    const setValue = drag(count({ scale: 'linear' }), 16, '500');
    expect(setValue).toHaveBeenLastCalledWith(500);
  });
});
