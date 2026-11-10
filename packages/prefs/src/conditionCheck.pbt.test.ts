import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isPrefCondition, prefConditionHolds, type PrefCondition, type PrefConditionValue, type PrefTest } from './condition';
import { checkPrefCondition, checkPrefConditions } from './conditionCheck';
import type { PrefGroup } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import { leaf, runs, tally, timeoutFor, valueOf } from './pbt.fixture';
import type { PrefLeaf, PrefObject } from './schema';
import type { PrefUnion } from './union';

const KEYS = ['l0', 'l1', 'l2'] as const;
const LABEL = { kind: 'label', name: 'Note', description: '', default: undefined } as const;

/** Every path a value may be read at under `l` at `at`, and some it may not. */
function pathsUnder(l: PrefLeaf, at: string): string[] {
  const out = [at, `${at}.zz`];
  if (l.kind === 'object') for (const [k, f] of Object.entries((l as PrefObject).children)) out.push(...pathsUnder(f as PrefLeaf, `${at}.${k}`));
  if (l.kind === 'union') {
    const u = l as PrefUnion;
    out.push(`${at}.${u.tag}`);
    for (const v of Object.values(u.variants)) for (const [k, f] of Object.entries(v.children)) out.push(...pathsUnder(f as PrefLeaf, `${at}.${k}`));
  }
  if (l.kind === 'list' || l.kind === 'map') out.push(`${at}.0`, `${at}.a`);
  return out;
}

const compared: fc.Arbitrary<PrefConditionValue> = fc.oneof(
  fc.constantFrom<PrefConditionValue>(null, true, false, 0, 1, '', 'x', 'y', 'z', '__proto__', 'p', 'q', '#000000'),
  fc.integer({ min: -5, max: 5 }),
  fc.string({ maxLength: 2 }),
);

/** A schema of three leaves and a label, a tree of values it admits, and one single-operator test over it. */
const world = fc.tuple(leaf(), leaf(), leaf()).chain((leaves) => {
  const schema: PrefGroup = { name: 'S', children: { ...Object.fromEntries(KEYS.map((k, i) => [k, leaves[i]!])), note: LABEL } };
  const paths = [...KEYS.flatMap((k, i) => pathsUnder(leaves[i]!, k)), 'note', 'nope'];
  const trees = fc.array(fc.tuple(...leaves.map((l) => valueOf(l))).map((vs) => Object.fromEntries(KEYS.map((k, i) => [k, vs[i]]))), { minLength: 1, maxLength: 4 });
  const test = fc.record({
    path: fc.constantFrom(...paths),
    op: fc.constantFrom('is', 'isNot', 'in', 'above', 'atMost'),
    value: compared,
  });
  return fc.tuple(fc.constant(schema), trees, test);
});

const asTest = ({ path, op, value }: { path: string; op: string; value: PrefConditionValue }): PrefTest =>
  op === 'in' ? { path, in: [value] } : op === 'above' || op === 'atMost' ? { path, [op]: typeof value === 'number' ? value : 0 } : { path, [op]: value };

describe('checkPrefCondition, properties', () => {
  it('reports a test as never matching only where no value the schema admits matches it', () => {
    const t = tally();
    fc.assert(
      fc.property(world, ([schema, trees, spec]) => {
        const test = asTest(spec);
        const problems = checkPrefCondition(test, schema);
        for (const p of problems) t.count(p.code);
        if (problems.length === 0) t.count('clean');
        const holds = trees.map((tree) => prefConditionHolds(test, (path) => prefValueAtPath(tree, path)));
        if (problems.some((p) => p.code === 'no-leaf')) {
          for (const tree of trees) expect(prefValueAtPath(tree, test.path)).toBeUndefined();
        }
        if (problems.some((p) => p.code === 'value' || p.code === 'option')) {
          // `isNot` a value never held always holds; every other operator never does.
          expect(holds.every((h) => h === (spec.op === 'isNot'))).toBe(true);
        }
      }),
      runs(500),
    );
    for (const code of ['no-leaf', 'no-value', 'value', 'option', 'clean']) t.atLeast(code, 4);
  }, timeoutFor(500, 5));

  it('calls a condition malformed exactly where isPrefCondition rejects it', () => {
    const t = tally();
    const part = fc.oneof(
      fc.record({ path: fc.constantFrom('l0', 1, undefined), is: fc.constantFrom('x', 1, {}, undefined), from: fc.constantFrom(undefined, 'item', 'root') }, { requiredKeys: [] }),
      fc.constantFrom({ path: 'l0', above: '3' }, { path: 'l0', in: 'x' }, { path: 'l0', in: [[1]] }, { path: 'l0', what: 1 }, null, 3, 'l0', []),
    );
    const condition: fc.Arbitrary<unknown> = fc.letrec<{ c: unknown }>((tie) => ({
      c: fc.oneof(
        { depthSize: 'small' },
        part,
        fc.array(tie('c'), { maxLength: 3 }).map((all) => ({ all })),
        fc.array(tie('c'), { maxLength: 3 }).map((any) => ({ any })),
        tie('c').map((not) => ({ not })),
        fc.tuple(tie('c'), tie('c')).map(([not, all]) => ({ not, all })),
        fc.constant({ all: 'x' }),
      ),
    })).c;
    const schema: PrefGroup = { name: 'S', children: { l0: { kind: 'string', name: 'L', description: '', default: '' } } };
    fc.assert(
      fc.property(condition, (c) => {
        const malformed = checkPrefCondition(c, schema).some((p) => p.code === 'malformed');
        t.count(malformed ? 'malformed' : 'well-formed');
        expect(malformed).toBe(!isPrefCondition(c));
      }),
      runs(500),
    );
    t.atLeast('malformed', 50);
    t.atLeast('well-formed', 50);
  }, timeoutFor(500, 2));

  it('reaches every problem code over a schema, each naming where its node sits', () => {
    const t = tally();
    const cond = fc.oneof(
      fc.constantFrom<PrefCondition>({ path: 'l0' }, { path: 'nope' }, { path: 'note' }, { path: 'l0', in: [] }, { path: 'l0', is: 'zz' }, { path: '', from: 'item' }, { path: 'a', from: 'item' }),
      fc.constantFrom({ path: 3 }, 'bad'),
    );
    fc.assert(
      fc.property(leaf(1), cond, cond, cond, (item, onList, onItem, onLeaf) => {
        const list: PrefList = { kind: 'list', name: 'L', description: '', default: [], item: { ...item, showIf: onItem as PrefCondition }, enableIf: onList as PrefCondition };
        const map: PrefMap = { kind: 'map', name: 'M', description: '', default: {}, item: { ...item, enableIf: onItem as PrefCondition } };
        const schema: PrefGroup = {
          name: 'S',
          children: {
            l0: { kind: 'enum', name: 'E', description: '', default: 'x', options: [{ value: 'x', label: 'x' }], showIf: onLeaf as PrefCondition },
            g: { name: 'G', showIf: onLeaf as PrefCondition, children: { list, map } },
            note: LABEL,
          },
        };
        for (const p of checkPrefConditions(schema)) {
          t.count(p.code);
          expect(['l0', 'g', 'g.list', 'g.list.item', 'g.map.item']).toContain(p.at);
          if (p.code === 'item-show') expect(p.at).toBe('g.list.item');
          if (p.code === 'no-item') expect(['l0', 'g', 'g.list']).toContain(p.at);
        }
      }),
      runs(300),
    );
    for (const code of ['malformed', 'no-leaf', 'no-value', 'option', 'never', 'item-show', 'no-item']) t.atLeast(code, 5);
  }, timeoutFor(300, 3));
});
