import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { asset, attributes, Live, pickRow, row, structure, tool, WITH_LOCKED } from './AssetEditor.fixture';
import { addNode } from './schemaEdit';
import type { Workspace } from './workspace';
import { CODE, WORKSPACE } from './workspace.fixtures';

afterEach(cleanup);

const dragTool = (name: string) => within(screen.getByRole('group', { name: 'Drag to add' })).getByRole('button', { name });

describe('AssetEditor on a panel', () => {
  it('offers a panel nothing that holds a value or a page, and a dialog all of it', () => {
    render(<Live />);
    expect(tool('Add pref')).toBeEnabled();
    expect(dragTool('Page')).toBeEnabled();
    fireEvent.click(asset('Code'));
    expect(tool('Add pref')).toBeDisabled();
    expect(dragTool('Page')).toBeDisabled();
    for (const name of ['Tab', 'Panel', 'Section', 'Group', 'Bar', 'Label', 'Separator']) expect(dragTool(name)).toBeEnabled();
    expect(tool('Add group')).toBeEnabled();
    fireEvent.click(asset('Settings'));
    expect(tool('Add pref')).toBeEnabled();
    expect(dragTool('Page')).toBeEnabled();
  });

  it('adds a panel a heading over its rows, not a page', () => {
    let latest: Workspace = WORKSPACE;
    render(<Live onChange={(next) => { latest = next; }} />);
    fireEvent.click(asset('Code'));
    fireEvent.click(tool('Add group'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Rows' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(latest.assets[1]!.root).toMatchObject({ children: { rows: { name: 'Rows', as: 'section' } } });
  });

  it('offers no kind to turn a panel\'s label into a setting', () => {
    const start: Workspace = { assets: [WORKSPACE.assets[0]!, { ...WORKSPACE.assets[1]!, root: addNode(CODE, null, 'note', { kind: 'label', name: 'Note', description: '', default: undefined }) }] };
    render(<Live start={start} />);
    fireEvent.click(asset('Code'));
    pickRow('note');
    expect(within(attributes()).getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(within(attributes()).queryByText('Kind')).toBeNull();
  });

  it('names a pointer\'s row as the setting it points at, and a dead one by its key', () => {
    render(<Live start={WITH_LOCKED} />);
    fireEvent.click(asset('Code'));
    expect(row('grid')).toHaveAccessibleName(/^Show grid grid\b/);
    expect(row('snap')).toHaveAccessibleName(/^Snap snap\b/);
    fireEvent.click(asset('Layout'));
    expect(within(structure()).getByText('gone')).toBeInTheDocument();
    expect(within(row('gone')).getByText('no setting')).toBeInTheDocument();
    // Its key is the whole label, with no name before it and so no key set apart after one.
    expect(row('gone').querySelector('[class*="treeKey"]')).toBeNull();
  });
});
