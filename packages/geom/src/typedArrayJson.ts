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

/** A typed array as JSON holds it: its type's tag and its numbers. */
export interface TaggedTypedArray {
  __ta: TypedArrayTag;
  data: number[];
}

const TAGS = new Map<string, TypedArrayTag>(
  (Object.keys(TYPED_ARRAY_CONSTRUCTORS) as TypedArrayTag[]).map((tag) => [TYPED_ARRAY_CONSTRUCTORS[tag].name, tag]),
);

// By its string tag rather than `instanceof`, which is false for an array made in another realm.
const classOf = (value: unknown): string => Object.prototype.toString.call(value).slice(8, -1);

/** `value` as a tag and its numbers where it is a typed array of numbers, else `undefined`. */
export function tagTypedArray(value: unknown): TaggedTypedArray | undefined {
  if (!ArrayBuffer.isView(value)) return undefined;
  const tag = TAGS.get(classOf(value));
  return tag && { __ta: tag, data: Array.from(value as NumberTypedArray) };
}

/** The typed array a `TaggedTypedArray` describes, or `undefined` for anything else. */
export function untagTypedArray(value: unknown): NumberTypedArray | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const { __ta: tag, data } = value as Partial<TaggedTypedArray>;
  if (typeof tag !== 'string' || !Object.hasOwn(TYPED_ARRAY_CONSTRUCTORS, tag) || !Array.isArray(data)) return undefined;
  return TYPED_ARRAY_CONSTRUCTORS[tag].from(data);
}

const isPlain = (value: unknown): value is Record<string, unknown> => classOf(value) === 'Object';

function mapDeep(value: unknown, leaf: (v: unknown) => unknown): unknown {
  const swapped = leaf(value);
  if (swapped !== undefined) return swapped;
  if (Array.isArray(value)) return value.map((v) => mapDeep(v, leaf));
  if (!isPlain(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = mapDeep(value[key], leaf);
  return out;
}

/**
 * A copy of `value` that `JSON.stringify` writes whole: every typed array in it, at any
 * depth of arrays and plain objects, becomes a `TaggedTypedArray`. A `Path` goes through it
 * to be saved, and `reviveTypedArrays` reads it back.
 */
export function tagTypedArrays(value: unknown): unknown {
  return mapDeep(value, tagTypedArray);
}

/** A copy of `value` with every `TaggedTypedArray` in it a typed array again: what
 *  `JSON.parse` answered for something `tagTypedArrays` or `typedArrayReplacer` wrote. */
export function reviveTypedArrays(value: unknown): unknown {
  return mapDeep(value, untagTypedArray);
}

/** `tagTypedArrays` as a `JSON.stringify` replacer. */
export function typedArrayReplacer(_key: string, value: unknown): unknown {
  return tagTypedArray(value) ?? value;
}
