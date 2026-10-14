import { describe, expect, it } from 'vitest';
import { BODY_LIMIT, changelogSection, releaseBody } from './release-notes.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  '## 1.10.0',
  '',
  '### Patch Changes',
  '',
  '- abc1234: first',
  '',
  '  more of the first',
  '- def5678: second',
  '',
  '## 1.9.0',
  '',
  '### Patch Changes',
  '',
  '- 0000000: older',
  '',
].join('\n');

describe('changelogSection', () => {
  it('returns one version, without its heading or the next one', () => {
    const section = changelogSection(CHANGELOG, '1.10.0');
    expect(section).toMatch(/^### Patch Changes/);
    expect(section).toContain('- def5678: second');
    expect(section).not.toContain('older');
    expect(section).not.toContain('## 1.9.0');
  });

  it('reads the last section to the end of the file', () => {
    expect(changelogSection(CHANGELOG, '1.9.0')).toBe('### Patch Changes\n\n- 0000000: older');
  });

  it('does not take 1.1.0 for 1.10.0', () => {
    expect(changelogSection(CHANGELOG, '1.1.0')).toBeNull();
  });
});

describe('releaseBody', () => {
  const changelogUrl = 'https://example.test/CHANGELOG.md';

  it('leaves a section that fits alone', () => {
    expect(releaseBody('- a\n- b', { changelogUrl })).toBe('- a\n- b');
  });

  it('cuts a long section at an entry and links the rest', () => {
    const entries = Array.from({ length: 40 }, (_, i) => `- entry ${i}\n\n  ${'x'.repeat(40)}`);
    const body = releaseBody(entries.join('\n'), { changelogUrl, limit: 600 });
    expect(body.length).toBeLessThanOrEqual(600);
    expect(body).toContain(changelogUrl);
    const kept = body.slice(0, body.indexOf('\n\nThese notes are cut short'));
    expect(entries.join('\n').startsWith(kept)).toBe(true);
    expect(kept.endsWith('x'.repeat(40))).toBe(true);
  });

  it('cuts one entry longer than the limit mid-text', () => {
    const body = releaseBody(`- ${'y'.repeat(2000)}`, { changelogUrl, limit: 500 });
    expect(body.length).toBeLessThanOrEqual(500);
    expect(body).toContain(changelogUrl);
  });

  it("stays under GitHub's limit at the size that failed 1.10.0", () => {
    const entry = `- abc1234: ${'z'.repeat(900)}`;
    const section = Array.from({ length: 150 }, () => entry).join('\n');
    expect(section.length).toBeGreaterThan(135_000);
    expect(releaseBody(section, { changelogUrl }).length).toBeLessThanOrEqual(BODY_LIMIT);
  });
});
