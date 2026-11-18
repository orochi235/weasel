import { describe, expect, it } from 'vitest';
import type { BundlesAsset } from '@weasel-js/prefs/edit';
import { DRAW_ASSET_SET } from './drawAssetSet';

const bundles = () => DRAW_ASSET_SET.assets.find((a): a is BundlesAsset => a.kind === 'bundles')!;
const packageOf = (id: string) => bundles().presets.find((p) => p.id === id)?.package;

describe('DRAW_ASSET_SET', () => {
  it('files each preset under the package that defines it', () => {
    expect(packageOf('view')).toBe('@weasel-js/core');
    expect(packageOf('tools:view')).toBe('@weasel-js/core');
    expect(packageOf('select')).toBe('@weasel-js/editing');
    expect(packageOf('draw')).toBe('@weasel-js/editing');
    expect(packageOf('pathTools')).toBe('@weasel-js/path-tools');
  });

  it('holds every preset and node kind a WeaselDraw canvas mounts, text-tools\' included', () => {
    expect(packageOf('text')).toBe('@weasel-js/text-tools');
    expect(DRAW_ASSET_SET.assets.some((a) => a.id === 'node:text')).toBe(true);
  });
});
