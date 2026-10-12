import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { AssetEditor, type AssetEditorProps } from './AssetEditor';
import type { Workspace } from './workspace';
import { CODE, pointer, SETTINGS, WORKSPACE } from './workspace.fixtures';
import { workspaceCodec } from './workspaceCodec';

const codec = workspaceCodec([]);

/** `WORKSPACE` with a panel that takes no edits, one of whose pointers names a setting the dialog does not hold. */
export const WITH_LOCKED: Workspace = {
  assets: [
    ...WORKSPACE.assets,
    { id: 'layout', label: 'Layout', kind: 'layout', over: 'settings', readOnly: true, root: { name: 'Layout', children: { rows: { name: 'Rows', as: 'section', children: { snap: pointer('view.snap'), gone: pointer('view.gone') } } } } },
  ],
};

/** An editor over a workspace it keeps, with the list drawn. */
export function Live({ start = WORKSPACE, onChange, ...rest }: { start?: Workspace; onChange?(next: Workspace): void } & Partial<Omit<AssetEditorProps, 'workspace' | 'onChange'>>) {
  const [workspace, setWorkspace] = useState(start);
  return <AssetEditor list codec={codec} {...rest} workspace={workspace} onChange={(next) => { onChange?.(next); setWorkspace(next); }} />;
}

export const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
/** The label of the node under `key` in the tree: a named node's ends in its key, and an unnamed one's is its key. */
const label = (key: string): HTMLElement => within(structure()).queryByText(`(${key})`) ?? within(structure()).getByText(key);
export const row = (key: string): HTMLElement => label(key).closest<HTMLElement>('[role="treeitem"]')!;
export const hasRow = (key: string): boolean => (within(structure()).queryByText(`(${key})`) ?? within(structure()).queryByText(key)) !== null;
export const assets = () => screen.getByRole('listbox', { name: 'Assets' });
export const asset = (label: string) => within(assets()).getByRole('option', { name: new RegExp(`^${label}`) });
export const attributes = () => screen.getByRole('region', { name: 'Attributes' });
export const tool = (name: string) => screen.getByRole('button', { name });

export function pickRow(key: string): void {
  fireEvent.click(label(key));
}

/** Put the selected node under `key`, as typing it and leaving the field does. */
export function rekey(key: string): void {
  const field = within(attributes()).getByRole('textbox', { name: 'Key' });
  fireEvent.change(field, { target: { value: key } });
  fireEvent.blur(field);
}

export { CODE, SETTINGS, WORKSPACE };
