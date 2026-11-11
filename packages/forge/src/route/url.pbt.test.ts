/**
 * Forge's URL: a route written and read back is the same route; a trial's knobs written as params and read back are
 * the same values, through the hash; reserved and knob params partition every param; pins round-trip; and no hash,
 * however malformed, makes a reader throw.
 */
import { type ConfigEntry, type ConfigSchema, f, isConfigBranch } from '@weasel-js/labkit/config';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { anyFinite, json, jsonObject, key, runs, tally, text, timeoutFor } from '../pbt.fixture';
import { withGlobals } from '../shell/globals';
import {
  decodeKnob,
  encodeKnob,
  formatRoute,
  isKnobParam,
  type KnobLeaf,
  knobParams,
  knobPaths,
  knobsToParams,
  paramsToKnobs,
  paramsToPins,
  parseRoute,
  pinParams,
  reservedParams,
  sameKnob,
  storyHref,
  withoutPins,
} from './url';

const RUNS = 200;

const wellFormed = (s: string): string => s.replace(/\p{Cs}/gu, '\uFFFD');

/** A leaf, and values it can hold. */
interface Spec {
  node: ConfigEntry;
  value: fc.Arbitrary<unknown>;
}

const options = fc.uniqueArray(text, { minLength: 1, maxLength: 4 });

const spec: fc.Arbitrary<Spec> = fc.oneof(
  text.map((d) => ({ node: f.string(d), value: text })),
  anyFinite.map((d) => ({ node: f.number(d), value: anyFinite })),
  fc.boolean().map((d) => ({ node: f.boolean(d), value: fc.boolean() })),
  options.map((o) => ({ node: f.enum(o[0]!, o), value: fc.constantFrom(...o) })),
  text.map((d) => ({ node: f.color(d), value: text })),
  fc.array(text, { maxLength: 3 }).map((d) => ({ node: f.list(d), value: fc.array(text, { maxLength: 3 }) })),
  fc.array(fc.integer(), { maxLength: 3 }).map((d) => ({
    node: f.list(d, f.number(0)) as unknown as ConfigEntry,
    value: fc.array(anyFinite, { maxLength: 3 }),
  })),
  jsonObject.map((d) => ({ node: f.value(d), value: jsonObject })),
  fc.array(json, { maxLength: 3 }).map((d) => ({ node: f.value(d), value: fc.array(json, { maxLength: 3 }) })),
);

const schemaKey = fc.oneof({ weight: 6, arbitrary: key }, { weight: 1, arbitrary: fc.constantFrom('t', '$x', 'a.b', '') });

/** A schema of leaves and one level of groups, with a config setting some of its leaves. */
const schemaAndConfig: fc.Arbitrary<{ schema: ConfigSchema<unknown>; config: Record<string, unknown> }> = fc
  .uniqueArray(
    fc.tuple(schemaKey, fc.oneof({ weight: 3, arbitrary: spec.map((s) => [s]) }, { weight: 1, arbitrary: fc.array(spec, { minLength: 2, maxLength: 3 }) }), fc.uniqueArray(schemaKey, { minLength: 3, maxLength: 3 })),
    { maxLength: 5, selector: ([k]) => k },
  )
  .chain((rows) => {
    const shape: Record<string, ConfigEntry> = {};
    const values: fc.Arbitrary<[string[], unknown]>[] = [];
    for (const [k, specs, childKeys] of rows) {
      if (specs.length === 1) {
        Object.defineProperty(shape, k, { value: specs[0]!.node, enumerable: true, writable: true, configurable: true });
        values.push(fc.tuple(fc.constant([k]), fc.option(specs[0]!.value, { nil: undefined })));
      } else {
        const children: Record<string, ConfigEntry> = {};
        specs.forEach((s, i) => {
          const ck = childKeys[i]!;
          Object.defineProperty(children, ck, { value: s.node, enumerable: true, writable: true, configurable: true });
          values.push(fc.tuple(fc.constant([k, ck]), fc.option(s.value, { nil: undefined })));
        });
        Object.defineProperty(shape, k, { value: f.group(children), enumerable: true, writable: true, configurable: true });
      }
    }
    const schema = f.schema(shape) as unknown as ConfigSchema<unknown>;
    return fc.tuple(...values).map((set) => {
      const config: Record<string, unknown> = {};
      for (const [path, value] of set) {
        if (value === undefined) continue;
        let at = config;
        for (const seg of path.slice(0, -1)) {
          if (!Object.hasOwn(at, seg) || typeof at[seg] !== 'object') own(at, seg, {});
          at = at[seg] as Record<string, unknown>;
        }
        own(at, path.at(-1)!, value);
      }
      return { schema, config };
    });
  });

function own(target: Record<string, unknown>, k: string, value: unknown): void {
  Object.defineProperty(target, k, { value, enumerable: true, writable: true, configurable: true });
}

/** Every leaf in a shape, by dotted path, keys empty, holding a dot, or starting with `$` skipped as `knobPaths` does. */
function leaves(shape: Record<string, ConfigEntry>, at = ''): [string, KnobLeaf][] {
  return Object.entries(shape).flatMap(([k, entry]): [string, KnobLeaf][] => {
    if (k === '' || k.startsWith('$') || k.includes('.')) return [];
    const path = at === '' ? k : `${at}.${k}`;
    return isConfigBranch(entry) ? leaves(entry.children as Record<string, ConfigEntry>, path) : [[path, entry as KnobLeaf]];
  });
}

const paramRecord = fc.array(fc.tuple(text, text), { maxLength: 5 }).map((entries) => {
  const out: Record<string, string> = {};
  for (const [k, v] of entries) own(out, k, v);
  return out;
});

describe('parseRoute / formatRoute', () => {
  it('reads back the route it wrote', () => {
    const seen = tally();
    fc.assert(
      fc.property(fc.option(text.filter((s) => s !== ''), { nil: null }), paramRecord, (story, params) => {
        const route = { story, params };
        const back = parseRoute(formatRoute(route));
        expect(back.story).toBe(story);
        expect(Object.entries(back.params)).toEqual(Object.entries(params));
        if (Object.keys(params).length > 1) seen.count('several params');
        if (story !== null && /[?#%&/ ]/.test(story)) seen.count('escaped story');
      }),
      runs(RUNS),
    );
    seen.atLeast('several params', 20);
    seen.atLeast('escaped story', 5);
  }, timeoutFor(RUNS, 2));

  it('reads any hash without throwing, naming no story unless it starts `#/`', () => {
    const hash = fc.oneof(
      fc.string({ unit: 'binary', maxLength: 20 }),
      fc.tuple(fc.constantFrom('#/', '/', '#', ''), fc.string({ unit: fc.constantFrom('%', 'E', '0', 'A', '?', '=', '&', 'a', '#', '\uD800'), maxLength: 12 })).map(([a, b]) => a + b),
    );
    fc.assert(
      fc.property(hash, (h) => {
        const route = parseRoute(h);
        const body = h.startsWith('#') ? h.slice(1) : h;
        if (!body.startsWith('/')) expect(route).toEqual({ story: null, params: {} });
        expect(route.story === null || typeof route.story === 'string').toBe(true);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));

  it('writes any story id and params without throwing, a lone surrogate written as U+FFFD', () => {
    const seen = tally();
    const illFormed = fc.string({ unit: fc.constantFrom('a', '\uD800', '\uDC00', '\uD83D', '%', '/', '?', ' '), maxLength: 6 });
    fc.assert(
      fc.property(illFormed.filter((s) => s !== ''), fc.dictionary(illFormed, illFormed), (story, params) => {
        const back = parseRoute(formatRoute({ story, params }));
        expect(back.story).toBe(wellFormed(story));
        expect(back.params).toEqual(Object.fromEntries(Object.entries(params).map(([k, v]) => [wellFormed(k), wellFormed(v)])));
        if (story !== wellFormed(story)) seen.count('lone surrogate');
      }),
      runs(RUNS),
    );
    seen.atLeast('lone surrogate', 20);
  }, timeoutFor(RUNS, 1));
});

describe('knob and reserved params', () => {
  it('partition every param', () => {
    fc.assert(
      fc.property(paramRecord, fc.constantFrom('t', '$globals.mode', '$x', ''), text, (params, extra, value) => {
        const all = { ...params };
        own(all, extra, value);
        const knobs = knobParams(all);
        const reserved = reservedParams(all);
        expect(Object.keys(knobs).every(isKnobParam)).toBe(true);
        expect(Object.keys(reserved).some(isKnobParam)).toBe(false);
        expect({ ...knobs, ...reserved }).toEqual(all);
        expect(Object.keys(knobs).length + Object.keys(reserved).length).toBe(Object.keys(all).length);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

describe('knob values', () => {
  it('decode back from what they encode as, for every leaf kind', () => {
    const seen = tally();
    fc.assert(
      fc.property(spec.chain((s) => fc.tuple(fc.constant(s), s.value)), ([s, value]) => {
        const raw = encodeKnob(value);
        expect(raw).toBeDefined();
        const back = decodeKnob(raw!, s.node as KnobLeaf);
        expect(back).toBeDefined();
        expect(sameKnob(back!.value, value)).toBe(true);
        seen.count(String((s.node as KnobLeaf).kind));
      }),
      runs(RUNS),
    );
    for (const kind of ['string', 'number', 'boolean', 'enum', 'color', 'list', 'null']) seen.atLeast(kind, 5);
  }, timeoutFor(RUNS, 1));

  it('decode any text as their leaf or refuse it, never throwing', () => {
    fc.assert(
      fc.property(spec, fc.oneof(text, json.map((v) => JSON.stringify(v)), fc.constantFrom('NaN', 'Infinity', '1e999', ' 1 ', '0x10', 'true', '1', '[1]', '{}')), (s, raw) => {
        const back = decodeKnob(raw, s.node as KnobLeaf);
        if (back === undefined) return;
        const kind = (s.node as KnobLeaf).kind;
        if (kind === 'number') expect(typeof back.value).toBe('number');
        if (kind === 'boolean') expect(typeof back.value).toBe('boolean');
        if (kind === 'string' || kind === 'color' || kind === 'enum') expect(back.value).toBe(raw);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));

  it('round-trip a whole trial through the hash: only the leaves off their defaults, each read back as it was', () => {
    const seen = tally();
    fc.assert(
      fc.property(schemaAndConfig, ({ schema, config }) => {
        const params = knobsToParams(schema, config);
        const back = paramsToKnobs(schema, parseRoute(formatRoute({ story: 'a--b', params })).params);
        const paths = knobPaths(schema).map((k) => k.path);
        expect(new Set(paths).size).toBe(paths.length);
        expect(Object.keys(params).every(isKnobParam)).toBe(true);
        const expected = leaves(schema.nodes as Record<string, ConfigEntry>).filter(([path, leaf]) => {
          const value = path.split('.').reduce<unknown>((at, seg) => (at !== null && typeof at === 'object' && Object.hasOwn(at, seg) ? (at as Record<string, unknown>)[seg] : undefined), config);
          return isKnobParam(path) && value !== undefined && !sameKnob(value, leaf.default);
        });
        expect(Object.keys(back).sort()).toEqual(expected.map(([p]) => p).sort());
        for (const [path] of expected) {
          const value = path.split('.').reduce<unknown>((at, seg) => (at as Record<string, unknown>)[seg], config);
          expect(sameKnob(back[path], value), path).toBe(true);
        }
        if (expected.length > 1) seen.count('several knobs');
        if (expected.some(([p]) => p.includes('.'))) seen.count('nested knob');
        if (expected.some(([p]) => /__proto__|constructor|toString/.test(p))) seen.count('prototype-named knob');
      }),
      runs(RUNS),
    );
    seen.atLeast('several knobs', 20);
    seen.atLeast('nested knob', 10);
    seen.atLeast('prototype-named knob', 10);
  }, timeoutFor(RUNS, 4));
});

describe('storyHref', () => {
  it('names the story and keeps the workshop params, writing only knob params beside them', () => {
    fc.assert(
      fc.property(text.filter((s) => s !== ''), fc.dictionary(key, fc.oneof(text, anyFinite, fc.boolean(), jsonObject)), paramRecord, (story, knobs, params) => {
        const route = parseRoute(storyHref(story, knobs, params));
        expect(route.story).toBe(story);
        for (const [name, value] of Object.entries(reservedParams(params))) expect(route.params[name]).toBe(value);
        for (const [name, value] of Object.entries(knobParams(route.params))) {
          expect(Object.hasOwn(knobs, name)).toBe(true);
          expect(value).toBe(encodeKnob(knobs[name]));
        }
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

describe('pins', () => {
  it('read back as written for every offered value, and withoutPins removes exactly them', () => {
    const declarations = fc
      .uniqueArray(fc.tuple(key, options), { selector: ([k]) => k, minLength: 1, maxLength: 3 })
      .map((rows) => {
        const out: Record<string, { label: string; options: { value: string; label: string }[]; default: string }> = {};
        for (const [k, o] of rows)
          Object.defineProperty(out, k, { value: { label: k, options: o.map((value) => ({ value, label: value })), default: o[0]! }, enumerable: true });
        return out;
      });
    fc.assert(
      fc.property(
        declarations.chain((d) =>
          fc.tuple(fc.constant(d), fc.tuple(...Object.values(d).map((decl) => fc.constantFrom(...decl.options.map((o) => o.value))))),
        ),
        paramRecord,
        ([decls, picked], other) => {
          const globals: Record<string, string> = {};
          Object.keys(decls).forEach((k, i) => own(globals, k, picked[i]!));
          const schema = withGlobals(f.schema({}) as unknown as ConfigSchema<unknown>, decls);
          const pins = pinParams(globals);
          const params = { ...knobParams(other), ...pins };
          expect(paramsToPins(schema, params)).toEqual(pins);
          expect(withoutPins(params)).toEqual(knobParams(other));
        },
      ),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples', () => {
  it('writes and reads a knob keyed `__proto__` as an own param', () => {
    const schema = f.schema(Object.defineProperty({}, '__proto__', { value: f.string(''), enumerable: true })) as unknown as ConfigSchema<unknown>;
    const config = Object.defineProperty({}, '__proto__', { value: 'x', enumerable: true });
    const params = knobsToParams(schema, config);
    expect(Object.keys(params)).toEqual(['__proto__']);
    const knobs = paramsToKnobs(schema, parseRoute(formatRoute({ story: 'a', params })).params);
    expect(Object.hasOwn(knobs, '__proto__') && knobs['__proto__']).toBe('x');
    expect(Object.getPrototypeOf(knobs)).toBe(Object.prototype);
    const href = parseRoute(storyHref('a', Object.defineProperty({}, '__proto__', { value: 2, enumerable: true })));
    expect(href.params).toEqual(Object.defineProperty({}, '__proto__', { value: '2', enumerable: true }));
  });

  it('gives a group keyed by the empty string no params, so its leaves cannot shadow the root', () => {
    const schema = f.schema({ a: f.number(0), '': f.group({ a: f.string('') }) }) as unknown as ConfigSchema<unknown>;
    expect(knobPaths(schema).map((k) => k.path)).toEqual(['a']);
  });

  it('writes a story id holding a lone surrogate', () => {
    expect(parseRoute(formatRoute({ story: '\uD800', params: {} })).story).toBe('�');
  });
});
