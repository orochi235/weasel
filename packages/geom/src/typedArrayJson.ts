import { hasOwnKey } from '@weasel-js/registry';

/** The constructor of each typed array of numbers, under the tag its type is written by. */
export const TYPED_ARRAY_CONSTRUCTORS = {
  i8: Int8Array,
  u8: Uint8Array,
  u8c: Uint8ClampedArray,
  i16: Int16Array,
  u16: Uint16Array,
  i32: Int32Array,
  u32: Uint32Array,
  f32: Float32Array,
  f64: Float64Array,
} as const;

/** The name a typed array's type is written under. */
export type TypedArrayTag = keyof typeof TYPED_ARRAY_CONSTRUCTORS;

/** A typed array of numbers: what a `Path` keeps its commands and coords in. */
export type NumberTypedArray = InstanceType<(typeof TYPED_ARRAY_CONSTRUCTORS)[TypedArrayTag]>;

/** A number JSON cannot write, by the name it is written under instead: `JSON.stringify` writes a non-finite
 *  number as `null` and `-0` as `0`. */
export type NumberName = 'NaN' | 'Infinity' | '-Infinity' | '-0';

/** The name `n` is written under where JSON cannot write it, else `undefined`. */
export const numberName = (n: number): NumberName | undefined =>
  Object.is(n, -0) ? '-0' : Number.isFinite(n) ? undefined : (String(n) as NumberName);

/** The number a {@link NumberName} names, or `undefined` for anything else. */
export const namedNumber = (v: unknown): number | undefined =>
  v === 'NaN' || v === 'Infinity' || v === '-Infinity' || v === '-0' ? Number(v) : undefined;

/** A typed array as JSON holds it: its type's tag and its numbers, each one JSON cannot write by its name. */
export interface TaggedTypedArray {
  __ta: TypedArrayTag;
  data: (number | NumberName)[];
}

const written = (n: number): TaggedTypedArray['data'][number] => numberName(n) ?? n;

const TAGS = new Map<string, TypedArrayTag>(
  (Object.keys(TYPED_ARRAY_CONSTRUCTORS) as TypedArrayTag[]).map((tag) => [TYPED_ARRAY_CONSTRUCTORS[tag].name, tag]),
);

// By its string tag rather than `instanceof`, which is false for an array made in another realm.
const classOf = (value: unknown): string => Object.prototype.toString.call(value).slice(8, -1);

/** `value` as a tag and its numbers where it is a typed array of numbers, else `undefined`. */
export function tagTypedArray(value: unknown): TaggedTypedArray | undefined {
  if (!ArrayBuffer.isView(value)) return undefined;
  const tag = TAGS.get(classOf(value));
  return tag && { __ta: tag, data: Array.from(value as NumberTypedArray, written) };
}

/** The typed array a `TaggedTypedArray` describes, or `undefined` for anything else. */
export function untagTypedArray(value: unknown): NumberTypedArray | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const { __ta: tag, data } = value as Partial<TaggedTypedArray>;
  if (typeof tag !== 'string' || !hasOwnKey(TYPED_ARRAY_CONSTRUCTORS, tag) || !Array.isArray(data)) return undefined;
  return TYPED_ARRAY_CONSTRUCTORS[tag].from(data.map(entryNumber));
}

/** A tagged array's entry as a number: an object, which no writer puts there, is `NaN` rather than coerced, since
 *  coercing one runs whatever `valueOf` and `toString` it holds and throws when neither is a function. */
const entryNumber = (v: unknown): number =>
  namedNumber(v) ?? (v !== null && typeof v === 'object' ? Number.NaN : Number(v));

const isPlain = (value: unknown): value is Record<string, unknown> => classOf(value) === 'Object';

const RAW = '__raw';

/** A value of the writer's caller that its reader would take for something the writer wrote, as written:
 *  the reader takes the wrapper off and reads nothing into what it holds. */
export interface RawWrapper {
  __raw: unknown;
}

/** Whether `value` is a `{ "__raw": … }` wrapper: a plain object with that one own key. */
export function isRawWrapper(value: unknown): value is RawWrapper {
  return isPlain(value) && onlyRawKey(value);
}

const onlyRawKey = (value: object): boolean => {
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === RAW;
};

/** Whether the reader would take a non-array object, written with its own keys, for something the writer wrote: a
 *  tagged array or a wrapper. Any object JSON writes with its own keys reads back as a plain one, a class instance's
 *  included. */
const misreadAsWritten = (value: object): boolean => onlyRawKey(value) || untagTypedArray(value) !== undefined;

/** A copy of an array or a plain object, `each` applied to what it holds with its key; anything else as it is. */
function within(value: unknown, each: (v: unknown, key: string) => unknown): unknown {
  if (Array.isArray(value)) return value.map((v, i) => each(v, String(i)));
  if (!isPlain(value)) return value;
  return ownCopy(value, each);
}

/** A plain object of `value`'s own enumerable keys, `each` applied to what each holds. */
function ownCopy(value: object, each: (v: unknown, key: string) => unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const v = each((value as Record<string, unknown>)[key], key);
    // Assigned, an own `__proto__` as `JSON.parse` makes would set the copy's prototype instead.
    if (key === '__proto__') Object.defineProperty(out, key, { value: v, enumerable: true, writable: true, configurable: true });
    else out[key] = v;
  }
  return out;
}

/**
 * A copy of `value` that `JSON.stringify` writes whole: every typed array in it, at any
 * depth of arrays and objects, becomes a `TaggedTypedArray`. A `Path` goes through it
 * to be saved, and `reviveTypedArrays` reads it back. A plain object `reviveTypedArrays`
 * would take for one of those, or for a `{ "__raw": … }` wrapper, is written inside such a
 * wrapper, which the reader takes off and reads nothing into. Any other object is copied as
 * `JSON.stringify` writes it, as `typedArrayReplacer` sees it: what its `toJSON` answers, or else
 * a plain object of its own keys, so a class instance is tagged and wrapped as a plain one is.
 */
export function tagTypedArrays(value: unknown): unknown {
  return tagAt(value, '');
}

function tagAt(value: unknown, key: string): unknown {
  const tagged = tagTypedArray(value);
  if (tagged) return tagged;
  if (value === null || typeof value !== 'object') return value;
  const toJSON = (value as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === 'function') return tagAt(toJSON.call(value, key), key);
  if (Array.isArray(value)) return within(value, tagAt);
  const copy = ownCopy(value, tagAt);
  return misreadAsWritten(value) ? { [RAW]: copy } : copy;
}

/** A copy of `value` with every `TaggedTypedArray` in it a typed array again, and every
 *  `{ "__raw": … }` wrapper taken off: what `JSON.parse` answered for something
 *  `tagTypedArrays` or `typedArrayReplacer` wrote. */
export function reviveTypedArrays(value: unknown): unknown {
  if (isRawWrapper(value)) return within(value.__raw, (v) => reviveTypedArrays(v));
  return untagTypedArray(value) ?? within(value, (v) => reviveTypedArrays(v));
}

/**
 * A `JSON.stringify` replacer that tags typed arrays, and writes inside a `{ "__raw": … }` wrapper any
 * plain object `reviveTypedArrays` would take for a tagged array or a wrapper, and any object `alsoWrap`
 * names: what a reader with more shapes of its own (an older save's) would misread.
 */
export function typedArrayReplacerWrapping(
  alsoWrap?: (key: string, value: object) => boolean,
): (this: unknown, key: string, value: unknown) => unknown {
  const wrappers = new WeakSet<object>();
  return function replace(this: unknown, key: string, value: unknown): unknown {
    const tagged = tagTypedArray(value);
    if (tagged) return tagged;
    if (value === null || typeof value !== 'object' || wrappers.has(this as object)) return value;
    const misread = !Array.isArray(value) && misreadAsWritten(value);
    if (!misread && !alsoWrap?.(key, value)) return value;
    const wrapper = { [RAW]: value };
    wrappers.add(wrapper);
    return wrapper;
  };
}

/** `tagTypedArrays` as a `JSON.stringify` replacer. */
export const typedArrayReplacer: (this: unknown, key: string, value: unknown) => unknown = typedArrayReplacerWrapping();
