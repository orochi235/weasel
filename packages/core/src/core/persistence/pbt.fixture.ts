/**
 * fast-check arbitraries for the snapshot codec's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';

/** Keys a document's data can hold: the ones a path's typed arrays sit under, the ones a tagged typed array is
 *  written with, prototype names, and plain ones. */
export const dataKey = fc.constantFrom('commands', 'coords', '__ta', 'data', '__raw', '__proto__', 'constructor', 'toString', 'fill', 'x', '0', '1');

const typed = fc.oneof(
  fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 6 }).map((a) => Uint8Array.from(a)),
  fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { maxLength: 6 }).map((a) => Float32Array.from(a)),
  fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), { maxLength: 4 }).map((a) => Float64Array.from(a)),
  fc.array(fc.integer({ min: -32768, max: 32767 }), { maxLength: 4 }).map((a) => Int16Array.from(a)),
);

const leaf = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }).map((n) => n + 0),
  fc.integer({ min: -300, max: 300 }),
  fc.string({ maxLength: 4 }),
  fc.boolean(),
  fc.constant(null),
  fc.constantFrom('u8', 'f32'),
);

/** An object with own keys, `__proto__` among them as a plain own key, as `JSON.parse` would make it. */
function objectOf(entries: [string, unknown][]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}

/** A value a node's data can hold that JSON can carry, typed arrays anywhere in it. */
export const dataValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof({ depthSize: 'small', withCrossShrink: true }, leaf, typed, tie('array'), tie('object'), tie('lookalike')),
  array: fc.array(tie('value'), { maxLength: 4 }),
  object: fc.uniqueArray(fc.tuple(dataKey, tie('value')), { selector: ([k]) => k, maxLength: 4 }).map(objectOf),
  // Shapes a reader might mistake for something it wrote: a tag, a legacy path array, or a wrapper.
  lookalike: fc.oneof(
    fc.record({ __ta: fc.constantFrom('u8', 'f32', 'f64'), data: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 3 }) }, { noNullPrototype: true }),
    fc.record({ commands: fc.array(fc.integer({ min: 0, max: 300 }), { maxLength: 3 }), coords: fc.array(fc.double({ min: -1, max: 1, noNaN: true }).map((n) => n + 0), { maxLength: 3 }) }, { noNullPrototype: true }),
    fc.record({ coords: fc.array(fc.constant(null), { maxLength: 2 }) }, { noNullPrototype: true }),
    fc.record({ commands: fc.constant({}) }, { noNullPrototype: true }),
    tie('value').map((v) => ({ __raw: v })),
  ),
})).value;

/** `a` and `b` alike to the last bit, but for the sign of a zero, which JSON does not write: typed arrays of one type
 *  and contents, plain objects with the same own keys. */
export function same(a: unknown, b: unknown, at = '$'): string[] {
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    const ok = Object.prototype.toString.call(a) === Object.prototype.toString.call(b)
      && Array.from(a as Float64Array).every((v, i) => Object.is(v + 0, (b as Float64Array)[i]! + 0)) && (a as Float64Array).length === (b as Float64Array).length;
    return ok ? [] : [`${at}: ${String(a)} / ${String(b)}`];
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return [`${at}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`];
    return a.flatMap((v, i) => same(v, b[i], `${at}[${i}]`));
  }
  if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return [`${at}: prototype`];
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.join() !== kb.join()) return [`${at}: keys ${ka} / ${kb}`];
    return ka.flatMap((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`));
  }
  return Object.is(typeof a === 'number' ? a + 0 : a, typeof b === 'number' ? b + 0 : b) ? [] : [`${at}: ${String(a)} / ${String(b)}`];
}
