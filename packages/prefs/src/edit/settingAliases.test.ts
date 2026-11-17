import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { isAliasable, aliasedPaths, aliasesTo } from './settingAliases';
import { pointer } from '../testing/editWorkspace';

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const OVER: PrefGroup = {
  name: 'Settings',
  children: {
    view: { name: 'View', children: {
      grid: flag('Show grid'),
      note: { kind: 'label', name: 'Note', description: '', default: undefined },
      again: pointer('view.grid'),
      lines: { name: 'Lines', as: 'section', children: { snap: flag('Snap') } },
      more: { name: 'More', children: { grid: flag('Fine grid') } },
    } },
    empty: { name: 'Empty', children: { note: { kind: 'label', name: 'Note', description: '', default: undefined } } },
  },
};

describe('isAliasable', () => {
  it('takes a setting, and neither a leaf that holds no value nor a group', () => {
    expect(isAliasable(OVER, 'view/grid')).toBe(true);
    expect(isAliasable(OVER, 'view/note')).toBe(false);
    expect(isAliasable(OVER, 'view/again')).toBe(false);
    expect(isAliasable(OVER, 'view')).toBe(false);
    expect(isAliasable(OVER, 'view/gone')).toBe(false);
  });
});

describe('aliasesTo', () => {
  it('makes an alias to a setting, under the setting\'s key', () => {
    expect(aliasesTo(OVER, 'view/grid')).toEqual({ key: 'grid', node: pointer('view.grid') });
  });

  it('names a setting under a heading by its value path, which leaves the heading out', () => {
    const sections: PrefSection = { name: 'Prefs', members: { lines: { name: 'Lines', members: { snap: flag('Snap') } } } };
    expect(aliasesTo(sections, 'lines/snap')).toEqual({ key: 'snap', node: pointer('snap') });
  });

  it('makes a heading of a group, over an alias to each setting beneath it, a second of one key numbered', () => {
    expect(aliasesTo(OVER, 'view')).toEqual({
      key: 'view',
      node: { name: 'View', as: 'section', children: { grid: pointer('view.grid'), snap: pointer('view.lines.snap'), grid2: pointer('view.more.grid') } },
    });
  });

  it('makes nothing of a group that holds no setting, or of a leaf that is none', () => {
    expect(aliasesTo(OVER, 'empty')).toBeUndefined();
    expect(aliasesTo(OVER, 'view/note')).toBeUndefined();
    expect(aliasesTo(OVER, 'nowhere')).toBeUndefined();
  });
});

describe('aliasedPaths', () => {
  it('holds the settings a layout\'s aliases name, at any depth, and none for an alias that names nothing', () => {
    const layout: PrefGroup = { name: 'Code', children: { grid: pointer('view.grid'), rows: { name: 'Rows', as: 'section', children: { snap: pointer('view.lines.snap'), gone: pointer('view.gone') } } } };
    expect([...aliasedPaths(layout, OVER)].sort()).toEqual(['view.grid', 'view.lines.snap']);
  });
});
