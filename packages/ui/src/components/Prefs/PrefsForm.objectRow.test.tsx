import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    stroke: {
      kind: 'object',
      name: 'Stroke',
      description: '',
      default: { on: false, width: 1 },
      children: {
        on: { kind: 'boolean', name: 'Visible', description: '', default: false },
        width: { kind: 'number', name: 'Width', description: 'In pixels.', default: 1 },
      },
    },
  },
};

it('does not hand a click on an object leaf\'s name to its first field', () => {
  const onChange = vi.fn();
  render(<PrefsForm layout="list" schema={SCHEMA} values={{}} onChange={onChange} />);
  fireEvent.click(screen.getByText('Stroke'));
  expect(onChange).not.toHaveBeenCalled();
});

it('offers an object leaf\'s field its description, as a row of its own has', () => {
  render(<PrefsForm layout="list" schema={SCHEMA} values={{}} onChange={() => {}} />);
  const control = (name: string): Element | null =>
    screen.getByText(name).closest('[data-property-row]')!.querySelector('[aria-describedby]');
  expect(control('Width')).not.toBeNull();
  expect(control('Visible')).toBeNull();
});

it('writes a field over the leaf\'s default where what is stored is no object, so the value is whole', () => {
  const onChange = vi.fn();
  render(<PrefsForm layout="list" schema={SCHEMA} values={{ stroke: 'thin' }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Visible' }));
  expect(onChange).toHaveBeenLastCalledWith('stroke', { on: true, width: 1 });
});
