/**
 * Story ids and index pages: `sanitize` settles in one pass, a story id splits back into its two sanitized parts or
 * the title and name are refused with Storybook's error, no story id reads as an index page's, and index pages are
 * one per title with the tags every story of it carries, the input left as it was.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { sanitize, storyId, storyNameFromExport } from './ids';
import { byComponent, indexEntries, indexId, isIndexId, primaryFile } from './indexPages';
import { librariesFrom } from './library';
import { taggedIds } from './tags';
import type { IndexEntry } from './types';

const RUNS = 300;

const part = fc.oneof(
  fc.string({ unit: fc.constantFrom('a', 'B', '1', '-', '_', ' ', '/', '.', ':', '’', 'é', 'İ', '\u{1F600}', '--'), maxLength: 10 }),
  fc.string({ unit: 'grapheme', maxLength: 8 }),
);

describe('ids', () => {
  it('sanitize settles in one pass, to lower case with single inner dashes', () => {
    const seen = tally();
    fc.assert(
      fc.property(part, (p) => {
        const s = sanitize(p);
        expect(sanitize(s)).toBe(s);
        expect(s).toBe(s.toLowerCase());
        expect(s.includes('--') || s.startsWith('-') || s.endsWith('-')).toBe(false);
        if (s !== '' && s !== p) seen.count('changed');
      }),
      runs(RUNS),
    );
    seen.atLeast('changed', 50);
  }, timeoutFor(RUNS, 1));

  it("a story id splits back into its title's and name's sanitized parts, or Storybook's error names the empty one", () => {
    const seen = tally();
    fc.assert(
      fc.property(part, part, (title, name) => {
        const [t, n] = [sanitize(title), sanitize(name)];
        if (t === '' || n === '') {
          expect(() => storyId(title, name)).toThrow(t === '' ? /^Invalid kind/ : /^Invalid name/);
          seen.count('refused');
          return;
        }
        const id = storyId(title, name);
        expect(id.split('--')).toEqual([t, n]);
        expect(isIndexId(id)).toBe(false);
        expect(isIndexId(indexId(title))).toBe(true);
        seen.count('id');
      }),
      runs(RUNS),
    );
    seen.atLeast('refused', 20);
    seen.atLeast('id', 100);
  }, timeoutFor(RUNS, 1));

  it('a name from an export settles in one pass, trimmed and single-spaced', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom('a', 'B', 'c', 'D', '1', '_', '-', '.', ' ', 'é'), maxLength: 12 }), (exportName) => {
        const name = storyNameFromExport(exportName);
        expect(name).toBe(name.trim());
        expect(name.includes('  ')).toBe(false);
        expect(storyNameFromExport(name)).toBe(name);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

const title = fc.constantFrom('ui/Button', 'ui/Bar', 'kit/Bar', 'Solo', 'ui/Cursors/Gallery', 'a//b');
const file = fc.constantFrom('/p/ui/Button.stories.tsx', '/p/ui/Bar.stories.tsx', '/p/lab/BarArc.stories.tsx', 'C:\\p\\Solo.story.jsx', '/p/x.stories.ts');
const tags = fc.option(fc.uniqueArray(fc.constantFrom('gallery', 'lab', 'autodocs', 'x'), { maxLength: 3 }), { nil: undefined });

const entries: fc.Arbitrary<IndexEntry[]> = fc
  .array(fc.record({ title, file, tags, name: fc.constantFrom('Primary', 'Big', 'Bar') }), { maxLength: 10 })
  .map((rows) => rows.map((r, i) => ({ id: `s${i}`, exportName: r.name, ...r, ...(r.tags === undefined ? { tags: undefined } : {}) })).map(({ tags: t, ...rest }) => (t === undefined ? rest : { ...rest, tags: t })));

describe('index pages', () => {
  it('byComponent groups each title together, in first-seen order, the primary file first, losing nothing', () => {
    fc.assert(
      fc.property(entries, (list) => {
        const grouped = byComponent(list);
        expect([...grouped].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...list].sort((a, b) => a.id.localeCompare(b.id)));
        const order = [...new Set(list.map((e) => e.title))];
        const runsOf = grouped.map((e) => e.title).filter((t, i, all) => i === 0 || all[i - 1] !== t);
        expect(runsOf).toEqual(order);
        for (const t of order) {
          const group = grouped.filter((e) => e.title === t);
          const primary = primaryFile(t, [...new Set(group.map((e) => e.file))]);
          const firstOther = group.findIndex((e) => e.file !== primary);
          if (firstOther !== -1) expect(group.slice(firstOther).some((e) => e.file === primary)).toBe(false);
        }
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));

  it('one page per title, tagged with what every story of it carries, the input untouched', () => {
    const seen = tally();
    fc.assert(
      fc.property(entries, (list) => {
        const before = structuredClone(list);
        const pages = indexEntries(list);
        expect(list).toEqual(before);
        expect(pages.map((p) => p.title)).toEqual([...new Set(list.map((e) => e.title))]);
        for (const page of pages) {
          const group = list.filter((e) => e.title === page.title);
          expect(page.id).toBe(indexId(page.title));
          expect(isIndexId(page.id)).toBe(true);
          expect(group.some((e) => e.file === page.file)).toBe(true);
          const common = group.every((e) => e.tags) ? group[0]!.tags!.filter((t) => group.every((e) => e.tags!.includes(t))) : [];
          expect([...(page.tags ?? [])].sort()).toEqual([...common].sort());
          if (common.length > 0 && group.length > 1) seen.count('shared tags');
        }
        const tagged = taggedIds(list);
        expect(tagged.galleries).toEqual(list.filter((e) => e.tags?.includes('gallery')).map((e) => e.id));
        expect(tagged.labs).toEqual(list.filter((e) => e.tags?.includes('lab')).map((e) => e.id));
      }),
      runs(RUNS),
    );
    seen.atLeast('shared tags', 20);
  }, timeoutFor(RUNS, 1));

  it("a story's library is the first whose path its file holds, else its title's first segment", () => {
    const library = fc.record({ path: fc.constantFrom('/p/ui/', '/p/', '/lab/', '/nowhere/'), label: fc.constantFrom('UI', 'All', 'Lab', 'None') });
    fc.assert(
      fc.property(fc.array(library, { maxLength: 3 }), file, title, (table, f, t) => {
        const label = librariesFrom(table).of({ file: f, title: t });
        const hit = table.find((l) => f.replaceAll('\\', '/').includes(l.path));
        expect(label).toBe(hit ? hit.label : t.split('/')[0]);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});
