import { describe, expect, it } from 'vitest';
import { PREF_ELSE, dropUnlisted, scopeSelectors, memberAt, repairScope, weighScope, writeDeclared, type OverridesOf, type PrefOverrides } from './scope';
import { prefOverridesOf, prefScopedDefault, prefScopesOf } from './scopeSpec';
import type { PrefLeaf } from './schema';

const MODE = 'mode';
const LAYOUT = 'layout';
const scope = (by: string, own: Record<string, unknown>, shared?: unknown) =>
  (shared === undefined ? { $by: by, $in: own } : { $by: by, $in: own, [PREF_ELSE]: shared });
/** A write along the selectors `stored` is already split by. */
const write = (stored: unknown, under: Record<string, string>, next: unknown, overridesOf?: OverridesOf) =>
  writeDeclared(stored, [...scopeSelectors(stored)], under, under, next, -1, overridesOf);
const closed = (...lists: [string, PrefOverrides][]): OverridesOf => (selector) => Object.fromEntries(lists)[selector];

describe('a closed selector', () => {
  const list = closed([MODE, ['types']]);
  const held = scope(MODE, { types: 0 }, 300000);

  it('reads an option it names from its own member, and every other from the shared one', () => {
    expect(memberAt(held, { [MODE]: 'types' }, -1, list)).toBe(0);
    expect(memberAt(held, { [MODE]: 'dark' }, -1, list)).toBe(300000);
    expect(memberAt(scope(MODE, { types: 0 }), { [MODE]: 'dark' }, -1, list)).toBe(-1);
  });

  it('reads an option it names but holds nothing for as its proposed value, else the shared member', () => {
    expect(memberAt(scope(MODE, {}, 9), { [MODE]: 'types' }, -1, closed([MODE, { types: 0 }]))).toBe(0);
    expect(memberAt(scope(MODE, {}, 9), { [MODE]: 'types' }, -1, list)).toBe(9);
    expect(memberAt(scope(MODE, {}), { [MODE]: 'types' }, -1, list)).toBe(-1);
  });

  it('writes where it reads, and a named option written keeps its own', () => {
    expect(write(held, { [MODE]: 'light' }, 5, list)).toEqual(scope(MODE, { types: 0 }, 5));
    expect(write(scope(MODE, {}, 1), { [MODE]: 'types' }, 5, list)).toEqual(scope(MODE, { types: 5 }, 1));
  });

  it('ignores a member of an option it no longer names, and drops it', () => {
    const stale = scope(MODE, { types: 1, dark: 2 }, 3);
    expect(memberAt(stale, { [MODE]: 'dark' }, -1, list)).toBe(3);
    expect(repairScope(stale, [MODE], () => ['dark', 'light', 'types'], (v) => v, list)).toEqual(scope(MODE, { types: 1 }, 3));
    expect(dropUnlisted(stale, list)).toEqual(scope(MODE, { types: 1 }, 3));
    expect(dropUnlisted(held, list)).toBe(held);
  });

  it('weighs the shared member once per option that reads it', () => {
    expect(weighScope(held, { [MODE]: { types: 0.5, dark: 0.5 } }, -1, list)).toEqual([{ value: 0, weight: 0.5 }, { value: 300000, weight: 0.5 }]);
  });
});

describe('an open selector', () => {
  it('reads an option its own member once it has one, and the shared one until then', () => {
    const held = scope('document', { a: 7 }, 1);
    expect(memberAt(held, { document: 'a' }, -1)).toBe(7);
    expect(memberAt(held, { document: 'b' }, -1)).toBe(1);
    expect(memberAt(scope('document', { a: 7 }), { document: 'b' }, -1)).toBe(-1);
  });

  it('gives an option written a member of its own, and with no option named writes the shared one', () => {
    const held = scope('document', {}, 1);
    expect(write(held, { document: 'b' }, 2)).toEqual(scope('document', { b: 2 }, 1));
    expect(write(held, {}, 2)).toEqual(scope('document', {}, 2));
  });

  it('reads the shared member where no option is named or weighed', () => {
    const held = scope('document', { a: 7 }, 1);
    expect(memberAt(held, {}, -1)).toBe(1);
    expect(weighScope(held, {}, -1)).toEqual([{ value: 1, weight: 1 }]);
  });
});

describe('nested entries', () => {
  const lists = closed([MODE, ['types']], [LAYOUT, ['explorer']]);
  const held = scope(MODE, { types: 2 }, scope(LAYOUT, { explorer: 0.3 }, 1.1));

  it('stop at an outer own member, and go on through the shared one', () => {
    expect(memberAt(held, { [MODE]: 'types', [LAYOUT]: 'explorer' }, -1, lists)).toBe(2);
    expect(memberAt(held, { [MODE]: 'dark', [LAYOUT]: 'explorer' }, -1, lists)).toBe(0.3);
    expect(memberAt(held, { [MODE]: 'dark', [LAYOUT]: 'grid' }, -1, lists)).toBe(1.1);
    expect(memberAt(held, { [MODE]: 'dark' }, -1, lists)).toBe(1.1);
    expect([...scopeSelectors(held)]).toEqual([MODE, LAYOUT]);
  });

  it('write into the inner entry through the shared member, and drop stale members at any depth', () => {
    expect(write(held, { [MODE]: 'dark', [LAYOUT]: 'explorer' }, 0.5, lists))
      .toEqual(scope(MODE, { types: 2 }, scope(LAYOUT, { explorer: 0.5 }, 1.1)));
    expect(dropUnlisted(scope(MODE, { types: 2 }, scope(LAYOUT, { explorer: 0.3, grid: 4 }, 1.1)), lists)).toEqual(held);
  });
});

describe('a leaf with per', () => {
  const leaf = {
    kind: 'number', name: 'Limit', description: '', default: 1.1,
    scopes: [{ selector: MODE, overrides: { types: 2 } }, { selector: LAYOUT, overrides: ['explorer'] }, { selector: 'document' }],
  } as PrefLeaf;

  it('defaults to an empty scope per entry, nested outermost first', () => {
    expect(prefScopedDefault(leaf)).toEqual(scope(MODE, {}, scope(LAYOUT, {}, scope('document', {}))));
  });

  it('closes a selector given overrides, by option names or by proposed values, and leaves the rest open', () => {
    expect(prefOverridesOf(leaf, MODE)).toEqual({ types: 2 });
    expect(prefOverridesOf(leaf, LAYOUT)).toEqual(['explorer']);
    expect(prefOverridesOf(leaf, 'document')).toBeUndefined();
    expect(prefScopesOf(leaf).map((spec) => spec.selector)).toEqual([MODE, LAYOUT, 'document']);
  });

  it('defaults to its defaultScope where it has one, and to none with no entries', () => {
    const given = scope(MODE, { types: 9 });
    expect(prefScopedDefault({ ...leaf, defaultScope: given } as PrefLeaf)).toBe(given);
    expect(prefScopedDefault({ kind: 'number', name: 'N', description: '', default: 1 } as PrefLeaf)).toBeUndefined();
  });
});
