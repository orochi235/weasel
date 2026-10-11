import { describe, expect, it } from 'vitest';
import { pathsIn, scopedKey, scopedPath } from './assetScope';
import { ONE } from './oneAsset';

describe('assetScope', () => {
  it('names the asset a path is in, and finds the paths of one asset among several', () => {
    const kept = [scopedPath('settings', 'view/grid'), scopedPath('code', 'grid'), scopedPath('settings', 'view')];
    expect(pathsIn('settings', kept)).toEqual(['view/grid', 'view']);
    expect(pathsIn('code', kept)).toEqual(['grid']);
    expect(pathsIn('layout', kept)).toEqual([]);
  });

  it('reads an id that holds a colon', () => {
    expect(pathsIn('app:code', [scopedPath('app:code', 'rows/grid')])).toEqual(['rows/grid']);
  });

  it('leaves a lone schema\'s paths and keys as they were before there were assets', () => {
    expect(scopedPath(ONE, 'view/grid')).toBe('view/grid');
    expect(pathsIn(ONE, ['view/grid'])).toEqual(['view/grid']);
    expect(pathsIn('code', ['view/grid'])).toEqual([]);
    expect(scopedKey('draft:folds', ONE)).toBe('draft:folds');
    expect(scopedKey('draft:folds', 'code')).toBe('draft:folds:code');
  });
});
