import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { PropertyControl } from '../Properties/PropertyField';
import { prefFieldProps } from './prefField';

const STROKE: PrefLeaf = { kind: 'color', name: 'Stroke', description: '', default: '#336699', alpha: true };

function draw(state: { value: unknown; unset?: boolean; mixed?: boolean }) {
  const setValue = vi.fn();
  const field = prefFieldProps(STROKE, { ...state, setValue });
  if (field === null) throw new Error('expected a field');
  render(<PropertyControl {...field} name="Stroke" />);
  return setValue;
}

describe('a color leaf that holds nothing', () => {
  it('shows no color rather than the default, as a mixed one does', () => {
    draw({ value: undefined, unset: true });
    expect(screen.getByLabelText('Stroke').closest('[data-unset]')).not.toBeNull();
    expect(screen.getByLabelText('Stroke')).not.toHaveValue('#336699');
  });

  it('takes no opacity edit until a color is picked, which would write the default back', () => {
    draw({ value: undefined, unset: true });
    expect(screen.getByRole('slider', { name: 'Stroke opacity' })).toBeDisabled();
  });

  it('shows a held color as it is', () => {
    draw({ value: '#112233ff' });
    expect(screen.getByLabelText('Stroke')).toHaveValue('#112233');
    expect(screen.getByRole('slider', { name: 'Stroke opacity' })).not.toBeDisabled();
  });
});
