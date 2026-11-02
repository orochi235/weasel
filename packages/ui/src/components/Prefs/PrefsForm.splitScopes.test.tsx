import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PREF_ELSE, type PrefGroup, type PrefScope } from '@weasel-js/prefs';
import { PrefsForm } from './index';

afterEach(cleanup);

const MODE = { value: 'dark', label: 'Dark' };
const SCHEMA: PrefGroup = {
  name: 'Prefs',
  admits: ['layout'],
  children: {
    mode: {
      kind: 'enum', name: 'Mode', description: '', default: 'dark',
      options: [MODE, { value: 'light', label: 'Light' }, { value: 'types', label: 'Types' }],
    },
    limit: {
      kind: 'number', name: 'Limit', description: '', default: 9,
      scopes: [{ selector: 'mode', overrides: { types: 0 } }, { selector: 'layout' }],
    },
  },
};

const held: PrefScope = { $by: 'mode', $in: { types: 0 }, [PREF_ELSE]: { $by: 'layout', $in: { a: 1 }, [PREF_ELSE]: 5 } };

function mount(othersLabel?: string) {
  const on = { onChange: vi.fn(), onChangeAt: vi.fn() };
  render(<PrefsForm schema={SCHEMA} layout="list" values={{ limit: 5 }} scopes={new Map([['limit', held]])} othersLabel={othersLabel} {...on} />);
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

  it('calls the shared row what othersLabel says', () => {
    mount('Every other mode');
    fireEvent.click(screen.getByRole('button', { name: 'Limit by Mode' }));
    expect(screen.getByRole('spinbutton', { name: 'Limit, Every other mode' })).toHaveValue('5');
  });

  it('offers no way for the reader to split or join a value', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Limit by Mode' }));
    expect(screen.queryByRole('button', { name: /^(Split|Join) / })).toBeNull();
  });
});
