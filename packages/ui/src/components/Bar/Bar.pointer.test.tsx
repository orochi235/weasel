import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from './Bar';

afterEach(cleanup);

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'toggle', ...extra }) as PrefLeaf;
const pointer = (of: string, name = ''): PrefLeaf => ({ kind: 'alias', name, description: '', default: undefined, of }) as PrefLeaf;

const schema: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    open: flag('Open'),
    bold: flag('Bold', { enableIf: { path: 'open' } }),
    again: pointer('bold', 'Bold again'),
    more: { name: 'More', as: 'panel', children: { third: pointer('bold') } },
    lost: pointer('nowhere'),
  },
};

describe('an alias in a Bar', () => {
  it('draws the control of the leaf it shows, over that leaf\'s value, under its own name', () => {
    render(<Bar schema={schema} values={{ open: true, bold: true }} />);
    expect(screen.getByRole('button', { name: 'Bold again' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('(alias: no pref at nowhere)')).toBeInTheDocument();
  });

  it('writes at the path of the leaf it shows', () => {
    const onChange = vi.fn();
    render(<Bar schema={schema} values={{ open: true, bold: false }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bold again' }));
    expect(onChange).toHaveBeenCalledWith('bold', true);
  });

  it('is disabled while the leaf it shows is', () => {
    render(<Bar schema={schema} values={{ open: false }} />);
    expect(screen.getByRole('button', { name: 'Bold again' })).toBeDisabled();
  });

  it('is a row of the leaf it shows inside a group the bar opens from a button', () => {
    render(<Bar schema={schema} values={{ open: true, bold: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Bold', pressed: true })).toBeInTheDocument();
  });
});
