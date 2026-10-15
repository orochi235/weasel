import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import type { DraftStorage } from './document';
import { draftChangedAssets } from './draftChangedAssets';
import { setAttribute } from './schemaEdit';
import { assetOf, type Workspace } from './workspace';
import { SETTINGS, WORKSPACE } from './workspace.fixtures';
import { workspaceCodec } from './workspaceCodec';
import { editAsset, NO_MOVES } from './workspaceEdit';

const KEY = 'ws';
const codec = workspaceCodec([]);
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

const rootOf = (ws: Workspace, id: string) => assetOf(ws, id)!.root;
const nameGrid = (ws: Workspace, name: string): Workspace =>
  editAsset(ws, 'settings', setAttribute(rootOf(ws, 'settings'), 'view/grid', 'name', name), NO_MOVES);

describe('draftChangedAssets', () => {
  it('names the assets a stored draft changes, and no other', () => {
    const storage = memory();
    codec.saveDraft(KEY, nameGrid(WORKSPACE, 'Lines'), WORKSPACE, NO_STEPS, 5, storage);
    expect([...draftChangedAssets(KEY, WORKSPACE, codec, storage)]).toEqual(['settings']);
  });

  it('names none where nothing is stored', () => {
    expect(draftChangedAssets(KEY, WORKSPACE, codec, memory()).size).toBe(0);
  });

  it('names none for a draft the source has caught up with, and leaves it stored', () => {
    const storage = memory();
    codec.saveDraft(KEY, nameGrid(WORKSPACE, 'Lines'), WORKSPACE, NO_STEPS, 5, storage);
    const kept = storage.held.get(KEY);
    const view = SETTINGS.children.view as PrefGroup;
    const grid = { ...view.children.grid!, name: 'Lines' };
    const caughtUp: Workspace = {
      assets: [{ ...WORKSPACE.assets[0]!, root: { ...SETTINGS, children: { ...SETTINGS.children, view: { ...view, children: { ...view.children, grid } } } } }, ...WORKSPACE.assets.slice(1)],
    };
    expect(draftChangedAssets(KEY, caughtUp, codec, storage).size).toBe(0);
    expect(storage.held.get(KEY)).toBe(kept);
  });
});
