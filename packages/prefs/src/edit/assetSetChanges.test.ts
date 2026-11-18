import { describe, expect, it } from 'vitest';
import { ASSET_SET } from '../testing/editAssetSet';
import { changedAsset, assetSetChanges } from './assetSetChanges';
import { removeInAsset, renameInAsset } from './assetSetEdit';

describe('assetSetChanges', () => {
  it('lists nothing for an asset set at its baseline', () => {
    expect(assetSetChanges(ASSET_SET, ASSET_SET)).toEqual([]);
  });

  it('lists a rename under its dialog and the pointer that followed under its layout', () => {
    const next = renameInAsset(ASSET_SET, 'settings', 'view/grid', 'lines');
    expect(assetSetChanges(ASSET_SET, next)).toEqual([
      { id: 'settings', changes: [{ op: 'move', from: 'view/grid', to: 'view/lines' }] },
      { id: 'code', changes: [{ op: 'attr', path: 'grid', key: 'of', from: 'view.grid', to: 'view.lines' }] },
    ]);
  });
});

describe('changedAsset', () => {
  it('is the dialog when a step changed it and the layouts over it', () => {
    const next = renameInAsset(ASSET_SET, 'settings', 'view/grid', 'lines');
    expect(changedAsset(ASSET_SET, next)).toBe('settings');
  });

  it('is the layout when a step changed only that', () => {
    expect(changedAsset(ASSET_SET, removeInAsset(ASSET_SET, 'code', ['snap']))).toBe('code');
  });

  it('is nothing when a step changed no asset', () => {
    expect(changedAsset(ASSET_SET, ASSET_SET)).toBeUndefined();
  });
});
