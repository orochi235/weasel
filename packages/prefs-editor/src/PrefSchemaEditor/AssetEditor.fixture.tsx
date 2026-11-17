import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { AssetEditor, type AssetEditorProps } from '@weasel-js/prefs-editor';
import { type AssetSet, assetSetCodec } from '@weasel-js/prefs/edit';
import { CODE, pointer, SETTINGS, ASSET_SET } from '@weasel-js/prefs/testing/editAssetSet';
import { keyedRow } from './treeRows.fixture';

const codec = assetSetCodec([]);

/** `ASSET_SET` with a panel that takes no edits, one of whose pointers names a setting the dialog does not hold. */
export const WITH_LOCKED: AssetSet = {
  assets: [
    ...ASSET_SET.assets,
    { id: 'layout', label: 'Layout', kind: 'layout', over: 'settings', readOnly: true, root: { name: 'Layout', children: { rows: { name: 'Rows', as: 'section', children: { snap: pointer('view.snap'), gone: pointer('view.gone') } } } } },
  ],
};

/** An editor over an asset set it keeps, with the list drawn. */
export function Live({ start = ASSET_SET, onChange, ...rest }: { start?: AssetSet; onChange?(next: AssetSet): void } & Partial<Omit<AssetEditorProps, 'assetSet' | 'onChange'>>) {
  const [assetSet, setAssetSet] = useState(start);
  return <AssetEditor list codec={codec} {...rest} assetSet={assetSet} onChange={(next) => { onChange?.(next); setAssetSet(next); }} />;
}

export const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
export const hasRow = (key: string): boolean => keyedRow(structure(), key) !== null;
export function row(key: string): HTMLElement {
  const found = keyedRow(structure(), key);
  if (!found) throw new Error(`No row in the structure tree shows the key "${key}".`);
  return found;
}
export const assets = () => screen.getByRole('listbox', { name: 'Assets' });
export const asset = (label: string) => within(assets()).getByRole('option', { name: new RegExp(`^${label}`) });
export const attributes = () => screen.getByRole('region', { name: 'Attributes' });
export const tool = (name: string) => screen.getByRole('button', { name });

export function pickRow(key: string): void {
  fireEvent.click(row(key).firstElementChild!);
}

/** Put the selected node under `key`, as typing it and leaving the field does. */
export function rekey(key: string): void {
  const field = within(attributes()).getByRole('textbox', { name: 'Key' });
  fireEvent.change(field, { target: { value: key } });
  fireEvent.blur(field);
}

export { CODE, SETTINGS, ASSET_SET };
