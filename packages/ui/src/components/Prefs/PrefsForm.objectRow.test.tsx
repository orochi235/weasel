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
        width: { kind: 'number', name: 'Width', description: '', default: 1 },
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
