import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TBD_REST_KEY, type PrefGroup, type PrefLocus } from '@weasel-js/prefs';
import { PrefsForm } from './index';

afterEach(cleanup);

const MODE = { value: 'dark', label: 'Dark' };
const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    mode: {
      kind: 'enum', name: 'Mode', description: '', default: 'dark',
      options: [MODE, { value: 'light', label: 'Light' }, { value: 'types', label: 'Types' }],
    },
    limit: {
      kind: 'number', name: 'Limit', description: '', default: 9,
      per: [{ selector: 'mode', overrides: { types: 0 } }, { selector: 'layout' }],
    },
  },
};

const held: PrefLocus = { $by: 'mode', $in: { types: 0 }, [TBD_REST_KEY]: { $by: 'layout', $in: { a: 1 }, [TBD_REST_KEY]: 5 } };

function mount() {
  const on = { onChange: vi.fn(), onSplit: vi.fn(), onJoin: vi.fn(), onChangeAt: vi.fn() };
  render(<PrefsForm schema={SCHEMA} layout="list" values={{ limit: 5 }} loci={new Map([['limit', held]])} {...on} />);
  return on;
}

describe('a value kept per a closed selector in PrefsForm', () => {
  it('draws a row for each option it names and one Others row for the shared member, which an edit writes', () => {
    const { onChangeAt } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Limit by Mode' }));
    const members = screen.getByRole('group', { name: 'Limit by Mode' });
    expect(within(members).getAllByRole('spinbutton')).toHaveLength(2);
    expect(within(members).getByRole('spinbutton', { name: 'Limit, Types' })).toHaveValue('0');
    const others = within(members).getByRole('spinbutton', { name: 'Limit, Others' });
    expect(others).toHaveValue('5');
    fireEvent.change(others, { target: { value: '7' } });
    fireEvent.blur(others);
    expect(onChangeAt).toHaveBeenCalledWith('limit', 7, { mode: 'dark' });
  });

  it('offers neither a split nor a join', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Limit by Mode' }));
    expect(screen.queryByRole('button', { name: /^(Split|Join) / })).toBeNull();
  });
});
