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

/** A typed array as JSON holds it: its type's tag and its numbers, each non-finite one and `-0` by name,
 *  since JSON writes those as `null` and `0`. */
export interface TaggedTypedArray {
  __ta: TypedArrayTag;
  data: (number | 'NaN' | 'Infinity' | '-Infinity' | '-0')[];
}

const written = (n: number): TaggedTypedArray['data'][number] =>
  Object.is(n, -0) ? '-0' : Number.isFinite(n) ? n : (String(n) as 'NaN');

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
  if (typeof tag !== 'string' || !Object.hasOwn(TYPED_ARRAY_CONSTRUCTORS, tag) || !Array.isArray(data)) return undefined;
  return TYPED_ARRAY_CONSTRUCTORS[tag].from(data.map(Number));
}

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

/** Whether the reader would take the plain value for something the writer wrote: a tagged array or a wrapper. */
const misread = (value: unknown): boolean => isPlain(value) && (isRawWrapper(value) || untagTypedArray(value) !== undefined);

/** A copy of an array or a plain object, `each` applied to what it holds; anything else as it is. */
function within(value: unknown, each: (v: unknown) => unknown): unknown {
  if (Array.isArray(value)) return value.map(each);
  if (!isPlain(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const v = each(value[key]);
    // Assigned, an own `__proto__` as `JSON.parse` makes would set the copy's prototype instead.
    if (key === '__proto__') Object.defineProperty(out, key, { value: v, enumerable: true, writable: true, configurable: true });
    else out[key] = v;
  }
  return out;
}

/**
 * A copy of `value` that `JSON.stringify` writes whole: every typed array in it, at any
 * depth of arrays and plain objects, becomes a `TaggedTypedArray`. A `Path` goes through it
 * to be saved, and `reviveTypedArrays` reads it back. A plain object `reviveTypedArrays`
 * would take for one of those, or for a `{ "__raw": … }` wrapper, is written inside such a
 * wrapper, which the reader takes off and reads nothing into.
 */
export function tagTypedArrays(value: unknown): unknown {
  const tagged = tagTypedArray(value);
  if (tagged) return tagged;
  const copy = within(value, tagTypedArrays);
  return misread(value) ? { [RAW]: copy } : copy;
}

/** A copy of `value` with every `TaggedTypedArray` in it a typed array again, and every
 *  `{ "__raw": … }` wrapper taken off: what `JSON.parse` answered for something
 *  `tagTypedArrays` or `typedArrayReplacer` wrote. */
export function reviveTypedArrays(value: unknown): unknown {
  if (isRawWrapper(value)) return within(value.__raw, reviveTypedArrays);
  return untagTypedArray(value) ?? within(value, reviveTypedArrays);
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
    // Any object JSON writes with its own keys reads back as a plain one, a class instance's included.
    const misreadAsWritten = !Array.isArray(value) && (onlyRawKey(value) || untagTypedArray(value) !== undefined);
    if (!misreadAsWritten && !alsoWrap?.(key, value)) return value;
    const wrapper = { [RAW]: value };
    wrappers.add(wrapper);
    return wrapper;
  };
}

/** `tagTypedArrays` as a `JSON.stringify` replacer. */
export const typedArrayReplacer: (this: unknown, key: string, value: unknown) => unknown = typedArrayReplacerWrapping();
