import { describe, expect, it } from 'vitest';
import { COMMENT_MARKER, MAX_COMMENT_CHARS, commentBody } from './prComment.ts';

const shas = { base: 'a'.repeat(40), head: 'b'.repeat(40) };

describe('commentBody', () => {
  it('leads with the marker, names both revisions, and fences the report', () => {
    const body = commentBody('item  a  b\nflush  1  2', shas);
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain('`aaaaaaaaaa`');
    expect(body).toContain('`bbbbbbbbbb`');
    expect(body).toContain('```\nitem  a  b\nflush  1  2\n```');
  });

  it('cuts a report past the comment limit at a line end and says so', () => {
    const line = `${'x'.repeat(99)}\n`;
    const body = commentBody(line.repeat(1000), shas);
    expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS);
    expect(body).toContain('cut short');
    const fenced = body.slice(body.indexOf('```\n') + 4, body.lastIndexOf('\n```'));
    expect(fenced.split('\n').every((l) => l.length === 99)).toBe(true);
  });

  it('says so when no benchmark produced a report', () => {
    expect(commentBody('  \n', shas)).toContain('No benchmark wrote a result');
  });
});
