/**
 * Property tests of the JSON helpers: `isJsonSafe` says true exactly when a JSON round trip gives the value back
 * unchanged (`undefined` object fields aside), `parse` never throws and reads back what `JSON.stringify` wrote,
 * and the URL fragment encoding round-trips any string and refuses any fragment with `null`, never a throw.
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { isJsonSafe, parse } from './json';
import { cloneValue, jsonValue, runs, same, tally, timeoutFor } from './pbt.fixture';
import { decodeUrlHash, encodeUrlHash } from './urlHash';

const RUNS = 500;

/** `s` with each lone surrogate as U+FFFD, as `String.prototype.toWellFormed` writes it. */
const wellFormed = (s: string): string => [...s].map((c) => (c.length === 1 && c >= '\ud800' && c <= '\udfff' ? '\ufffd' : c)).join('');

/** `value` with every object field holding `undefined` removed, as JSON drops them. */
function withoutUndefinedFields(value: unknown): unknown {
  if (Array.isArray(value) || value === null || typeof value !== 'object') return value;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== null && Object.getPrototypeOf(proto) !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== undefined) Object.defineProperty(out, k, { value: withoutUndefinedFields(v), enumerable: true, writable: true, configurable: true });
  return out;
}

/** Arrays JSON reshapes: holes, and extra keys beside the indices. */
const oddArray = fc.tuple(fc.array(jsonValue, { minLength: 1, maxLength: 4 }), fc.nat(), fc.boolean(), fc.boolean()).map(([xs, at, hole, extra]) => {
  const a: unknown[] = [...xs];
  if (hole) delete a[at % a.length];
  if (extra) (a as unknown as Record<string, unknown>).note = 1;
  return a;
});

const anyValue = fc.oneof(
  { weight: 3, arbitrary: jsonValue },
  { weight: 3, arbitrary: cloneValue },
  { weight: 1, arbitrary: oddArray },
  { weight: 1, arbitrary: fc.constantFrom(Object.create(null), new (class Point { x = 1 })(), { a: undefined }, structuredClone({ realm: 'node' }), structuredClone([1, { b: 2 }])) },
);

describe('isJsonSafe', () => {
  it('is true exactly when JSON gives the value back unchanged', () => {
    const t = tally();
    fc.assert(fc.property(anyValue, (v) => {
      let back: unknown;
      try { back = JSON.parse(JSON.stringify(v) ?? 'undefined'); } catch { back = Symbol('unwritable'); }
      const kept = same(back, withoutUndefinedFields(v));
      expect(isJsonSafe(v)).toBe(kept);
      t.count(kept ? 'safe' : 'unsafe');
    }), runs(RUNS));
    t.atLeast('safe', RUNS / 4);
    t.atLeast('unsafe', RUNS / 8);
  }, timeoutFor(RUNS, 3));
});

describe('parse', () => {
  it('reads back what JSON.stringify wrote, and any other text as itself', () => {
    fc.assert(fc.property(jsonValue, (v) => {
      expect(same(parse(JSON.stringify(v)), v)).toBe(true);
    }), runs(RUNS));
    fc.assert(fc.property(fc.string(), (raw) => {
      let want: unknown;
      try { want = JSON.parse(raw); } catch { want = raw; }
      expect(same(parse(raw), want)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});

describe('URL fragment encoding', () => {
  it('round-trips any well-formed string', () => {
    fc.assert(fc.property(fc.string({ unit: 'grapheme' }), (s) => {
      const encoded = encodeUrlHash(s);
      expect(encoded).toMatch(/^[A-Za-z0-9+/=]*$/);
      expect(decodeUrlHash(encoded)).toBe(s === '' ? null : s);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));

  it('writes a lone surrogate as U+FFFD with a warning, rather than throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const surrogate = fc.integer({ min: 0xd800, max: 0xdfff }).map((c) => String.fromCharCode(c));
    const withSurrogates = fc.array(fc.oneof(surrogate, fc.string({ maxLength: 2 })), { minLength: 1, maxLength: 6 }).map((a) => a.join(''));
    fc.assert(fc.property(withSurrogates, (s) => {
      expect(decodeUrlHash(encodeUrlHash(s))).toBe(wellFormed(s) || null);
    }), runs(RUNS));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  }, timeoutFor(RUNS, 3));

  it('answers a string or null for any fragment, never throwing', () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.base64String(), fc.string({ unit: 'binary' }), fc.constantFrom('JUQ4MDA=', '%', 'JQ==')), (hash) => {
      const got = decodeUrlHash(hash);
      expect(got === null || typeof got === 'string').toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});

describe('shrunk counterexamples', () => {
  it('a plain object from another realm is JSON-safe', () => {
    expect(isJsonSafe(structuredClone({ x: 1 }))).toBe(true);
  });

  it('an array whose hole is made up for by an extra key is not', () => {
    const a: unknown[] = [, 1];
    (a as unknown as Record<string, unknown>).note = 1;
    expect(isJsonSafe(a)).toBe(false);
  });

  it('a lone surrogate encodes as U+FFFD instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(decodeUrlHash(encodeUrlHash('\ud800'))).toBe('�');
    warn.mockRestore();
  });
});
