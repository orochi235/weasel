import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from '../Bar/Bar';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 4 }) as PrefLeaf;
const pointer = (of: string, name = ''): PrefLeaf => ({ kind: 'alias', name, description: '', default: undefined, of }) as PrefLeaf;

const SCHEMA: PrefGroup = {
  name: 'Tools',
  as: 'bar',
  children: { size: num('Size'), again: pointer('size'), named: pointer('size', 'Size here'), lost: pointer('nowhere') },
};

const buttons = (): string[] => within(screen.getByRole('toolbar')).getAllByRole('button').map((b) => b.textContent ?? '');

describe('a vertical bar\'s popover for an alias', () => {
  it('is named for the leaf the alias shows where the alias gives no name, in a form as in a Bar', () => {
    render(<PrefsForm schema={SCHEMA} orientation="vertical" values={{}} onChange={() => {}} />);
    const inForm = buttons();
    expect(inForm).toEqual(['Size', 'Size', 'Size here', 'Alias']);
    cleanup();
    render(<Bar schema={SCHEMA} orientation="vertical" label="Tools" values={{}} />);
    expect(buttons()).toEqual(inForm);
  });

  it('says so in a cell for an alias of nothing on a bar that runs across, in a form as in a Bar', () => {
    render(<PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} />);
    const said = screen.getByText('(alias: no pref at nowhere)');
    expect(within(screen.getByRole('toolbar')).getByText(said.textContent!)).toBe(said);
    cleanup();
    render(<Bar schema={SCHEMA} label="Tools" values={{}} />);
    expect(within(screen.getByRole('toolbar')).getByText('(alias: no pref at nowhere)')).toBeInTheDocument();
  });

  it('opens the row of that leaf, which writes at its path', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={SCHEMA} orientation="vertical" values={{ size: 7 }} onChange={onChange} />);
    fireEvent.click(within(screen.getByRole('toolbar')).getAllByRole('button', { name: 'Size' })[1]!);
    const field = within(screen.getByRole('dialog', { name: 'Size' })).getByRole('spinbutton', { name: 'Size' });
    expect(field).toHaveValue('7');
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('size', 9);
  });
});
