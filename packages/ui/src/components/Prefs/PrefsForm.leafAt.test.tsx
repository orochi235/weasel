import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsDialog } from './PrefsDialog';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

// A panel of aliases into a schema the form is not given.
const panel: PrefGroup = {
  name: 'Panel',
  children: { rows: { name: 'Rows', children: { grid: { kind: 'alias', name: '', description: '', default: undefined, of: 'view.grid' } } } },
};
const grid: PrefLeaf = { kind: 'boolean', name: 'Show grid', description: '', default: true };
const leafAt = (path: string): PrefLeaf | undefined => (path === 'view.grid' ? grid : undefined);

describe('PrefsForm leafAt', () => {
  it('draws an alias as the leaf the host finds at its path, where the form\'s own schema holds none', () => {
    const view = render(<PrefsForm schema={panel} values={{}} onChange={() => {}} />);
    expect(screen.getByText('(alias: no pref at view.grid)')).toBeInTheDocument();
    view.unmount();
    render(<PrefsForm schema={panel} values={{}} leafAt={leafAt} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeChecked();
  });

  it('writes at the path the leaf was found at', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={panel} values={{}} leafAt={leafAt} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(onChange).toHaveBeenCalledWith('view.grid', false);
  });

  it('finds an alias\'s row by its leaf\'s name when filtered', () => {
    render(<PrefsForm schema={panel} values={{}} leafAt={leafAt} filterable onChange={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter Panel' }), { target: { value: 'show grid' } });
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
  });

  it('is handed on by a dialog to its form', () => {
    render(<PrefsDialog inline isOpen onOpenChange={() => {}} schema={panel} values={{}} leafAt={leafAt} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
  });
});
