/**
 * CSF stories as forge reads them: what a port delivers intact is exactly what `structuredClone` copies faithfully,
 * the part sent plus what it left behind is the original, args become a schema whose defaults are their values, and
 * a module of any exports yields one story per story export under Storybook's ids, or the one error Storybook gives.
 */
import { createElement } from 'react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { storyId, storyNameFromExport } from '../story/ids';
import { json, key, runs, tally, text, timeoutFor } from '../pbt.fixture';
import { argsToSchema, type ArgType } from './argsToSchema';
import { loadCsfModule } from './loadCsfModule';
import { isPortSafe, portSafePart, withUnsent } from './portSafe';

const RUNS = 200;

class Swatch {
  r = 1;
  hex(): string {
    return '#010000';
  }
}

function own<T extends Record<string, unknown>>(entries: readonly (readonly [string, unknown])[]): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out as T;
}

/** Something a port cannot carry as itself. */
const unsafe = fc.oneof(
  fc.constant(() => 1),
  fc.constant(Symbol('s')),
  fc.constant(new Swatch()),
  fc.constant(createElement('b')),
  fc.constant(new (class Stops extends Array {})()),
);

const safeLeaf = fc.oneof(
  text,
  fc.double(),
  fc.boolean(),
  fc.constantFrom(null, undefined, 0n, -0),
  fc.date({ noInvalidDate: true }),
  fc.constant(/x/g),
  fc.integer({ min: 0, max: 4 }).map((n) => new Uint8Array(n)),
);

/** A tree of plain objects, arrays, Maps and Sets, some of whose members a port cannot carry. */
const tree: fc.Arbitrary<unknown> = fc.letrec<{ node: unknown }>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    { weight: 4, arbitrary: safeLeaf },
    { weight: 2, arbitrary: unsafe },
    { weight: 2, arbitrary: fc.array(tie('node'), { maxLength: 3 }) },
    { weight: 2, arbitrary: fc.array(fc.tuple(key, tie('node')), { maxLength: 3 }).map((e) => own(e)) },
    { weight: 1, arbitrary: fc.array(fc.tuple(text, tie('node')), { maxLength: 2 }).map((e) => new Map(e)) },
    { weight: 1, arbitrary: fc.array(tie('node'), { maxLength: 2 }).map((e) => new Set(e)) },
  ),
})).node;

/** Whether `a` and `b` are the same data, prototypes, Map and Set contents, and function identity included. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  // A clone may come from another realm than the test's, so a prototype is compared by its tag and constructor's name.
  const kind = (v: object): string => `${Object.prototype.toString.call(v)}:${(Object.getPrototypeOf(v) as { constructor?: { name?: string } } | null)?.constructor?.name}`;
  if (kind(a) !== kind(b)) return false;
  if (kind(a).startsWith('[object Date]')) return a.getTime() === (b as Date).getTime();
  if (kind(a).startsWith('[object RegExp]')) return String(a) === String(b);
  if (ArrayBuffer.isView(a)) return String(a) === String(b);
  if (kind(a).startsWith('[object Map]')) {
    const bm = b as Map<unknown, unknown>;
    return a.size === bm.size && [...a].every(([k, v], i) => { const [bk, bv] = [...bm][i]!; return same(k, bk) && same(v, bv); });
  }
  if (kind(a).startsWith('[object Set]')) return same([...a], [...(b as Set<unknown>)]);
  const ka = Reflect.ownKeys(a);
  const kb = Reflect.ownKeys(b);
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && same((a as Record<PropertyKey, unknown>)[k], (b as Record<PropertyKey, unknown>)[k]));
}

/** Whether a value holds anything a port cannot carry. */
function holdsUnsafe(v: unknown): boolean {
  if (typeof v === 'function' || typeof v === 'symbol') return true;
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  if (proto === Map.prototype) return [...(v as Map<unknown, unknown>)].some(([k, m]) => holdsUnsafe(k) || holdsUnsafe(m));
  if (proto === Set.prototype) return [...(v as Set<unknown>)].some(holdsUnsafe);
  if (proto !== Object.prototype && proto !== Array.prototype) return !(v instanceof Date || v instanceof RegExp || ArrayBuffer.isView(v));
  return Object.values(v).some(holdsUnsafe);
}

describe('isPortSafe', () => {
  it('holds exactly for a value structuredClone copies as itself', () => {
    const seen = tally();
    fc.assert(
      fc.property(tree, (v) => {
        const safe = isPortSafe(v);
        expect(safe).toBe(!holdsUnsafe(v));
        if (safe) {
          expect(same(structuredClone(v), v)).toBe(true);
          seen.count('safe');
        } else seen.count('unsafe');
      }),
      runs(RUNS),
    );
    seen.atLeast('safe', 40);
    seen.atLeast('unsafe', 10);
  }, timeoutFor(RUNS, 2));
});

describe('portSafePart and withUnsent', () => {
  it('send a part the port carries, and put back what it left behind', () => {
    const seen = tally();
    fc.assert(
      fc.property(tree, (v) => {
        const part = portSafePart(v);
        if (part === null) {
          seen.count('nothing sent');
          expect(withUnsent(null, v)).toBe(v);
          return;
        }
        expect(isPortSafe(part.value)).toBe(true);
        const back = withUnsent(structuredClone(part.value), v);
        expect(same(back, v)).toBe(true);
        if (holdsUnsafe(v)) seen.count('split');
      }),
      runs(RUNS),
    );
    seen.atLeast('split', 4);
    seen.atLeast('nothing sent', 8);
  }, timeoutFor(RUNS, 2));

  it('keep an edit made to the sent part of an object, with only unsent parts put back under it', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(key, tree), { minLength: 1, maxLength: 4 }), key, json, (entries, edited, value) => {
        const original = own(entries);
        const part = portSafePart(original);
        if (part === null) return;
        const sent = { ...(part.value as Record<string, unknown>) };
        Object.defineProperty(sent, edited, { value, enumerable: true, writable: true, configurable: true });
        const back = withUnsent(sent, original) as Record<string, unknown>;
        expect(Object.hasOwn(back, edited)).toBe(true);
        // What the edit holds is in force; only what the port could not carry is put back under it.
        expect(same(portSafePart(back[edited])?.value, value)).toBe(true);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 2));
});

describe('argsToSchema', () => {
  it('gives each arg a leaf defaulting to the part of it a port carries, prototype-named args included', () => {
    const seen = tally();
    const value = fc.oneof(text, fc.double({ noNaN: true }), fc.boolean(), json, tree);
    fc.assert(
      fc.property(fc.array(fc.tuple(key, value), { maxLength: 5 }), (entries) => {
        const args = own(entries);
        const schema = argsToSchema(args, {});
        const defaults = schema.defaults() as Record<string, unknown>;
        for (const [k, v] of Object.entries(args)) {
          const part = portSafePart(v);
          const leafy = part !== null && (['string', 'number', 'boolean'].includes(typeof part.value) || Array.isArray(part.value) || (part.value !== null && typeof part.value === 'object' && Object.getPrototypeOf(part.value) === Object.prototype));
          if (!leafy) continue;
          expect(Object.hasOwn(schema.nodes, k), k).toBe(true);
          expect(same(defaults[k], part.value), k).toBe(true);
          if (/__proto__|constructor|toString|valueOf|hasOwnProperty/.test(k)) seen.count('prototype-named');
        }
        for (const k of Object.keys(schema.nodes)) expect(Object.hasOwn(args, k)).toBe(true);
      }),
      runs(RUNS),
    );
    seen.atLeast('prototype-named', 20);
  }, timeoutFor(RUNS, 2));

  it('gives an argTypes-only key a leaf, and labels only from its own argType', () => {
    const argType = fc.oneof(
      fc.constant<ArgType>({ control: 'text' }),
      fc.constant<ArgType>({ control: 'boolean' }),
      fc.constant<ArgType>({ control: 'number' }),
      fc.constant<ArgType>({ control: 'select', options: ['a', 'b'] }),
      fc.constant<ArgType>({ options: ['x', 'y'] }),
    );
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(key, argType), { selector: ([k]) => k, maxLength: 4 }), fc.array(fc.tuple(key, text), { maxLength: 3 }), (types, argEntries) => {
        const args = own(argEntries);
        const argTypes = own<Record<string, ArgType>>(types);
        const schema = argsToSchema(args, argTypes);
        for (const [k] of types) {
          expect(Object.hasOwn(schema.nodes, k), k).toBe(true);
          const node = (schema.nodes as Record<string, { annotations: { name?: string } }>)[k]!;
          expect(node.annotations.name).toBeUndefined();
        }
        for (const k of Object.keys(args)) {
          if (Object.hasOwn(argTypes, k)) continue;
          expect((schema.nodes as Record<string, { annotations: { name?: string } }>)[k]!.annotations.name, k).toBeUndefined();
        }
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 2));
});

const exportName = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('Primary', 'withIcon2', 'Big_Button', 'a', 'B', 'toString', 'constructor', 'valueOf') },
  { weight: 1, arbitrary: fc.constantFrom('default', '__namedExportsOrder', '__esModule', '_', '$') },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 6 }) },
);
const exportValue = fc.oneof(
  fc.constant({}),
  fc.record({ name: fc.option(text, { nil: undefined }), args: fc.option(fc.array(fc.tuple(key, fc.oneof(text, fc.integer())), { maxLength: 3 }).map((e) => own(e)), { nil: undefined }) }),
  fc.constant(() => null),
  fc.constantFrom(1, 'text', null, undefined, true),
);

describe('loadCsfModule', () => {
  it("lists one story per story export, in order, under Storybook's id and name, or throws Storybook's error", () => {
    const seen = tally();
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(exportName, exportValue), { selector: ([n]) => n, maxLength: 5 }), fc.constantFrom('ui/Button', 'Kit', 'a b/c'), (exports, title) => {
        const mod = own(exports);
        const expected = exports.filter(([n, v]) => !['default', '__namedExportsOrder', '__esModule'].includes(n) && v !== null && (typeof v === 'object' || typeof v === 'function'));
        let ids: string[];
        try {
          ids = expected.map(([n]) => storyId(title, n));
        } catch (error) {
          expect(() => loadCsfModule(mod, title)).toThrow((error as Error).message);
          seen.count('refused');
          return;
        }
        const stories = loadCsfModule(mod, title);
        expect(stories.map((s) => s.id)).toEqual(ids);
        stories.forEach((story, i) => {
          const [n, v] = expected[i]!;
          const given = typeof v === 'object' ? (v as { name?: string }).name : undefined;
          expect(story.name).toBe(given || storyNameFromExport(n));
          expect(story.exportName).toBe(n);
          const args = typeof v === 'object' ? ((v as { args?: Record<string, unknown> }).args ?? {}) : {};
          const defaults = story.config.defaults() as Record<string, unknown>;
          for (const [k, a] of Object.entries(args)) expect(Object.hasOwn(defaults, k) && defaults[k], k).toBe(a);
        });
        if (stories.length > 1) seen.count('several');
      }),
      runs(RUNS),
    );
    seen.atLeast('several', 20);
    seen.atLeast('refused', 6);
  }, timeoutFor(RUNS, 3));
});

describe('shrunk counterexamples', () => {
  const ownKey = (k: string, value: unknown): Record<string, unknown> => own([[k, value]]);
  const label = (schema: ReturnType<typeof argsToSchema>, k: string): string | undefined =>
    (schema.nodes as Record<string, { annotations: { name?: string } }>)[k]!.annotations.name;

  it('gives an argType keyed `__proto__` an own leaf', () => {
    const schema = argsToSchema({}, ownKey('__proto__', { control: 'text' }) as Record<string, ArgType>);
    expect(Object.hasOwn(schema.nodes, '__proto__')).toBe(true);
  });

  it('gives an argTypes-only key named like a prototype member a leaf', () => {
    expect(Object.hasOwn(argsToSchema({}, { toString: { control: 'text' } }).nodes, 'toString')).toBe(true);
  });

  it('labels an arg named `constructor` by nothing, not by `Object.name`', () => {
    expect(label(argsToSchema({ constructor: 'x' }, {}), 'constructor')).toBeUndefined();
  });

  it('puts an edit keyed `__proto__` back as an own key', () => {
    const back = withUnsent(ownKey('__proto__', []), { a: Symbol('s') }) as Record<string, unknown>;
    expect(Object.hasOwn(back, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(back)).toBe(Object.prototype);
  });

  it('defaults a story arg keyed `__proto__` to its value', () => {
    const [story] = loadCsfModule({ Primary: { args: ownKey('__proto__', 'x') } }, 'ui/Button');
    const defaults = story!.config.defaults() as Record<string, unknown>;
    expect(Object.hasOwn(defaults, '__proto__') && defaults['__proto__']).toBe('x');
  });
});
