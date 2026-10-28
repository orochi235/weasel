import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { PresetDescription } from '@weasel-js/core';
import { assets, attributes, Live, pickRow, row, structure } from './AssetEditor.fixture';
import { bundlesAsset, type Workspace } from './workspace';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const d = (id: string, more: Partial<PresetDescription> = {}): PresetDescription =>
  ({ id, label: id, package: 'pkg', atom: false, actions: [], tools: [], includes: [], ...more });

const PRESETS = [d('lock', { atom: true, actions: ['z'] }), d('inner', { actions: ['x'] }), d('outer', { includes: ['inner', 'lock'], tools: ['rect'] })];
const START: Workspace = { assets: [bundlesAsset('bundles', 'Feature bundles', PRESETS)] };

const exported = () => JSON.parse(screen.getByTestId('schema-literal').textContent!) as { format: string; changes: unknown[] };

describe('AssetEditor over a Bundles asset', () => {
  it('lists it under Bundles, and exports a weasel-bundles/1 document with no changes until one is made', () => {
    renderWithIcons(<Live start={START} />);
    expect(within(within(assets()).getByRole('group', { name: 'Bundles' })).getByRole('option', { name: 'Feature bundles' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'JSON' })).toBeInTheDocument();
    expect(exported()).toMatchObject({ format: 'weasel-bundles/1', changes: [] });
    pickRow('x');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(exported().changes).toEqual([{ op: 'exclude', kind: 'action', id: 'x', bundle: 'inner' }]);
  });

  it('shows an atom as one row whose attributes take no edit, and lists what it holds', () => {
    renderWithIcons(<Live start={START} />);
    pickRow('lock');
    expect(attributes().querySelector('fieldset')).toBeDisabled();
    expect(attributes().textContent).toContain('z');
    expect(row('lock').getAttribute('aria-expanded')).toBeNull();
  });

  it('lists every part in the shelf with the bundle that holds it', () => {
    renderWithIcons(<Live start={START} />);
    const parts = screen.getByRole('tree', { name: 'Parts' });
    const rect = within(parts).getAllByRole('treeitem').find((r) => r.textContent?.includes('rect'))!;
    expect(rect.textContent).toContain('outer');
  });
});
