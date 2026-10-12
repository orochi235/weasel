import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { pointable, pointedAt, pointersTo } from './settingPointers';
import { pointer } from './workspace.fixtures';

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

describe('pointable', () => {
  it('takes a setting, and neither a leaf that holds no value nor a group', () => {
    expect(pointable(OVER, 'view/grid')).toBe(true);
    expect(pointable(OVER, 'view/note')).toBe(false);
    expect(pointable(OVER, 'view/again')).toBe(false);
    expect(pointable(OVER, 'view')).toBe(false);
    expect(pointable(OVER, 'view/gone')).toBe(false);
  });
});

describe('pointersTo', () => {
  it('makes a pointer to a setting, under the setting\'s key', () => {
    expect(pointersTo(OVER, 'view/grid')).toEqual({ key: 'grid', node: pointer('view.grid') });
  });

  it('names a setting under a heading by its value path, which leaves the heading out', () => {
    const sections: PrefSection = { name: 'Prefs', members: { lines: { name: 'Lines', members: { snap: flag('Snap') } } } };
    expect(pointersTo(sections, 'lines/snap')).toEqual({ key: 'snap', node: pointer('snap') });
  });

  it('makes a heading of a group, over a pointer to each setting beneath it, a second of one key numbered', () => {
    expect(pointersTo(OVER, 'view')).toEqual({
      key: 'view',
      node: { name: 'View', as: 'section', children: { grid: pointer('view.grid'), snap: pointer('view.lines.snap'), grid2: pointer('view.more.grid') } },
    });
  });

  it('makes nothing of a group that holds no setting, or of a leaf that is none', () => {
    expect(pointersTo(OVER, 'empty')).toBeUndefined();
    expect(pointersTo(OVER, 'view/note')).toBeUndefined();
    expect(pointersTo(OVER, 'nowhere')).toBeUndefined();
  });
});

describe('pointedAt', () => {
  it('holds the settings a layout\'s pointers name, at any depth, and none for a pointer that names nothing', () => {
    const layout: PrefGroup = { name: 'Code', children: { grid: pointer('view.grid'), rows: { name: 'Rows', as: 'section', children: { snap: pointer('view.lines.snap'), gone: pointer('view.gone') } } } };
    expect([...pointedAt(layout, OVER)].sort()).toEqual(['view.grid', 'view.lines.snap']);
  });
});
