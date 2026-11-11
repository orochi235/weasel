/**
 * The flat component list: one row per title holding exactly its stories, sorted; labels that tell every row of a
 * library apart and are each a suffix of the row's title; search keeping exactly the matching rows and stories; and
 * the list as tree nodes holding every story once. Titles share segments, repeat them at different depths, and
 * carry empty and non-ASCII segments.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally } from '../../pbt.fixture';
import { librariesFrom } from '../../story/library';
import type { IndexEntry } from '../../story/types';
import { buildComponents, componentNodes, filterComponents, librariesIn } from './buildComponents';
import type { TreeNode } from './buildTree';

const RUNS = 300;

const segment = fc.constantFrom('ui', 'a', 'x', 'Gallery', 'Button', 'İ', '');
const title = fc.array(segment, { minLength: 1, maxLength: 4 }).map((s) => s.join('/'));
const LIBRARIES = librariesFrom([{ path: '/one/', label: 'one' }, { path: '/two/', label: 'two' }]);

const DIRS = ['one', 'two', 'none'];
/** Every story of a title in one library, chosen per title: a title split across libraries is in `docs/unruled.md`. */
const entries: fc.Arbitrary<IndexEntry[]> = fc
  .tuple(
    fc.array(fc.record({ title, name: fc.constantFrom('Primary', 'Button', 'x', 'Big one'), gallery: fc.boolean() }), { maxLength: 12 }),
    fc.func(fc.constantFrom(...DIRS)),
  )
  .map(([rows, dirOf]) => rows.map((r, i) => ({ id: `s${i}`, title: r.title, name: r.name, exportName: r.name, file: `/${dirOf(r.title)}/${i}.stories.tsx`, ...(r.gallery ? { tags: ['gallery'] } : {}) })));

function storiesOf(nodes: readonly TreeNode[]): IndexEntry[] {
  return nodes.flatMap((n) => (n.kind === 'story' ? [n.entry] : storiesOf(n.children)));
}

describe('buildComponents', () => {
  it('holds one row per title with exactly its stories, sorted by label, library, then title', () => {
    fc.assert(
      fc.property(entries, (list) => {
        const rows = buildComponents(list, LIBRARIES);
        expect(rows.map((r) => r.path).sort()).toEqual([...new Set(list.map((e) => e.title))].sort());
        for (const row of rows) {
          expect(row.entries).toEqual(list.filter((e) => e.title === row.path));
          expect(row.library).toBe(LIBRARIES.of(row.entries[0]!));
        }
        const sorted = [...rows].sort((a, b) => a.label.localeCompare(b.label) || a.library.localeCompare(b.library) || a.path.localeCompare(b.path));
        expect(rows).toEqual(sorted);
        expect(librariesIn(list, LIBRARIES)).toEqual([...new Set(rows.map((r) => r.library))].sort((a, b) => a.localeCompare(b)));
      }),
      runs(RUNS),
    );
  });

  it("labels each row with a suffix of its title that no other row of its library shares", () => {
    const seen = tally();
    fc.assert(
      fc.property(entries, (list) => {
        const rows = buildComponents(list, LIBRARIES);
        for (const row of rows) {
          expect(row.path === row.label || row.path.endsWith(`/${row.label}`)).toBe(true);
          if (row.label !== row.path.split('/').at(-1)) seen.count('widened');
        }
        for (const library of new Set(rows.map((r) => r.library))) {
          const labels = rows.filter((r) => r.library === library).map((r) => r.label);
          expect(new Set(labels).size).toBe(labels.length);
        }
      }),
      runs(RUNS),
    );
    seen.atLeast('widened', 20);
  });
});

describe('filterComponents', () => {
  it('keeps a matching row whole and only the matching stories of the rest, ignoring case', () => {
    const seen = tally();
    fc.assert(
      fc.property(entries, fc.constantFrom('', '  ', 'ui', 'UI', 'x', 'button', 'one', 'big', 'i̇', 'İ', 'zzz', '/'), (list, query) => {
        const rows = buildComponents(list, LIBRARIES);
        const kept = filterComponents(rows, query);
        const needle = query.trim().toLowerCase();
        if (!needle) {
          expect(kept).toEqual(rows);
          return;
        }
        const byPath = new Map(kept.map((r) => [r.path, r]));
        for (const row of rows) {
          const got = byPath.get(row.path);
          if (`${row.path}/${row.library}`.toLowerCase().includes(needle)) {
            expect(got).toEqual(row);
            seen.count('whole');
            continue;
          }
          const stories = row.entries.filter((e) => e.name.toLowerCase().includes(needle));
          if (stories.length === 0) expect(got).toBeUndefined();
          else {
            expect(got?.entries).toEqual(stories);
            expect(got?.index).toBeUndefined();
            seen.count('by story');
          }
        }
        expect(kept.map((r) => r.path)).toEqual(rows.filter((r) => byPath.has(r.path)).map((r) => r.path));
      }),
      runs(RUNS),
    );
    seen.atLeast('whole', 30);
    seen.atLeast('by story', 10);
  });
});

describe('componentNodes', () => {
  it("holds every story once, under a top-level node tagged with its library, folder paths unique within one", () => {
    const seen = tally();
    fc.assert(
      fc.property(entries, (list) => {
        const nodes = componentNodes(buildComponents(list, LIBRARIES));
        expect(storiesOf(nodes).map((e) => e.id).sort()).toEqual(list.map((e) => e.id).sort());
        for (const top of nodes) {
          const under = storiesOf([top]);
          for (const entry of under) expect(LIBRARIES.of(entry)).toBe(top.tag);
          if (top.kind === 'folder' && new Set(under.map((e) => e.title)).size > 1) seen.count('shared folder');
          const paths: string[] = [];
          const walk = (ns: readonly TreeNode[]) => ns.forEach((n) => { if (n.kind === 'folder') { paths.push(n.path); walk(n.children); } });
          walk([top]);
          expect(new Set(paths).size).toBe(paths.length);
        }
      }),
      runs(RUNS),
    );
    seen.atLeast('shared folder', 20);
  });
});
