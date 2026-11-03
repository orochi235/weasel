import { describe, expect, it } from 'vitest';
import { readPackages, tierProblems } from './package-tiers.mjs';

const graph = (entries: [string, string | undefined, string[]][]) =>
  new Map(entries.map(([name, tier, deps]) => [name, { dir: '', tier, deps }]));

describe('tierProblems', () => {
  const ok = graph([
    ['geom', 'base', []],
    ['history', 'base', ['geom']],
    ['core', 'core', ['history']],
    ['minimap', 'plugin', ['core']],
    ['theme', 'other', []],
  ]);

  it('accepts tiers the graph agrees with', () => {
    expect(tierProblems(ok)).toEqual([]);
  });

  it('holds base to exactly what core reaches, transitively', () => {
    const moved = graph([['geom', 'other', []], ['history', 'base', ['geom']], ['core', 'core', ['history']], ['loose', 'base', []]]);
    expect(tierProblems(moved)).toEqual([
      expect.stringMatching(/geom.*core depends on it/),
      expect.stringMatching(/loose.*no longer depends on it/),
    ]);
  });

  it('rejects a missing or unknown tier, a second core, and a plugin that never reaches core', () => {
    const bad = graph([['core', 'core', []], ['a', undefined, []], ['b', 'extra', []], ['c', 'core', []], ['d', 'plugin', []]]);
    expect(tierProblems(bad)).toEqual([
      expect.stringMatching(/a\/package\.json has no "weasel\.tier"/),
      expect.stringMatching(/"weasel\.tier": "extra"/),
      expect.stringMatching(/only @weasel-js\/core is "core"/),
      expect.stringMatching(/no canvas to drop into/),
    ]);
  });

  it("passes on the repo's own manifests", () => {
    expect(tierProblems(readPackages())).toEqual([]);
  });
});
