import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsDialog } from './PrefsDialog';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: true, ...extra }) as PrefLeaf;
const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const pointer = (of: string): PrefLeaf => ({ kind: 'alias', name: '', description: '', default: undefined, of }) as PrefLeaf;

// The schema the settings live in, which the form is not drawn from.
const dialog: PrefGroup = {
  name: 'Dialog',
  children: {
    on: flag('On'),
    open: flag('Open'),
    view: { name: 'View', showIf: { path: 'on' }, children: { grid: flag('Show grid', { enableIf: { path: 'open' } }) } },
    stroke: {
      kind: 'object', name: 'Stroke', description: '', default: { width: 0, dash: 0, cap: 0 },
      children: {
        width: num('Width'),
        dash: num('Dash', { showIf: { path: 'stroke.width', above: 0 } }),
        cap: num('Cap', { enableIf: { path: 'stroke.width', above: 0 } }),
      },
    } as PrefLeaf,
  },
};
// A panel of pointers into it.
const panel: PrefGroup = {
  name: 'Panel',
  children: { rows: { name: 'Rows', children: { grid: pointer('view.grid'), stroke: pointer('stroke') } } },
};

describe('PrefsForm over another schema', () => {
  it('draws an alias as the leaf of that schema at its path, where the form\'s own holds none', () => {
    const view = renderWithIcons(<PrefsForm schema={panel} values={{}} onChange={() => {}} />);
    expect(screen.getByText('(alias: no pref at view.grid)')).toBeInTheDocument();
    view.unmount();
    renderWithIcons(<PrefsForm schema={panel} values={{}} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeChecked();
  });

  it('reads the leaf\'s value at its path in the values, and writes there', () => {
    const onChange = vi.fn();
    renderWithIcons(<PrefsForm schema={panel} values={{ view: { grid: false } }} over={dialog} onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(onChange).toHaveBeenCalledWith('view.grid', true);
  });

  it('finds an alias\'s row by its leaf\'s name when filtered', () => {
    renderWithIcons(<PrefsForm schema={panel} values={{}} over={dialog} filterable onChange={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter Panel' }), { target: { value: 'show grid' } });
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
  });

  it('is handed on by a dialog to its form', () => {
    renderWithIcons(<PrefsDialog inline isOpen onOpenChange={() => {}} schema={panel} values={{}} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
  });

  it('leaves an alias out while a group above its leaf in that schema is not shown', () => {
    renderWithIcons(<PrefsForm schema={panel} values={{ on: false }} over={dialog} onChange={() => {}} />);
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeInTheDocument();
  });

  it('disables an alias while its leaf in that schema is', () => {
    const { rerender } = renderWithIcons(<PrefsForm schema={panel} values={{ open: false }} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeDisabled();
    rerender(<PrefsForm schema={panel} values={{}} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeEnabled();
  });

  it('reads a condition of that schema against that schema\'s defaults', () => {
    const shut: PrefGroup = { ...dialog, children: { ...dialog.children, on: flag('On', { default: false }) } };
    renderWithIcons(<PrefsForm schema={panel} values={{}} over={shut} onChange={() => {}} />);
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).toBeNull();
  });

  it('hides and disables the fields of an object leaf an alias shows, by that schema\'s conditions', () => {
    const { rerender } = renderWithIcons(<PrefsForm schema={panel} values={{}} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeEnabled();
    expect(screen.queryByRole('spinbutton', { name: 'Dash' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeDisabled();
    rerender(<PrefsForm schema={panel} values={{ stroke: { width: 2, dash: 0, cap: 0 } }} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'Dash' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeEnabled();
  });
});
