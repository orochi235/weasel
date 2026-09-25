import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  parseChangeset,
  releasesFromChangelogs,
  splitSummary,
} from './vite-changelogs';

const CORE = `# @weasel-js/core

## 1.1.0

### Minor Changes

- abc1234: A short one.

## 1.0.0

### Patch Changes

- def5678: Wrapped prose whose opening sentence spans
  more than one source line.

  The second paragraph, with \`code\` in it.

- Updated dependencies [def5678]
  - @weasel-js/geom@1.0.0
`;

const GEOM = `# @weasel-js/geom

## 1.0.0

### Patch Changes

- def5678: Wrapped prose whose opening sentence spans
  more than one source line.

  The second paragraph, with \`code\` in it.
`;

describe('releasesFromChangelogs', () => {
  const releases = releasesFromChangelogs([
    { pkg: 'core', text: CORE },
    { pkg: 'geom', text: GEOM },
  ]);

  it('orders releases newest first', () => {
    expect(releases.map((r) => r.version)).toEqual(['1.1.0', '1.0.0']);
  });

  it('states a shared changeset once, naming every package it touched', () => {
    const shared = releases.find((r) => r.version === '1.0.0')!.entries;
    expect(shared).toHaveLength(1);
    expect(shared[0].packages).toEqual(['core', 'geom']);
  });

  it('drops the fixed group’s "Updated dependencies" stanzas', () => {
    const all = releases.flatMap((r) => r.entries);
    expect(all.some((e) => /Updated dependencies/.test(e.titleHtml + e.bodyHtml))).toBe(false);
  });

  it('unwraps the summary and renders the rest as markdown', () => {
    const entry = releases.find((r) => r.version === '1.0.0')!.entries[0];
    expect(entry.titleHtml).toBe(
      'Wrapped prose whose opening sentence spans more than one source line.',
    );
    expect(entry.bodyHtml).toContain('<code>code</code>');
  });

  it('carries the bump level from the section heading', () => {
    expect(releases.find((r) => r.version === '1.1.0')!.entries[0].level).toBe('minor');
  });
});

describe('splitSummary', () => {
  it('treats the blank line, not the newline, as the boundary', () => {
    expect(splitSummary('one\ntwo\n\nrest')).toEqual(['one two', 'rest']);
  });

  it('leaves a body-only entry with no summary when it opens with a block', () => {
    expect(splitSummary('- a list\n- of things\n\nmore')[0]).toBe('');
  });

  it('handles a single-paragraph entry', () => {
    expect(splitSummary('just this')).toEqual(['just this', '']);
  });

  it('takes the first sentence as the summary and leads the rest with the remainder', () => {
    expect(splitSummary('One thing.\nMore about it.\n\nrest')).toEqual([
      'One thing.',
      'More about it.\n\nrest',
    ]);
  });

  it('does not end a sentence inside a code span or before a lowercase word', () => {
    expect(splitSummary('Use `a. B` here, e.g. this. Then more.')).toEqual([
      'Use `a. B` here, e.g. this.',
      'Then more.',
    ]);
  });
});

describe('parseChangeset', () => {
  it('reads the packages and level from frontmatter', () => {
    const parsed = parseChangeset(
      "---\n'@weasel-js/labkit': patch\n'@weasel-js/ui': minor\n---\n\nSummary line\n\nBody.\n",
    )!;
    expect(parsed.packages).toEqual(['labkit', 'ui']);
    expect(parsed.level).toBe('minor');
    expect(parsed.body).toBe('Summary line\n\nBody.');
  });

  it('returns null for a file with no frontmatter or no body', () => {
    expect(parseChangeset('just prose')).toBeNull();
    expect(parseChangeset("---\n'@weasel-js/core': patch\n---\n\n")).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders numerically, not lexically', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('0.8.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('orders a prerelease below its release and above the version before', () => {
    expect(compareVersions('1.4.0-pre.1', '1.4.0')).toBeLessThan(0);
    expect(compareVersions('1.4.0', '1.4.0-pre.1')).toBeGreaterThan(0);
    expect(compareVersions('1.4.0-pre.0', '1.3.0')).toBeGreaterThan(0);
    expect(compareVersions('1.4.0-pre.10', '1.4.0-pre.9')).toBeGreaterThan(0);
  });
});
