import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { asset, attributes, Live, pickRow, row, structure, tool, WITH_LOCKED } from './AssetEditor.fixture';
import { addNode, type AssetSet } from '@weasel-js/prefs/edit';
import { CODE, ASSET_SET } from '@weasel-js/prefs/testing/editAssetSet';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

afterEach(cleanup);

const dragTool = (name: string) => within(screen.getByRole('group', { name: 'Drag to add' })).getByRole('button', { name });

describe('AssetEditor on a panel', () => {
  it('offers a panel nothing that holds a value or a page, and a dialog all of it', () => {
    renderWithIcons(<Live />);
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
    let latest: AssetSet = ASSET_SET;
    renderWithIcons(<Live onChange={(next) => { latest = next; }} />);
    fireEvent.click(asset('Code'));
    fireEvent.click(tool('Add group'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Rows' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(latest.assets[1]!.root).toMatchObject({ children: { rows: { name: 'Rows', as: 'section' } } });
  });

  it('offers no kind to turn a panel\'s label into a setting', () => {
    const start: AssetSet = { assets: [ASSET_SET.assets[0]!, { ...ASSET_SET.assets[1]!, root: addNode(CODE, null, 'note', { kind: 'label', name: 'Note', description: '', default: undefined }) }] };
    renderWithIcons(<Live start={start} />);
    fireEvent.click(asset('Code'));
    pickRow('note');
    expect(within(attributes()).getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(within(attributes()).queryByText('Kind')).toBeNull();
  });

  it('names a pointer\'s row as the setting it points at, and a dead one by its key', () => {
    renderWithIcons(<Live start={WITH_LOCKED} />);
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
