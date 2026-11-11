/**
 * The shell's pure state: the story tree holds every story once under its title's folders, sorted, with search
 * keeping exactly the matching stories and their ancestors; breadcrumbs walk a title's prefixes; and the lab's
 * globals always settle on an offered value, settle once, and take only pins naming a global the lab has.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { key, runs, tally, timeoutFor } from '../pbt.fixture';
import type { IndexEntry } from '../story/types';
import { breadcrumb, crumbs, restatesTitle } from './breadcrumb';
import { effectiveGlobals, FOLLOW_APP, FOLLOW_LAB, type GlobalDeclarations, GLOBALS_KEY, labGlobals, PLAYHEAD_KEY, storyConfig } from './globals';
import { buildTree, filterTree, foldGalleries, type TreeNode } from './tree/buildTree';

const RUNS = 300;

function setOwn(target: Record<string, unknown>, k: string, value: unknown): void {
  Object.defineProperty(target, k, { value, enumerable: true, writable: true, configurable: true });
}

const segment = fc.constantFrom('ui', 'kit', 'Button', 'button', 'Bar', 'Gallery', 'index', 'Ä', '');
const title = fc.array(segment, { minLength: 1, maxLength: 3 }).map((s) => s.join('/'));
const entries: fc.Arbitrary<IndexEntry[]> = fc
  .array(fc.record({ title, name: fc.constantFrom('Primary', 'Button', 'Bar', 'Big one'), gallery: fc.boolean() }), { maxLength: 10 })
  .map((rows) => rows.map((r, i) => ({ id: `s${i}`, title: r.title, name: r.name, exportName: r.name, file: `/p/${i}.stories.tsx`, ...(r.gallery ? { tags: ['gallery'] } : {}) })));

/** Every story in a tree, with the labels of the folders above it. */
function storiesOf(nodes: readonly TreeNode[], above: string[] = []): { entry: IndexEntry; above: string[]; label?: string }[] {
  return nodes.flatMap((n) => (n.kind === 'story' ? [{ entry: n.entry, above, ...(n.label === undefined ? {} : { label: n.label }) }] : storiesOf(n.children, [...above, n.label])));
}

/** Folders sorted by label ahead of stories, a hoisted story standing in its component folder's place. */
function checkSorted(nodes: readonly TreeNode[]): void {
  const asFolder = (n: TreeNode): string | null => (n.kind === 'folder' ? n.label : (n.label ?? null));
  const firstStory = nodes.findIndex((n) => asFolder(n) === null);
  if (firstStory !== -1) expect(nodes.slice(firstStory).every((n) => asFolder(n) === null)).toBe(true);
  const labels = nodes.flatMap((n) => { const l = asFolder(n); return l === null ? [] : [l]; });
  expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  for (const n of nodes) if (n.kind === 'folder') checkSorted(n.children);
}

describe('buildTree', () => {
  it("holds every story once, under its title's folders, folders sorted ahead of stories", () => {
    const seen = tally();
    fc.assert(
      fc.property(entries, (list) => {
        const tree = buildTree(list);
        const stories = storiesOf(tree);
        expect(stories.map((s) => s.entry.id).sort()).toEqual(list.map((e) => e.id).sort());
        for (const s of stories) {
          const segments = s.entry.title.split('/');
          if (s.label === undefined) expect(s.above).toEqual(segments);
          else {
            // Hoisted: the lone story stands in for its component's folder.
            expect([...s.above, s.label]).toEqual(segments);
            expect(restatesTitle(s.entry.title, s.entry.name)).toBe(true);
            seen.count('hoisted');
          }
        }
        checkSorted(tree);
        const folded = storiesOf(foldGalleries(tree));
        expect(folded.map((s) => s.entry.id).sort()).toEqual(list.map((e) => e.id).sort());
      }),
      runs(RUNS),
    );
    seen.atLeast('hoisted', 30);
  }, timeoutFor(RUNS, 1));

  it('search keeps exactly the matching stories, under the same folders', () => {
    const seen = tally();
    fc.assert(
      fc.property(entries, fc.constantFrom('', '  ', 'ui', 'BUTTON', 'bar/', 'big one', 'ä', 'nothing', 'i/b'), (list, query) => {
        const tree = buildTree(list);
        const kept = filterTree(tree, query);
        const needle = query.trim().toLowerCase();
        if (needle === '') {
          expect(kept).toBe(tree);
          return;
        }
        const want = storiesOf(tree).filter((s) => `${s.entry.title}/${s.entry.name}`.toLowerCase().includes(needle));
        expect(storiesOf(kept)).toEqual(want);
        const noEmpty = (nodes: readonly TreeNode[]): boolean => nodes.every((n) => n.kind === 'story' || (n.children.length > 0 && noEmpty(n.children)));
        expect(noEmpty(kept)).toBe(true);
        if (want.length > 0 && want.length < storiesOf(tree).length) seen.count('narrowed');
      }),
      runs(RUNS),
    );
    seen.atLeast('narrowed', 50);
  }, timeoutFor(RUNS, 1));
});

describe('crumbs', () => {
  it("walk the title's prefixes, ending at the story, with no `index` step after the first", () => {
    fc.assert(
      fc.property(title, fc.constantFrom('Primary', 'Button', 'Bar', 'index'), (t, name) => {
        const steps = crumbs(t, name);
        // A story named `index`, as an index page is, leaves the crumb of the folder it is.
        if (!/(^|\/)index$/i.test(`${t}/${name}`)) expect(steps.at(-1)!.path).toBeNull();
        const segments = t.split('/');
        for (const step of steps.slice(0, -1)) {
          expect(step.path).not.toBeNull();
          expect(segments.slice(0, step.path!.split('/').length).join('/')).toBe(step.path);
          expect(step.label).toBe(step.path!.split('/').at(-1));
        }
        expect(steps.slice(1).some((s) => s.label.toLowerCase() === 'index')).toBe(false);
        expect(breadcrumb(t, name)).toBe(steps.map((s) => s.label).join(' > '));
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

const option = fc.constantFrom('light', 'dark', 'auto', 'toString', '__proto__');
const declarations: fc.Arbitrary<GlobalDeclarations> = fc
  .uniqueArray(
    fc.tuple(
      key,
      fc.uniqueArray(fc.record({ value: option, disabled: fc.boolean() }), { selector: (o) => o.value, minLength: 1, maxLength: 4 }),
      fc.boolean(),
      fc.option(fc.constantFrom(...['light', 'dark', 'auto']), { nil: undefined }),
      fc.boolean(),
    ),
    { selector: ([k]) => k, minLength: 1, maxLength: 3 },
  )
  .map((rows) => {
    const out: Record<string, unknown> = {};
    for (const [k, opts, follows, hide, unknownDefault] of rows)
      setOwn(out, k, {
        label: k,
        options: opts.map((o) => ({ value: o.value, label: o.value, ...(o.disabled ? { disabled: true } : {}) })),
        default: unknownDefault ? opts[0]!.value : opts.at(-1)!.value,
        ...(follows ? { follows: () => 'dark' } : {}),
        ...(hide ? { shows: (value: string) => value !== hide } : {}),
      });
    return out as GlobalDeclarations;
  });
const stored = fc.oneof(
  fc.constantFrom(null, 'x', 3, []),
  fc.array(fc.tuple(key, fc.oneof(option, fc.constantFrom(FOLLOW_APP, FOLLOW_LAB, 'other', 3))), { maxLength: 4 }).map((e) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of e) setOwn(out, k, v);
    return out;
  }),
);

describe('globals', () => {
  it("the lab's values: declared keys only, each offered, settled in one pass", () => {
    const seen = tally();
    fc.assert(
      fc.property(declarations, stored, (decls, from) => {
        const values = labGlobals(decls, from);
        expect(Object.keys(values)).toEqual(Object.keys(decls));
        for (const [k, decl] of Object.entries(decls)) {
          const v = values[k];
          const offered = decl.options.some((o) => o.value === v) || (decl.follows !== undefined && v === FOLLOW_APP) || v === decl.default;
          expect(offered, k).toBe(true);
          if (from !== null && typeof from === 'object' && Object.hasOwn(from, k) && (from as Record<string, unknown>)[k] !== v) seen.count('fell back');
        }
        expect(labGlobals(decls, values)).toEqual(values);
      }),
      runs(RUNS),
    );
    seen.atLeast('fell back', 6);
  }, timeoutFor(RUNS, 1));

  it("a trial's pins override only globals the lab has, and following the lab is no pin", () => {
    const seen = tally();
    fc.assert(
      fc.property(declarations, stored, stored, (decls, from, pins) => {
        const lab = labGlobals(decls, from);
        const effective = effectiveGlobals(lab, pins);
        expect(Object.keys(effective).sort()).toEqual(Object.keys(lab).sort());
        for (const k of Object.keys(lab)) {
          const pin = pins !== null && typeof pins === 'object' && !Array.isArray(pins) && Object.hasOwn(pins, k) ? (pins as Record<string, unknown>)[k] : undefined;
          expect(effective[k], k).toBe(pin === undefined || pin === FOLLOW_LAB ? lab[k] : pin);
          if (pin !== undefined && pin !== FOLLOW_LAB) seen.count('pinned');
        }
      }),
      runs(RUNS),
    );
    seen.atLeast('pinned', 5);
  }, timeoutFor(RUNS, 1));

  it("a story's config leaves out forge's keys, and is the previous one when nothing else changed", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.oneof(key, fc.constantFrom(GLOBALS_KEY, PLAYHEAD_KEY)), fc.integer({ min: 0, max: 2 })), { maxLength: 5 }), fc.integer({ min: 0, max: 2 }), (e, pin) => {
        const config: Record<string, unknown> = {};
        for (const [k, v] of e) setOwn(config, k, v);
        const shown = storyConfig(config) as Record<string, unknown>;
        expect(Object.keys(shown)).toEqual(Object.keys(config).filter((k) => k !== GLOBALS_KEY && k !== PLAYHEAD_KEY));
        const repinned = { ...config };
        setOwn(repinned, GLOBALS_KEY, { mode: String(pin) });
        expect(storyConfig(repinned, shown)).toBe(shown);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples', () => {
  it('keeps a title with an empty first segment apart from the one without it', () => {
    const entry = (id: string, t: string): IndexEntry => ({ id, title: t, name: 'Primary', exportName: 'Primary', file: `/p/${id}.stories.tsx` });
    const tree = buildTree([entry('s0', '/ui'), entry('s1', 'ui')]);
    const placed = storiesOf(tree).map((s) => [s.entry.id, s.above]);
    expect(placed).toEqual(expect.arrayContaining([['s0', ['', 'ui']], ['s1', ['ui']]]));
  });

  it('takes no pin keyed `__proto__` for a global the lab does not have', () => {
    const pins: Record<string, unknown> = {};
    setOwn(pins, '__proto__', 'light');
    expect(Object.keys(effectiveGlobals({ mode: 'dark' }, pins))).toEqual(['mode']);
  });
});
