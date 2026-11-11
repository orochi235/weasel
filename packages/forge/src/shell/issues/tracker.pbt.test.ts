/**
 * An issue report: the new-issue URL carries the title, the body, and the component's label through to GitHub
 * whatever they hold; the body leads with what the reporter wrote; and the story id and branch it names read back
 * from their Markdown code spans as themselves, backticks and edge spaces included.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, text } from '../../pbt.fixture';
import { newIssueUrl, reportBody } from './tracker';

const RUNS = 300;

/** The text of a CommonMark code span at the start of `md`, or null where none opens there. */
function codeSpan(md: string): string | null {
  const open = /^`+/.exec(md)?.[0];
  if (!open) return null;
  let at = open.length;
  for (;;) {
    const next = md.indexOf('`', at);
    if (next < 0) return null;
    const run = /^`+/.exec(md.slice(next))![0];
    if (run.length === open.length) {
      const inner = md.slice(open.length, next).replace(/\n/g, ' ');
      return /^ .* $/s.test(inner) && /[^ ]/.test(inner) ? inner.slice(1, -1) : inner;
    }
    at = next + run.length;
  }
}

/** Branch-like text: what `git check-ref-format` lets through, backticks among it. */
const branch = fc
  .array(fc.constantFrom('a', 'fix', '`', '``', '-', '/', '.', 'é', '_', '#', '$', '\u{1F600}'), { minLength: 1, maxLength: 6 })
  .map((parts) => parts.join(''));

/** Any id: a story's, with spaces at its edges among them. */
const id = fc.array(fc.constantFrom('a', '`', ' ', '-', 'é'), { minLength: 1, maxLength: 5 }).map((parts) => parts.join('')).filter((s) => s.trim() !== '');
const report = fc.record({ component: text, storyId: id, title: text, body: text });
const context = fc.record({ link: fc.webUrl(), branch: fc.option(branch, { nil: null }), commit: fc.option(fc.string({ unit: fc.constantFrom(...'0123456789abcdef'), minLength: 7, maxLength: 40 }), { nil: null }) });

describe('reportBody', () => {
  it('names the story and the branch in code spans that read back as themselves', () => {
    const seen = tally();
    fc.assert(
      fc.property(report, context, (r, c) => {
        const body = reportBody(r, c);
        const after = (label: string) => body.slice(body.indexOf(`**${label}:** `) + label.length + 6).split('\n')[0]!;
        expect(codeSpan(after('Story'))).toBe(r.storyId);
        if (c.branch !== null) {
          expect(codeSpan(after('Branch'))).toBe(c.branch);
          if (c.branch.includes('`')) seen.count('backtick');
        } else expect(body).not.toContain('**Branch:**');
        if (r.body.trim() !== '') expect(body.startsWith(`${r.body.trim()}\n\n---\n\n`)).toBe(true);
        else expect(body.startsWith('---\n\n')).toBe(true);
        expect(body).toContain(`**Reopen:** ${c.link}`);
      }),
      runs(RUNS),
    );
    seen.atLeast('backtick', 50);
  });
});

describe('newIssueUrl', () => {
  it('carries the title, body, and label through the query whatever they hold', () => {
    fc.assert(
      fc.property(report, context, (r, c) => {
        const url = new URL(newIssueUrl({ slug: 'o/r', url: 'https://github.com/o/r' }, r, c));
        expect(`${url.origin}${url.pathname}`).toBe('https://github.com/o/r/issues/new');
        expect(url.searchParams.get('title')).toBe(r.title);
        expect(url.searchParams.get('body')).toBe(reportBody(r, c));
        expect(url.searchParams.get('labels')).toBe(`forge:${r.component}`);
        expect(url.hash).toBe('');
      }),
      runs(RUNS),
    );
  });
});
