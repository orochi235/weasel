import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { actionCatalog } from './actionCatalog';
import { assets, attributes, Live, pickRow, structure, tool, WORKSPACE } from './AssetEditor.fixture';
import type { EditorAction } from './editorActions';
import { catalogOf, type Workspace } from './workspace';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const ACTIONS: readonly EditorAction[] = [
  { key: 'edit.copy', label: 'Copy', shortcut: '⌘C', group: 'Clipboard' },
  { key: 'edit.paste', label: 'Paste' },
  { key: 'save', label: 'Save' },
];
const WITH_CATALOG: Workspace = {
  assets: [...WORKSPACE.assets, { id: 'actions', label: 'Actions', kind: 'actions', root: actionCatalog(ACTIONS.slice(0, 2)) }],
};

const list = () => screen.getByRole('tree', { name: 'Actions' });
const pickAction = (id: string) => fireEvent.click(list().querySelector(`[data-tree-id="${id}"] > :first-child`)!);
const listed = () => [...list().querySelectorAll('[data-tree-id]')].map((row) => row.getAttribute('data-tree-id'));
const name = () => within(attributes()).getByRole('textbox', { name: 'Name' }) as HTMLInputElement;

function live(start: Workspace = WITH_CATALOG) {
  let latest = start;
  renderWithIcons(<Live start={start} actions={ACTIONS} onChange={(next) => { latest = next; }} />);
  return { catalog: () => catalogOf(latest)!.root as PrefGroup, workspace: () => latest };
}
const under = (group: PrefGroup, key: string) => (group.children[key] as PrefGroup).children;

describe('the action catalog in an asset editor', () => {
  it('is no asset to pick, and lists an action it does not hold yet', () => {
    live();
    expect(within(assets()).queryByText('Actions')).toBeNull();
    expect(listed()).toEqual(['edit', 'edit/editCopy', 'edit/editPaste', 'save']);
  });

  it('shows a picked action’s attributes: what its pref carries to edit, and what the registry says to read', () => {
    live();
    pickRow('view');
    pickAction('edit/editCopy');
    expect(name().value).toBe('Copy');
    expect(name().closest('fieldset:disabled')).toBeNull();
    expect(within(attributes()).queryByRole('textbox', { name: 'Key' })).toBeNull();
    expect(within(attributes()).queryByRole('button', { name: /Kind/ })).toBeNull();
    expect(attributes()).toHaveTextContent(/action.*edit\.copy/);
    expect(attributes()).toHaveTextContent(/registered group.*Clipboard/);
    expect(attributes()).toHaveTextContent(/shortcut.*⌘C/);
    // One pane's pick is the other's loss.
    expect(within(structure()).queryByRole('treeitem', { selected: true })).toBeNull();
    pickRow('view');
    expect(name().value).toBe('View');
    expect(within(list()).queryByRole('treeitem', { selected: true })).toBeNull();
  });

  it('keeps an edit to an action in the catalog, with the action it had not held, as a step to take back', () => {
    const { catalog } = live();
    pickAction('edit/editCopy');
    fireEvent.change(name(), { target: { value: 'Duplicate' } });
    expect(under(catalog(), 'edit').editCopy).toMatchObject({ name: 'Duplicate', action: 'edit.copy' });
    expect(Object.keys(catalog().children)).toEqual(['edit', 'save']);
    fireEvent.click(tool('Undo'));
    expect(under(catalog(), 'edit').editCopy).toMatchObject({ name: 'Copy' });
    // The step back was the catalog's, so the dialog shown stays.
    expect(within(assets()).getByRole('option', { selected: true })).toHaveTextContent('Settings');
  });

  it('adds a group after the picked row, and gives what a removed group held to the catalog', () => {
    const { catalog } = live();
    pickAction('edit');
    fireEvent.click(tool('Add action group'));
    expect(Object.keys(catalog().children)).toEqual(['edit', 'group', 'save']);
    expect(name().value).toBe('New group');
    pickAction('edit');
    fireEvent.click(tool('Remove from actions'));
    expect(Object.keys(catalog().children)).toEqual(['editCopy', 'editPaste', 'group', 'save']);
  });

  it('picks again, on a step back over an edit made in it, the rows that were picked in it', () => {
    live();
    pickAction('edit/editCopy');
    fireEvent.change(name(), { target: { value: 'Duplicate' } });
    pickRow('view');
    fireEvent.click(tool('Undo'));
    expect(within(list()).getByRole('treeitem', { selected: true })).toHaveAttribute('data-tree-id', 'edit/editCopy');
    expect(name().value).toBe('Copy');
  });

  it('removes what is picked among the actions on Delete, and nothing of the dialog', () => {
    const { catalog, workspace } = live();
    pickAction('edit');
    fireEvent.keyDown(list(), { key: 'Delete' });
    expect(Object.keys(catalog().children)).toEqual(['editCopy', 'editPaste', 'save']);
    expect(workspace().assets[0]!.root).toBe(WORKSPACE.assets[0]!.root);
  });

  it('lists the registry’s actions with nothing to sort them, where the workspace holds no catalog', () => {
    live(WORKSPACE);
    expect(listed()).toEqual(['edit', 'edit/editCopy', 'edit/editPaste', 'save']);
    expect(screen.queryByRole('button', { name: 'Add action group' })).toBeNull();
    pickAction('save');
    expect(name().value).toBe('Save');
    expect(name().closest('fieldset:disabled')).not.toBeNull();
  });
});
