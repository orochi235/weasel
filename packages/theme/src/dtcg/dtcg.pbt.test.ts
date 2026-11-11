/**
 * Property tests of the DTCG reading side: alias resolution against a from-scratch oracle, token values written
 * and read back, alpha folded into a color, and `loadDTCG` and `flattenTokens` fuzzed with arbitrary JSON.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseColor } from '@weasel-js/paint';
import { loadDTCG, type DtcgDocument } from '../loadDTCG';
import { rawToken, runs, tally, timeoutFor, tokenName } from '../pbt.fixture';
import { enumerateSelections } from '../axes';
import { resolveTheme, themeAxes } from '../resolveTheme';
import { withAlpha } from './color';
import { flattenTokens } from './flatten';
import { refTarget, resolveTokens } from './resolve';
import type { FlatTokens } from './types';
import { parseTokenValue, serializeTokenValue } from './value';

const RUNS = 300;

/** What a token resolves to, following references one hop at a time with a step budget instead of a stack. */
function oracle(tokens: FlatTokens, name: string): { ok: true; value: string } | { ok: false; why: 'cycle' | 'dangling' } {
  const path: string[] = [];
  let at = name;
  for (;;) {
    if (path.includes(at)) return { ok: false, why: 'cycle' };
    path.push(at);
    const target = refTarget(tokens[at]!.value);
    if (target === null) break;
    if (!Object.hasOwn(tokens, target)) return { ok: false, why: 'dangling' };
    at = target;
  }
  let value = serializeTokenValue(tokens[at]!.type, tokens[at]!.value);
  for (let i = path.length - 1; i >= 0; i--) {
    const alpha = tokens[path[i]!]!.alpha;
    if (alpha !== undefined) value = withAlpha(value, alpha);
  }
  return { ok: true, value };
}

describe('resolveTokens', () => {
  it('resolves every token as following its references does, and throws for a cycle or a dangling one', () => {
    const t = tally();
    fc.assert(
      fc.property(fc.dictionary(tokenName, rawToken, { minKeys: 1, maxKeys: 8 }), (tokens) => {
        const answers = Object.keys(tokens).map((n) => oracle(tokens, n));
        const bad = answers.find((a) => !a.ok);
        if (bad && !bad.ok) {
          t.count(bad.why);
          expect(() => resolveTokens(tokens)).toThrow(bad.why === 'cycle' ? /Reference cycle/ : /which is not defined/);
          return;
        }
        t.count('resolves');
        const out = resolveTokens(tokens);
        expect(Object.keys(out).sort()).toEqual(Object.keys(tokens).sort());
        Object.keys(tokens).forEach((n, i) => expect(out[n]).toBe((answers[i] as { value: string }).value));
        if (Object.values(tokens).some((tk) => refTarget(tk.value) !== null)) t.count('with aliases');
      }),
      runs(RUNS),
    );
    t.atLeast('resolves', 30);
    t.atLeast('with aliases', 15);
    t.atLeast('cycle', 30);
    t.atLeast('dangling', 30);
  }, timeoutFor(RUNS, 5));
});

describe('token values', () => {
  const family = fc.stringMatching(/^[A-Za-z0-9-]+( [A-Za-z0-9-]+)*$/);

  it('a font stack is read back from its CSS as the list it was', () => {
    fc.assert(fc.property(fc.array(family, { minLength: 1, maxLength: 4 }), (list) => {
      expect(parseTokenValue('fontFamily', serializeTokenValue('fontFamily', list))).toEqual(list);
    }), runs(RUNS));
  });

  it('a cubic bezier is read back from its CSS as the four numbers it was', () => {
    const n = fc.double({ noNaN: true, noDefaultInfinity: true }).map((x) => x + 0);
    fc.assert(fc.property(fc.tuple(n, n, n, n), (four) => {
      expect(parseTokenValue('cubicBezier', serializeTokenValue('cubicBezier', four))).toEqual(four);
    }), runs(RUNS));
  });

  it('parsing is idempotent through serializing, for any text of any type', () => {
    const type = fc.constantFrom('cubicBezier', 'fontFamily', 'color', 'dimension');
    fc.assert(fc.property(type, fc.string(), (ty, text) => {
      const once = parseTokenValue(ty, text);
      expect(parseTokenValue(ty, serializeTokenValue(ty, once))).toEqual(once);
    }), runs(RUNS));
  });
});

describe('withAlpha', () => {
  const byte = fc.integer({ min: 0, max: 255 });
  const unit = fc.oneof(fc.constantFrom(0, 1, 0.5), fc.double({ min: 0, max: 1, noNaN: true }));
  const hex = (n: number) => n.toString(16).padStart(2, '0');

  it('keeps a hex color\'s channels and multiplies its alpha', () => {
    fc.assert(fc.property(byte, byte, byte, byte, unit, (r, g, b, a, alpha) => {
      const out = withAlpha(`#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`, alpha);
      const [R, G, B, A] = parseColor(out);
      expect([Math.round(R * 255), Math.round(G * 255), Math.round(B * 255)]).toEqual([r, g, b]);
      expect(A).toBeCloseTo((a / 255) * alpha, 2);
      expect(A).toBeGreaterThanOrEqual(0);
      expect(A).toBeLessThanOrEqual(1);
    }), runs(RUNS));
  });
});

/** JSON whose objects lean toward DTCG's own keys, so the fuzz gets past the first checks. */
const dtcgish = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(null, true, 0, -1, 1.5, '', '#fff', '{color.fg}', '{fg}', '4px', 'dark', 'constructor'),
    fc.string({ maxLength: 6 }),
    fc.double(),
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(
      fc.oneof(fc.constantFrom('$value', '$type', '$extensions', '$description', 'color', 'fg', 'dark', 'light', 'by', 'constructor', '__proto__', 'mode', 'axes', 'varies', 'overrides', 'default', 'values', 'primitives', 'modes', 'com.weasel.alpha', 'com.weasel.scope'), fc.string({ maxLength: 4 })),
      tie('value'),
      { maxKeys: 5 },
    ),
  ),
})).value;

const axisName = fc.constantFrom('mode', 'density', 'constructor', 'by');
const valueName = fc.constantFrom('dark', 'light', 'roomy', 'constructor', 'by');
const $value = fc.oneof({ weight: 4, arbitrary: fc.constantFrom('#fff', '4px', '{fg}', '{color.bg}', 2) }, dtcgish);
const tokens = fc.dictionary(tokenName, fc.record({ $value }), { maxKeys: 3 }).map((g) => ({ $type: 'color', ...g }));
const group = fc.dictionary(fc.constantFrom('color', 'dimension', '$type'), fc.oneof({ weight: 4, arbitrary: tokens }, dtcgish), { maxKeys: 2 });
const layer = fc.record({ primitives: fc.oneof(group, dtcgish), modes: fc.oneof(fc.dictionary(valueName, group, { maxKeys: 3 }), dtcgish) }, { requiredKeys: [] });
const axesExt = fc.record({
  axes: fc.oneof(
    {
      weight: 3,
      arbitrary: fc.dictionary(axisName, fc.oneof(
        { weight: 4, arbitrary: fc.record({ default: valueName, values: fc.dictionary(valueName, fc.constantFrom({}, { scheme: 'dark' }), { minKeys: 1, maxKeys: 3 }) }) },
        { weight: 1, arbitrary: fc.oneof(dtcgish, fc.record({ default: fc.oneof(valueName, dtcgish), values: fc.oneof(fc.dictionary(valueName, dtcgish, { maxKeys: 3 }), dtcgish) }, { requiredKeys: [] })) },
      ), { maxKeys: 3 }),
    },
    { weight: 1, arbitrary: dtcgish },
  ),
  varies: fc.oneof({ weight: 3, arbitrary: fc.dictionary(tokenName, fc.oneof({ weight: 4, arbitrary: fc.array(axisName, { maxLength: 2 }) }, dtcgish), { maxKeys: 3 }) }, dtcgish),
  overrides: fc.oneof(fc.dictionary(fc.constantFrom('density=roomy', 'mode=light', 'constructor=by', ''), fc.oneof(layer, dtcgish), { maxKeys: 2 }), dtcgish),
}, { requiredKeys: ['axes'] });

const docArb: fc.Arbitrary<DtcgDocument> = fc.record({
  name: fc.oneof({ weight: 4, arbitrary: fc.constant('fuzz') }, dtcgish),
  defaultMode: fc.oneof(fc.constantFrom('dark', 'light', undefined), dtcgish),
  extends: fc.constant(null),
  primitives: fc.oneof(group, dtcgish),
  modes: fc.oneof(fc.dictionary(valueName, group, { maxKeys: 3 }), dtcgish),
  $extensions: fc.oneof(dtcgish, { weight: 3, arbitrary: axesExt.map((ext) => ({ 'com.weasel.axes': ext })) }, fc.record({ 'com.weasel.axes': fc.oneof({ weight: 3, arbitrary: axesExt }, dtcgish), 'com.weasel.ramps': dtcgish, 'com.weasel.tints': dtcgish }, { requiredKeys: [] })),
}, { requiredKeys: [] }) as fc.Arbitrary<DtcgDocument>;

/** A document that names itself and has groups and an axes extension shaped roughly right, so most of it loads. */
const structuredDoc: fc.Arbitrary<DtcgDocument> = fc.record({
  name: fc.constant('fuzz'),
  primitives: group,
  modes: fc.dictionary(valueName, group, { maxKeys: 3 }),
  $extensions: fc.record({
    axes: fc.dictionary(axisName, fc.record({ default: valueName, values: fc.dictionary(valueName, fc.constantFrom({}, { scheme: 'dark' }), { minKeys: 1, maxKeys: 3 }) }), { maxKeys: 3 }),
    varies: fc.dictionary(tokenName, fc.array(axisName, { maxLength: 2 }), { maxKeys: 3 }),
    overrides: fc.dictionary(fc.constantFrom('density=roomy', 'mode=light', 'constructor=by', 'by=dark'), fc.record({ primitives: group, modes: fc.dictionary(valueName, group, { maxKeys: 3 }) }), { maxKeys: 2 }),
  }).map((ext) => ({ 'com.weasel.axes': ext })),
}) as fc.Arbitrary<DtcgDocument>;

/** A failure a caller can read: an `Error` saying what is wrong with the document, never a JavaScript fault. */
function expectDocumentedError(e: unknown): void {
  expect(e).toBeInstanceOf(Error);
  expect(e).not.toBeInstanceOf(TypeError);
  expect(e).not.toBeInstanceOf(RangeError);
}

describe('loadDTCG fuzzed', () => {
  it.each([
    ['any JSON', docArb, ['refused', 'loaded', 'resolved']],
    ['a roughly well-formed document', structuredDoc, ['loaded with axes', 'resolved']],
  ] as const)('%s loads or is refused with an error, and what loads resolves or is refused likewise', (_, arb, guards) => {
    const t = tally();
    fc.assert(fc.property(arb, (raw) => {
      const doc = JSON.parse(JSON.stringify(raw ?? {})) as DtcgDocument;
      let theme;
      try {
        theme = loadDTCG({ ...doc, extends: null });
      } catch (e) {
        t.count('refused');
        expectDocumentedError(e);
        return;
      }
      t.count('loaded');
      if (Object.keys(theme.axes).some((a) => a !== 'mode')) t.count('loaded with axes');
      for (const sel of enumerateSelections(themeAxes(theme)).slice(0, 8)) {
        try {
          resolveTheme(theme, sel);
          t.count('resolved');
        } catch (e) {
          t.count('unresolved');
          expectDocumentedError(e);
        }
      }
    }), runs(RUNS));
    for (const g of guards) t.atLeast(g, 30);
  }, timeoutFor(RUNS, 10));

  it('flattenTokens reads any JSON or refuses it with an error', () => {
    fc.assert(fc.property(dtcgish, (raw) => {
      const doc: unknown = JSON.parse(JSON.stringify(raw ?? null));
      try {
        flattenTokens(typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>) : {});
      } catch (e) {
        expectDocumentedError(e);
      }
    }), runs(RUNS));
  });
});
