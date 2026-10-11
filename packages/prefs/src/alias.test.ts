import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { prefAliasedLeaf, prefAliasTarget, type PrefAlias } from './alias';
import type { PrefGroup, PrefSection } from './groups';
import { prefHoldsValue, prefLeafAt } from './helpers';
import type { PrefPath } from './paths';
import { createPrefsStore } from './store';

const alias = (of: string, name = ''): PrefAlias => ({ kind: 'alias', name, description: '', default: undefined, of });

const SCHEMA = {
  name: 'T',
  children: {
    view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: 'Draw it.', default: true } } },
    play: { name: 'Play', children: { grid: alias('view.grid'), again: alias('play.grid', 'Grid, again') } },
  },
} satisfies PrefGroup;

const at = (path: string) => prefLeafAt(SCHEMA, path);

describe('prefLeafAt', () => {
  it('finds a leaf by the path its value lives at, and nothing at a group or past a leaf', () => {
    expect(at('view.grid')).toBe(SCHEMA.children.view.children.grid);
    expect(at('view')).toBeUndefined();
    expect(at('view.grid.x')).toBeUndefined();
    expect(at('nope')).toBeUndefined();
    expect(at('toString')).toBeUndefined();
  });

  it('finds a section root\'s leaf by its own key, through the sections between', () => {
    const x = { kind: 'number', name: 'X', description: '', default: 0 } as const;
    const node: PrefSection = { name: 'Node', members: { layout: { name: 'Layout', members: { 'pose.x': x } } } };
    expect(prefLeafAt(node, 'pose.x')).toBe(x);
    expect(prefLeafAt(node, 'layout')).toBeUndefined();
  });
});

describe('prefAliasTarget', () => {
  it('names the leaf an alias shows and where its value lives', () => {
    expect(prefAliasTarget(SCHEMA.children.play.children.grid, at)).toEqual({ path: 'view.grid', leaf: SCHEMA.children.view.children.grid });
  });

  it('follows an alias of an alias to its end', () => {
    expect(prefAliasTarget(SCHEMA.children.play.children.again, at)?.path).toBe('view.grid');
  });

  it('answers nothing for a path that names no leaf, and for aliases that lead back around', () => {
    expect(prefAliasTarget(alias('view.gone'), at)).toBeUndefined();
    const loop: PrefGroup = { name: 'L', children: { a: alias('b'), b: alias('a') } };
    expect(prefAliasTarget(alias('a'), (p) => prefLeafAt(loop, p))).toBeUndefined();
  });
});

describe('prefAliasedLeaf', () => {
  it('is the target under the alias\'s own name and description, where it gives them', () => {
    const target = SCHEMA.children.view.children.grid;
    expect(prefAliasedLeaf(alias('view.grid'), target)).toEqual(target);
    expect(prefAliasedLeaf(alias('view.grid', 'Grid here'), target)).toEqual({ ...target, name: 'Grid here' });
  });
});

describe('an alias in a store', () => {
  it('holds no value: the store has one for the target alone', () => {
    expect(prefHoldsValue(alias('view.grid'))).toBe(false);
    const cache = createRecordCache({ storage: createMemoryAdapter(new Map()), prefix: 'p.' });
    expect(createPrefsStore(SCHEMA, cache).values()).toEqual({ view: { grid: true } });
  });

  it('is not a path a store reads', () => {
    expectTypeOf<PrefPath<typeof SCHEMA>>().toEqualTypeOf<'view.grid'>();
  });
});
