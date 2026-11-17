import type { PrefAlias, PrefGroup } from '@weasel-js/prefs';
import type { AssetSet } from '../edit/assetSet';

export const pointer = (of: string, name = ''): PrefAlias => ({ kind: 'alias', name, description: '', default: undefined, of });

export const SETTINGS: PrefGroup = {
  name: 'Settings',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true },
      snap: { kind: 'boolean', name: 'Snap', description: 'Snap to the grid.', default: false },
    } },
  },
};

export const CODE: PrefGroup = { name: 'Code', children: { grid: pointer('view.grid'), snap: pointer('view.snap') } };

export const ASSET_SET: AssetSet = {
  assets: [
    { id: 'settings', label: 'Settings', kind: 'schema', root: SETTINGS },
    { id: 'code', label: 'Code', kind: 'layout', root: CODE, over: 'settings' },
  ],
};
