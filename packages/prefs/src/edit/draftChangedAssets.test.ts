import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import type { DraftStorage } from './document';
import { draftChangedAssets } from './draftChangedAssets';
import { setAttribute } from './schemaEdit';
import { assetOf, type AssetSet } from './assetSet';
import { SETTINGS, ASSET_SET } from '../testing/editAssetSet';
import { assetSetCodec } from './assetSetCodec';
import { editAsset, NO_MOVES } from './assetSetEdit';

const KEY = 'ws';
const codec = assetSetCodec([]);
const NO_STEPS = { version: 1 as const, undoStack: [], redoStack: [], nextEntryId: 0, droppedEntries: 0 };

function memory(): DraftStorage & { held: Map<string, string> } {
  const held = new Map<string, string>();
  return {
    held,
    getItem: (k) => held.get(k) ?? null,
    setItem: (k, v) => void held.set(k, v),
    removeItem: (k) => void held.delete(k),
  };
}

const rootOf = (ws: AssetSet, id: string) => assetOf(ws, id)!.root;
const nameGrid = (ws: AssetSet, name: string): AssetSet =>
  editAsset(ws, 'settings', setAttribute(rootOf(ws, 'settings'), 'view/grid', 'name', name), NO_MOVES);

describe('draftChangedAssets', () => {
  it('names the assets a stored draft changes, and no other', () => {
    const storage = memory();
    codec.saveDraft(KEY, nameGrid(ASSET_SET, 'Lines'), ASSET_SET, NO_STEPS, 5, storage);
    expect([...draftChangedAssets(KEY, ASSET_SET, codec, storage)]).toEqual(['settings']);
  });

  it('names none where nothing is stored', () => {
    expect(draftChangedAssets(KEY, ASSET_SET, codec, memory()).size).toBe(0);
  });

  it('names none for a draft the source has caught up with, and leaves it stored', () => {
    const storage = memory();
    codec.saveDraft(KEY, nameGrid(ASSET_SET, 'Lines'), ASSET_SET, NO_STEPS, 5, storage);
    const kept = storage.held.get(KEY);
    const view = SETTINGS.children.view as PrefGroup;
    const grid = { ...view.children.grid!, name: 'Lines' };
    const caughtUp: AssetSet = {
      assets: [{ ...ASSET_SET.assets[0]!, root: { ...SETTINGS, children: { ...SETTINGS.children, view: { ...view, children: { ...view.children, grid } } } } }, ...ASSET_SET.assets.slice(1)],
    };
    expect(draftChangedAssets(KEY, caughtUp, codec, storage).size).toBe(0);
    expect(storage.held.get(KEY)).toBe(kept);
  });
});
