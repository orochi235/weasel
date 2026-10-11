import { describe, expect, it } from 'vitest';
import { WORKSPACE } from './workspace.fixtures';
import { changedAsset, workspaceChanges } from './workspaceChanges';
import { removeInAsset, renameInAsset } from './workspaceEdit';

describe('workspaceChanges', () => {
  it('lists nothing for a workspace at its baseline', () => {
    expect(workspaceChanges(WORKSPACE, WORKSPACE)).toEqual([]);
  });

  it('lists a rename under its dialog and the pointer that followed under its layout', () => {
    const next = renameInAsset(WORKSPACE, 'settings', 'view/grid', 'lines');
    expect(workspaceChanges(WORKSPACE, next)).toEqual([
      { id: 'settings', changes: [{ op: 'move', from: 'view/grid', to: 'view/lines' }] },
      { id: 'code', changes: [{ op: 'attr', path: 'grid', key: 'of', from: 'view.grid', to: 'view.lines' }] },
    ]);
  });
});

describe('changedAsset', () => {
  it('is the dialog when a step changed it and the layouts over it', () => {
    const next = renameInAsset(WORKSPACE, 'settings', 'view/grid', 'lines');
    expect(changedAsset(WORKSPACE, next)).toBe('settings');
  });

  it('is the layout when a step changed only that', () => {
    expect(changedAsset(WORKSPACE, removeInAsset(WORKSPACE, 'code', ['snap']))).toBe('code');
  });

  it('is nothing when a step changed no asset', () => {
    expect(changedAsset(WORKSPACE, WORKSPACE)).toBeUndefined();
  });
});
