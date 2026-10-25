import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { ActionsProvider } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { actionLeaf, actionLeafKey } from './editorActions';
import { PrefSchemaEditor, type PrefSchemaEditorProps } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';
import { RegisterAction } from '../../testing/registerAction';

const START: PrefGroup = {
  name: 'Tools',
  as: 'bar',
  children: {
    undo: { kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' },
    flatten: { kind: 'action', name: 'Flatten', description: '', default: undefined, action: 'layers.flatten' },
  },
};

const ACTIONS = [
  { key: 'edit.undo', label: 'Undo', group: 'Edit', shortcut: '⌘Z' },
  { key: 'edit.redo', label: 'Redo', group: 'Edit' },
  { key: 'view.snap', label: 'Snap' },
];

function Live(props: Partial<PrefSchemaEditorProps<PrefGroup>>) {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} {...props} />;
}

const actions = () => screen.getByRole('tree', { name: 'Actions' });
const structure = () => screen.getByRole('tree', { name: 'Schema structure' });

describe('PrefSchemaEditor actions', () => {
  it('lists the actions it is given under a group for their key’s path, each by label and the rest of its key', () => {
    renderWithIcons(<Live actions={ACTIONS} />);
    const row = (id: string) => actions().querySelector(`[data-tree-id="${id}"] > :first-child`)!;
    expect(row('edit')).toHaveTextContent('Edit edit');
    expect(row('edit/editRedo')).toHaveTextContent('Redo redo');
    expect(row('view/viewSnap')).toHaveTextContent('Snap snap');
    // The group says the prefix once.
    expect(within(actions()).queryByText('edit.redo')).toBeNull();
    // Its shortcut as keycaps, a key to a cap.
    expect(within(actions()).getByText('⌘')).toBeInTheDocument();
    expect(within(actions()).getByText('Z')).toBeInTheDocument();
  });

  it('lists them in the shelf beside the export, not under the structure tree', () => {
    renderWithIcons(<Live actions={ACTIONS} />);
    expect(screen.getByRole('region', { name: 'Structure' })).not.toContainElement(actions());
    expect(screen.getByRole('region', { name: 'Export' }).parentElement).toContainElement(actions());
  });

  it('lists what the registry above it can fire from a button, when given none', () => {
    renderWithIcons(
      <ActionsProvider>
        <RegisterAction action={{ id: 'file.save', label: 'Save', group: 'File', invoker: { timing: 'immediate', run: () => {} } }} />
        <Live />
      </ActionsProvider>,
    );
    expect(within(actions()).getByText('Save')).toBeInTheDocument();
    expect(within(actions()).getByText('file')).toBeInTheDocument();
  });

  it('draws no list with no actions and no registry, and marks nothing', () => {
    renderWithIcons(<Live />);
    expect(screen.queryByRole('tree', { name: 'Actions' })).toBeNull();
    expect(within(structure()).queryByText('no action')).toBeNull();
  });

  it('marks a pref that fires a key the list does not hold, and no other', () => {
    renderWithIcons(<Live actions={ACTIONS} />);
    const row = (key: string) => within(structure()).getByText(key).closest('[role="treeitem"]') as HTMLElement;
    expect(within(row('flatten')).getByText('no action')).toBeInTheDocument();
    expect(within(row('undo')).queryByText('no action')).toBeNull();
  });

  it('filters the list with the structure’s filter', () => {
    renderWithIcons(<Live actions={ACTIONS} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter structure' }), { target: { value: 'snap' } });
    expect(within(actions()).getByText('Snap')).toBeInTheDocument();
    expect(within(actions()).queryByText('Redo')).toBeNull();
  });

  it('offers an action pref’s key as a choice among the list, with a key it does not hold kept', () => {
    renderWithIcons(<Live actions={ACTIONS} />);
    fireEvent.click(within(structure()).getByText('flatten'));
    const attributes = screen.getByRole('region', { name: 'Attributes' });
    fireEvent.click(within(attributes).getByRole('button', { name: /Action/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Unset',
      'layers.flatten (not registered)',
      'Undo (edit.undo)',
      'Redo (edit.redo)',
      'Snap (view.snap)',
    ]);
  });

  it('draws the icon of the action an action pref fires beside its name, and none for a leaf with no icon', () => {
    const withIcon = [{ ...ACTIONS[0]!, icon: <svg data-testid="undo-icon" /> }, ...ACTIONS.slice(1)];
    renderWithIcons(<Live actions={withIcon} />);
    const attributes = () => screen.getByRole('region', { name: 'Attributes' });
    fireEvent.click(within(structure()).getByText('undo'));
    expect(within(attributes()).getByTestId('undo-icon')).toBeInTheDocument();
    fireEvent.click(within(structure()).getByText('flatten'));
    expect(within(attributes()).queryByTestId('undo-icon')).toBeNull();
  });

  it('holds a row under an actions pref for each action of its group, which takes no selection', () => {
    const run: PrefGroup = { name: 'Run', as: 'bar', children: { edit: { kind: 'actions', name: '', description: '', default: undefined, group: 'Edit' } } };
    renderWithIcons(<PrefSchemaEditor schema={run} onChange={() => {}} actions={ACTIONS} />);
    const under = structure().querySelectorAll('[data-tree-id^="edit#"]');
    expect([...under].map((row) => row.getAttribute('data-tree-id'))).toEqual(['edit#edit.undo', 'edit#edit.redo']);
    expect(under[0]).toHaveAttribute('aria-disabled', 'true');
    // Drawn as a grouping: a glyph, and the count of the actions it draws.
    expect(structure().querySelector('[data-tree-id="edit"] > :first-child')).toHaveTextContent(/2$/);
  });
});

describe('an action as a pref', () => {
  it('is plain data that fires the action by key', () => {
    expect(actionLeaf(ACTIONS[0]!)).toEqual({ kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' });
  });

  it('takes a schema key from the action key, which may hold what a key may not', () => {
    expect(actionLeafKey('edit.undo')).toBe('editUndo');
    expect(actionLeafKey('align:left')).toBe('alignLeft');
    expect(actionLeafKey('...')).toBe('action');
    expect(actionLeafKey('3d.toggle')).toBe('_3dToggle');
  });
});
