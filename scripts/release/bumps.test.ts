import { describe, expect, it } from 'vitest';
import { isChangesetFile, readBumps } from './bumps.mjs';

const levels = (text: string) => readBumps(text).unapproved.map((b) => b.level);

describe('readBumps', () => {
  it('passes patch and none', () => {
    expect(levels('---\n"@weasel-js/core": patch\n"@weasel-js/geom": none\n---\n\nfix\n')).toEqual([]);
  });

  it('reads a level however YAML spells it', () => {
    expect(levels(`---\n'@weasel-js/core': "minor" # why\n---\n\nx\n`)).toEqual(['minor']);
    expect(levels('---\n{ "@weasel-js/core": major }\n---\n\nx\n')).toEqual(['major']);
  });

  it('reads frontmatter changesets reads after a blank line or a byte-order mark', () => {
    expect(levels('\n---\n"@weasel-js/core": major\n---\n\nx\n')).toEqual(['major']);
    expect(levels('﻿---\n"@weasel-js/core": minor\n---\n\nx\n')).toEqual(['minor']);
  });

  it('approves only the level its marker names', () => {
    const text = (level: string) =>
      `---\n"@weasel-js/core": ${level}\n---\n\nx\n\n<!-- bump-approved: minor: someone — reason -->\n`;
    expect(readBumps(text('minor'))).toMatchObject({ approved: [{ level: 'minor' }], unapproved: [] });
    expect(levels(text('major'))).toEqual(['major']);
  });

  it('notices a marker opening the body', () => {
    expect(readBumps('---\n"a": patch\n---\n\n<!-- bump-approved: minor: a — b -->\nx\n').leadingMarker).toBe(true);
  });

  it('throws on a level changesets refuses', () => {
    expect(() => readBumps('---\n"a": Minor\n---\n\nx\n')).toThrow(/invalid version type/);
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
