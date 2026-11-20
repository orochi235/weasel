import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { sectionTree } from './sectionTree';

const flag = (name: string, def: boolean): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: def }) as PrefLeaf;

const over: PrefGroup = {
  name: 'Preferences',
  children: { view: { name: 'View', children: { grid: flag('Show grid', true) } } },
};

describe('sectionTree over another schema', () => {
  const resolved = resolveConfigSchema(
    f.schema(
      {
        shown: f.number(1).section('Main').showIf({ path: 'view.grid', is: true }),
        enabled: f.number(2).section('Main').enableIf({ path: 'view.grid', is: true }),
      },
      { over },
    ),
  );

  it('reads a condition naming a path only `over` holds from that leaf, as the panel does', () => {
    const tree = sectionTree(resolved, { shown: 1, enabled: 2 });
    expect(Object.keys((tree.group.children.main as PrefGroup).children)).toEqual([
      'shown',
      'enabled',
    ]);
    expect([...tree.disabledPaths]).toEqual([]);
  });
});
