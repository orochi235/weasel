import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, expect, it, vi } from 'vitest';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';

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
        width: { kind: 'number', name: 'Width', description: '', default: 3 },
        label: { kind: 'string', name: 'Label', description: '', default: 'edge' },
      },
    },
  },
};

it('draws the fields a stored object omits at their defaults, and writes nothing for them', () => {
  const onChange = vi.fn();
  render(<PrefsForm layout="list" schema={SCHEMA} values={{ stroke: { on: true } }} onChange={onChange} />);
  expect(screen.getByRole('spinbutton', { name: 'Width' })).toHaveValue('3');
  expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('edge');
  expect(onChange).not.toHaveBeenCalled();
});
