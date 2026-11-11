/**
 * Property tests of the engine on definitions as an editor holds them mid-edit or a file loads them: every layer's
 * entries are near misses of a real entry, with fields of the wrong type, non-finite numbers, and names
 * `Object.prototype` holds, in objects JSON could hold (none without a prototype). `derive` and `bake` report what
 * they cannot use and throw only for a reference cycle or a dangling reference; `axisDependencies` answers for
 * anything.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { outcome, runs, tally, timeoutFor } from '../pbt.fixture';
import { bake } from './bake';
import { AXES, DOCUMENTED_THROW, NAMES } from './definition.fixture';
import { axisDependencies } from './deps';
import { derive } from './derive';

const RUNS = 400;

const key = fc.constantFrom('by', 'mode', 'dark', 'light', 'density', 'compact', 'toString', 'constructor', '__proto__', 'value');
const scalar = fc.oneof(
  fc.constantFrom(0, -0, 1, 0.5, -3, 1e308, Infinity, -Infinity, Number.NaN, '', 'x', '#ff0000', '#FFF', '4px', true, false, null, undefined),
  fc.constantFrom(...NAMES).map((n) => `{${n}}`),
  fc.constantFrom('hue', 'unit', 'toString', 'nope').map((s) => `{seeds.${s}}`),
  fc.constantFrom(...NAMES),
);
const junk: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof({ depthSize: 'small', withCrossShrink: true }, scalar, tie('list'), tie('object'), tie('by')),
  list: fc.array(tie('value'), { maxLength: 3 }),
  object: fc.dictionary(key, tie('value'), { maxKeys: 3, noNullPrototype: true }),
  by: fc.record({ by: fc.constantFrom('mode', 'density', 'toString', 'nope'), dark: tie('value'), compact: tie('value'), toString: tie('value') }, { requiredKeys: ['by'], noNullPrototype: true }),
})).value;

/** A record whose keys are some of `fields`, each holding a plausible value or junk. */
const near = (fields: Readonly<Record<string, fc.Arbitrary<unknown>>>) =>
  fc.dictionary(fc.constantFrom(...Object.keys(fields)), fc.constant(null), { maxKeys: Object.keys(fields).length, noNullPrototype: true }).chain((keys) =>
    fc.tuple(...Object.keys(keys).map((k) => fc.oneof(fields[k]!, junk))).map((vs) => Object.fromEntries(Object.keys(keys).map((k, i) => [k, vs[i]]))),
  );

const steps = fc.oneof(fc.subarray(['50', '100', '500', '900', 'by', 'a.b', '__proto__', 'toString']), junk);
const rampEntry = fc.oneof(
  near({ kind: fc.constantFrom('lightness', 'categorical', 'other'), steps, lightness: fc.tuple(scalar, scalar), curve: scalar, hue: scalar, chroma: near({ peak: scalar, lightBias: scalar, darkBias: scalar }), anchor: fc.dictionary(key, scalar, { noNullPrototype: true }) }),
  near({ kind: fc.constant('categorical'), steps, gates: fc.dictionary(fc.constantFrom('minContrast', 'hueFloor', 'surface', 'order', 'count', 'toString', 'nope'), fc.oneof(scalar, fc.constantFrom('hue', 'farthest', '#000000')), { noNullPrototype: true }), anchors: fc.array(near({ name: scalar, hue: scalar, lightness: scalar, chroma: scalar }), { maxLength: 2 }) }),
  junk,
);
const scaleEntry = fc.oneof(near({ steps, base: scalar, step: scalar, ratio: scalar, factors: fc.array(scalar, { maxLength: 4 }) }), junk);
const name = fc.constantFrom(...NAMES, 'nope');
const rule = fc.oneof(
  near({ ramp: fc.constantFrom('gray', 'blue', 'toString', 'nope'), step: fc.oneof(scalar, fc.constantFrom('50', '900')), type: scalar, check: near({ contrast: scalar, against: fc.oneof(fc.array(name, { maxLength: 2 }), junk) }) }),
  near({ ref: name, alpha: scalar }),
  near({ from: name, offset: scalar, dir: fc.constantFrom('lighter', 'darker', 'away', 'up') }),
  near({ ramp: fc.constantFrom('gray', 'toString'), contrast: near({ min: scalar, against: fc.oneof(fc.array(name, { maxLength: 2 }), junk) }) }),
  near({ value: scalar, type: scalar }),
  junk,
);
const layer = <T>(names: fc.Arbitrary<string>, entry: fc.Arbitrary<T>) => fc.oneof({ weight: 5, arbitrary: fc.dictionary(names, entry, { maxKeys: 4, noNullPrototype: true }) }, { weight: 1, arbitrary: junk });

const malformed: fc.Arbitrary<ThemeDefinition> = fc.record({
  name: fc.constant('t'),
  axes: fc.oneof({ weight: 6, arbitrary: fc.constant(AXES) }, { weight: 1, arbitrary: fc.dictionary(key, near({ default: scalar, values: fc.dictionary(key, fc.constant({}), { noNullPrototype: true }) }), { maxKeys: 2, noNullPrototype: true }) }),
  seeds: layer(fc.constantFrom('hue', 'unit', 'toString'), junk),
  ramps: layer(fc.constantFrom('gray', 'blue', 'toString'), rampEntry),
  scales: layer(fc.constantFrom('space', 'constructor'), scaleEntry),
  semantics: layer(fc.constantFrom('surface', 'text', 'constructor', 'line'), rule),
  components: layer(fc.constantFrom('tb', 'valueOf'), junk),
  pins: layer(name, fc.oneof(junk, near({ value: scalar, type: scalar, alpha: scalar, description: scalar, scope: junk }))),
}, { requiredKeys: ['name'] }) as fc.Arbitrary<ThemeDefinition>;

describe('the engine on malformed definitions', () => {
  it('derive and bake report what they cannot use, throwing only for a cycle or a dangling reference', () => {
    const t = tally();
    fc.assert(fc.property(malformed, fc.constantFrom({}, { mode: 'light' }, { density: 'roomy', mode: 'toString' }), (def, sel) => {
      for (const [what, run] of [['derive', () => derive(def, sel)], ['bake', () => bake(def)]] as const) {
        const got = outcome(run);
        if (typeof got === 'string' && got.startsWith('throws:')) {
          t.count(`${what} throws`);
          expect(got).toMatch(DOCUMENTED_THROW);
        } else t.count(what);
      }
    }), runs(RUNS));
    t.atLeast('derive', RUNS / 4);
    t.atLeast('bake', RUNS / 4);
  }, timeoutFor(RUNS, 30));

  it('a categorical ramp takes only gates the generator can read, reporting the rest', () => {
    const t = tally();
    const gate = fc.constantFrom('minContrast', 'hueFloor', 'minDistance', 'surface', 'order', 'equalize');
    fc.assert(fc.property(fc.dictionary(gate, fc.oneof(scalar, fc.constantFrom('hue', 'farthest', '#000000', '#fff')), { noNullPrototype: true }), fc.integer({ min: 0, max: 4 }), (gates, n) => {
      const steps = ['a', 'b', 'c', 'd'].slice(0, n);
      const { tokens, issues } = derive({ name: 't', ramps: { c: { kind: 'categorical', steps, gates } } } as ThemeDefinition);
      const bad = issues.filter((i) => i.kind === 'invalid');
      t.count(bad.length > 0 ? 'refused' : 'derived');
      if (bad.length > 0) expect(Object.keys(tokens)).toEqual([]);
      else for (const s of steps) expect(tokens[`c-${s}`]!.value).toMatch(/^#[0-9a-f]{6}$/);
    }), runs(RUNS));
    t.atLeast('refused', 50);
    t.atLeast('derived', 30);
  }, timeoutFor(RUNS, 20));

  it('axisDependencies answers for any definition', () => {
    fc.assert(fc.property(malformed, (def) => {
      const deps = axisDependencies(def);
      for (const d of Object.values(deps)) for (const a of d.own) expect(d.all).toContain(a);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 5));
});
