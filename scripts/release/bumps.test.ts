import { describe, expect, it } from 'vitest';
import { parseChangesetFile } from '@changesets/parse';
import { atLevel, isChangesetFile } from './bumps.mjs';

const released = (text: string) => parseChangesetFile(text).releases;

describe('atLevel', () => {
  it('releases every package at the level the release was cut at, up or down', () => {
    const text = '---\n"@weasel-js/core": major\n"@weasel-js/geom": patch\n---\n\nA title.\n\n<!-- entry: new api -->\n';
    expect(released(atLevel(text, 'minor'))).toEqual([
      { name: '@weasel-js/core', type: 'minor' },
      { name: '@weasel-js/geom', type: 'minor' },
    ]);
    expect(parseChangesetFile(atLevel(text, 'minor')).summary).toBe('A title.\n\n<!-- entry: new api -->');
  });

  it('leaves a package marked none out of the release', () => {
    expect(released(atLevel('---\n"a": none\n"b": patch\n---\n\nx\n', 'minor'))).toEqual([
      { name: 'a', type: 'none' },
      { name: 'b', type: 'minor' },
    ]);
  });

  it('reads a level however YAML spells it, after a blank line or a byte-order mark', () => {
    expect(released(atLevel(`---\n'@weasel-js/core': "minor" # why\n---\n\nx\n`, 'patch'))).toEqual([{ name: '@weasel-js/core', type: 'patch' }]);
    expect(released(atLevel('\n---\n{ "a": major }\n---\n\nx\n', 'patch'))).toEqual([{ name: 'a', type: 'patch' }]);
    expect(released(atLevel('\ufeff---\n"a": minor\n---\n\nx\n', 'patch'))).toEqual([{ name: 'a', type: 'patch' }]);
  });

  it('refuses a level it does not know', () => {
    expect(() => atLevel('---\n"a": patch\n---\n\nx\n', 'Minor')).toThrow(/unknown release level/);
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
