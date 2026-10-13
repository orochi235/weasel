import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { ToolOptionsBar } from '../ToolOptionsBar/ToolOptionsBar';
import { Bar } from './Bar';

afterEach(cleanup);

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'toggle', ...extra }) as PrefLeaf;
const pointer = (of: string, name = ''): PrefLeaf => ({ kind: 'alias', name, description: '', default: undefined, of }) as PrefLeaf;

// The schema the settings live in, which the bar is not drawn from.
const dialog: PrefGroup = {
  name: 'Dialog',
  children: {
    on: flag('On'),
    open: flag('Open'),
    view: { name: 'View', showIf: { path: 'on' }, children: { grid: flag('Show grid', { enableIf: { path: 'open' } }) } },
  },
};
const bar: PrefGroup = {
  name: 'Tools',
  as: 'bar',
  children: { grid: pointer('view.grid'), more: { name: 'More', as: 'panel', children: { again: pointer('view.grid', 'Grid again') } } },
};

describe('Bar over another schema', () => {
  it('draws an alias as the leaf of that schema at its path, where the bar\'s own holds none', () => {
    const view = render(<Bar schema={bar} values={{ on: true, open: true }} />);
    expect(screen.getByText('(alias: no pref at view.grid)')).toBeInTheDocument();
    view.unmount();
    render(<Bar schema={bar} over={dialog} values={{ on: true, open: true, 'view.grid': true }} />);
    expect(screen.getByRole('button', { name: 'Show grid' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes at the leaf\'s path in that schema', () => {
    const onChange = vi.fn();
    render(<Bar schema={bar} over={dialog} values={{ on: true, open: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show grid' }));
    expect(onChange).toHaveBeenCalledWith('view.grid', true);
  });

  it('leaves the alias out while a group above its leaf in that schema is not shown, and disables it while the leaf is', () => {
    const hidden = render(<Bar schema={bar} over={dialog} values={{ on: false, open: true }} />);
    expect(screen.queryByRole('button', { name: 'Show grid' })).toBeNull();
    hidden.unmount();
    render(<Bar schema={bar} over={dialog} values={{ on: true, open: false }} />);
    expect(screen.getByRole('button', { name: 'Show grid' })).toBeDisabled();
  });

  it('draws the alias as a row of that leaf inside a group the bar opens from a button', () => {
    render(<Bar schema={bar} over={dialog} values={{ on: true, open: true, 'view.grid': true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Grid again', pressed: true })).toBeInTheDocument();
  });

  it('is handed on by a ToolOptionsBar to its bar', () => {
    render(<ToolOptionsBar label="Tool" schema={bar} over={dialog} values={{ on: true, open: true }} />);
    expect(screen.getByRole('button', { name: 'Show grid' })).toBeInTheDocument();
  });
});

describe('a condition of a Bar\'s own node that reads a pref of `over`', () => {
  const stored: PrefGroup = {
    name: 'Dialog',
    children: { slant: flag('Italic', { default: 'normal', encoding: { read: (held: unknown) => held === 'italic', write: (on: boolean) => (on ? 'italic' : 'normal') } }) },
  };
  const gated: PrefGroup = { name: 'Tools', as: 'bar', children: { tight: flag('Tight', { enableIf: { path: 'slant' } }) } };

  it('compares the value as that pref\'s control shows it', () => {
    const { rerender } = render(<Bar schema={gated} over={stored} values={{ slant: 'normal' }} />);
    expect(screen.getByRole('button', { name: 'Tight' })).toBeDisabled();
    rerender(<Bar schema={gated} over={stored} values={{ slant: 'italic' }} />);
    expect(screen.getByRole('button', { name: 'Tight' })).toBeEnabled();
  });

  it('compares the stored value with no `over` to say how it is shown', () => {
    render(<Bar schema={gated} values={{ slant: 'normal' }} />);
    expect(screen.getByRole('button', { name: 'Tight' })).toBeEnabled();
  });
});
