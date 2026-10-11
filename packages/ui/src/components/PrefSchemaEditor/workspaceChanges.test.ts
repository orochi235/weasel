import { describe, expect, it } from 'vitest';
import { removeLayoutNodes } from './layoutEdit';
import { renameKey } from './schemaEdit';
import { CODE, SETTINGS, WORKSPACE } from './workspace.fixtures';
import { changedAsset, workspaceChanges } from './workspaceChanges';
import { editAsset, movesOfRename } from './workspaceEdit';

describe('workspaceChanges', () => {
  it('lists nothing for a workspace at its baseline', () => {
    expect(workspaceChanges(WORKSPACE, WORKSPACE)).toEqual([]);
  });

  it('lists a rename under its dialog and the pointer that followed under its layout', () => {
    const next = editAsset(WORKSPACE, 'settings', renameKey(SETTINGS, 'view/grid', 'lines'), movesOfRename(SETTINGS, 'view/grid', 'lines'));
    expect(workspaceChanges(WORKSPACE, next)).toEqual([
      { id: 'settings', changes: [{ op: 'move', from: 'view/grid', to: 'view/lines' }] },
      { id: 'code', changes: [{ op: 'attr', path: 'grid', key: 'of', from: 'view.grid', to: 'view.lines' }] },
    ]);
  });
});

describe('changedAsset', () => {
  it('is the dialog when a step changed it and the layouts over it', () => {
    const next = editAsset(WORKSPACE, 'settings', renameKey(SETTINGS, 'view/grid', 'lines'), movesOfRename(SETTINGS, 'view/grid', 'lines'));
    expect(changedAsset(WORKSPACE, next)).toBe('settings');
  });

  it('is the layout when a step changed only that', () => {
    expect(changedAsset(WORKSPACE, editAsset(WORKSPACE, 'code', removeLayoutNodes(CODE, ['snap'])))).toBe('code');
  });

  it('is nothing when a step changed no asset', () => {
    expect(changedAsset(WORKSPACE, WORKSPACE)).toBeUndefined();
  });
});
