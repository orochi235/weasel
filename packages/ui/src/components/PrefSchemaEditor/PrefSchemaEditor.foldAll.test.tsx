import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { rowKey } from './treeRows.fixture';

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', as: 'page', children: { grid: flag('Grid'), rulers: { name: 'Rulers', as: 'section', children: { units: flag('Units') } } } },
    edit: { name: 'Edit', as: 'page', children: { snap: flag('Snap') } },
  },
};

const tree = () => within(screen.getByRole('tree', { name: 'Schema structure' }));
const keys = () => tree().getAllByRole('treeitem').map(rowKey);

describe('PrefSchemaEditor structure folds', () => {
  it('folds every branch from Collapse all, and opens every one from Expand all', () => {
    render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
    const header = within(screen.getByRole('region', { name: 'Structure' }));
    fireEvent.click(header.getByRole('button', { name: 'Collapse all' }));
    expect(keys()).toEqual(['view', 'edit']);
    fireEvent.click(header.getByRole('button', { name: 'Expand all' }));
    expect(keys()).toEqual(['view', 'grid', 'rulers', 'units', 'edit', 'snap']);
  });

  it('offers neither while a filter is set', () => {
    render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter structure' }), { target: { value: 'snap' } });
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeDisabled();
  });
});
