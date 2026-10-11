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
      default: { width: 1, miter: 4, dash: 0 },
      children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1 },
        miter: { kind: 'number', name: 'Miter', description: '', default: 4, hidden: true },
        more: {
          name: 'More',
          members: { dash: { kind: 'number', name: 'Dash', description: '', default: 0, hidden: true } },
        },
      },
    },
  },
};

it('leaves out a hidden field of an object leaf, and a section holding nothing else', () => {
  render(<PrefsForm layout="list" schema={SCHEMA} values={{}} onChange={() => {}} />);
  expect(screen.getByText('Width')).toBeInTheDocument();
  expect(screen.queryByText('Miter')).toBeNull();
  expect(screen.queryByText('Dash')).toBeNull();
  expect(screen.queryByText('More')).toBeNull();
});

it('draws them under showHidden', () => {
  render(<PrefsForm layout="list" schema={SCHEMA} values={{}} onChange={() => {}} showHidden />);
  for (const name of ['Width', 'Miter', 'More', 'Dash']) expect(screen.getByText(name)).toBeInTheDocument();
});

it('keeps a hidden field\'s value when a shown one is edited', () => {
  const onChange = vi.fn();
  render(<PrefsForm layout="list" schema={SCHEMA} values={{ stroke: { width: 1, miter: 9 } }} onChange={onChange} />);
  const width = screen.getByRole('spinbutton', { name: 'Width' });
  fireEvent.change(width, { target: { value: '3' } });
  fireEvent.blur(width);
  expect(onChange).toHaveBeenLastCalledWith('stroke', { width: 3, miter: 9 });
});
