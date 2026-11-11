import { describe, expect, it } from 'vitest';
import { releasedAt, isChangesetFile } from './bumps.mjs';

describe('releasedAt', () => {
  const plan = {
    changesets: [{ id: 'a', summary: 'x', releases: [{ name: 'core', type: 'major' as const }, { name: 'geom', type: 'patch' as const }] }],
    releases: [
      { name: 'core', type: 'major' as const, oldVersion: '1.18.2', newVersion: '2.0.0', changesets: ['a'] },
      { name: 'geom', type: 'major' as const, oldVersion: '1.18.2', newVersion: '2.0.0', changesets: ['a'] },
      { name: 'skip', type: 'none' as const, oldVersion: '1.18.2', newVersion: '1.18.2', changesets: [] },
    ],
    preState: undefined,
  };

  it('moves every released package to the next version at the level the release is cut at', () => {
    expect(releasedAt(plan, 'minor').releases.map((r) => [r.name, r.type, r.newVersion])).toEqual([
      ['core', 'minor', '1.19.0'],
      ['geom', 'minor', '1.19.0'],
      ['skip', 'none', '1.18.2'],
    ]);
    expect(releasedAt(plan, 'patch').releases[0].newVersion).toBe('1.18.3');
  });

  it('leaves each changeset at its own level, which its changelog entry is listed under', () => {
    expect(releasedAt(plan, 'patch').changesets).toBe(plan.changesets);
  });

  it('refuses a level it does not know', () => {
    expect(() => releasedAt(plan, 'Minor')).toThrow(/unknown release level/);
  });
});

describe('isChangesetFile', () => {
  it('skips exactly the files changesets skips', () => {
    expect(['README.md', 'readme.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.hidden.md', 'notes.txt'].filter(isChangesetFile)).toEqual([]);
    // changesets reads these as changesets: its AGENTS, CLAUDE and GEMINI names match by case.
    expect(['claude.md', 'Agents.md', 'gemini.md', 'brave-cats.md'].filter(isChangesetFile)).toEqual([
      'claude.md',
      'Agents.md',
      'gemini.md',
      'brave-cats.md',
    ]);
  });
});
