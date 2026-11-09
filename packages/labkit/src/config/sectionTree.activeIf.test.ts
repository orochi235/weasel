import { applyPrefConditions, type PrefLeaf, prefJudge, prefReader } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { sectionTree } from './sectionTree';

const action = (activeIf: unknown): PrefLeaf =>
  ({
    kind: 'action',
    name: 'Clear',
    description: '',
    default: undefined,
    run: () => {},
    activeIf,
  }) as PrefLeaf;

describe('sectionTree activeIf', () => {
  const resolved = resolveConfigSchema(
    f.prefs({
      name: 'Lab',
      members: {
        tools: {
          name: 'Tools',
          members: {
            armed: { kind: 'boolean', name: 'Armed', description: '', default: false } as PrefLeaf,
            clear: action({ path: 'armed' }),
          },
        },
      },
    }),
    [],
  );

  // The form judges the tree against `values`, where the leaf a config path names sits under a section's slug.
  const pressed = (armed: boolean): string[] => {
    const tree = sectionTree(resolved, { armed });
    const holds = prefJudge(tree.group, prefReader(tree.group, tree.values));
    return [...applyPrefConditions(tree.group, holds).active];
  };

  it("answers an action's activeIf against the config, across the section it was renested under", () => {
    expect(pressed(true)).toEqual(['tools.clear']);
    expect(pressed(false)).toEqual([]);
  });
});
