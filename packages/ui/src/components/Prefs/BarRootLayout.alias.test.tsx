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

const fields = (): string[] =>
  within(screen.getByRole('toolbar')).getAllByRole('spinbutton').map((f) => f.getAttribute('aria-label') ?? '');

describe('an alias on a vertical bar', () => {
  it('draws as the field it shows, named for that leaf where the alias gives no name, in a form as in a Bar', () => {
    render(<PrefsForm schema={SCHEMA} orientation="vertical" values={{}} onChange={() => {}} />);
    const inForm = fields();
    expect(inForm).toEqual(['Size', 'Size', 'Size here']);
    cleanup();
    render(<Bar schema={SCHEMA} orientation="vertical" label="Tools" values={{}} />);
    expect(fields()).toEqual(inForm);
  });

  it('says so in a cell for an alias of nothing on a bar that runs across, in a form as in a Bar', () => {
    render(<PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} />);
    const said = screen.getByText('(alias: no pref at nowhere)');
    expect(within(screen.getByRole('toolbar')).getByText(said.textContent!)).toBe(said);
    cleanup();
    render(<Bar schema={SCHEMA} label="Tools" values={{}} />);
    expect(within(screen.getByRole('toolbar')).getByText('(alias: no pref at nowhere)')).toBeInTheDocument();
  });

  it('writes at the path of the leaf it shows', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={SCHEMA} orientation="vertical" values={{ size: 7 }} onChange={onChange} />);
    const field = within(screen.getByRole('toolbar')).getAllByRole('spinbutton', { name: 'Size' })[1]!;
    expect(field).toHaveValue('7');
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('size', 9);
  });
});
