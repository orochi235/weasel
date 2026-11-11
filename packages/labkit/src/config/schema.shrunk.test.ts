/** Shrunk counterexamples from `schema.pbt.test.ts` and `sectionTree.pbt.test.ts`, kept as plain examples. */
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { isStale, seenFrom } from '../annotations/staleness';
import { f } from './builder';
import { drawsOwn } from './drawsOwn';
import { configFromPrefs } from './fromPrefs';
import { hasConfigPath, schemaNodeAtPath } from './path';
import { resolveConfigSchema } from './resolve';
import { sectionTree } from './sectionTree';
import { prefsFromConfig } from './toPrefs';

/** A shape holding `key` as its own key, as JSON or `f.prefs` can make one. */
const shapeWith = (key: string, node: unknown) =>
  Object.defineProperty({}, key, {
    value: node,
    enumerable: true,
    writable: true,
    configurable: true,
  });

describe('a schema keyed __proto__', () => {
  const schema = f.schema(shapeWith('__proto__', f.value<number[]>([]).section('Grid')));
  const resolved = resolveConfigSchema(schema);

  it('holds its default and its node under that key', () => {
    expect(hasConfigPath(schema.defaults(), '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(schema.defaults())).toBe(Object.prototype);
    expect(schemaNodeAtPath(resolved.group, '__proto__')).toMatchObject({ kind: 'list' });
  });

  it('reads back through prefsFromConfig and f.prefs', () => {
    const again = resolveConfigSchema(configFromPrefs(prefsFromConfig(resolved)));
    expect(again.group).toEqual(resolved.group);
    expect(again.sections).toEqual(resolved.sections);
  });
});

describe('a leaf keyed as something every object inherits', () => {
  it('is drawn by no renderer it did not declare', () => {
    const resolved = resolveConfigSchema(f.schema({ toString: f.string('') }));
    const leaf = resolved.group.children.toString;
    expect(leaf && isPrefLeaf(leaf) && drawsOwn(resolved, {}, 'toString', leaf)).toBe(false);
  });

  it('hidden in a group’s section, is left out of the rail rather than drawn as a function', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        s0: f.boolean(true),
        a: f.group({
          constructor: f.string('').section('A b').showIf({ path: 's0', is: false }),
          a: f.number(0).section('A b'),
        }),
      }),
    );
    const { group } = sectionTree(resolved, { s0: true, a: { a: 0 } });
    const section = ((group.children.a as PrefGroup).children['a-b'] as PrefGroup).children;
    expect(Object.keys(section)).toEqual(['a']);
  });

  it('is never stale for a key a mark did not see', () => {
    expect(isStale(seenFrom({}, ['toString']), { toString: 1 }, ['toString'])).toBe(false);
  });
});

describe('a root section whose slug is a loose root key', () => {
  it('keeps both: the section under another slug, the leaf under its key', () => {
    const resolved = resolveConfigSchema(
      f.schema({ a: f.string('').section('Grid'), grid: f.string('') }),
    );
    const tree = sectionTree(resolved, { a: '', grid: '' });
    const leaves = Object.entries(tree.group.children).flatMap(([k, c]) =>
      isPrefLeaf(c) ? [k] : Object.keys(c.children).map((j) => `${k}.${j}`),
    );
    expect(leaves.map(tree.pathAt).sort()).toEqual(['a', 'grid']);
  });
});
