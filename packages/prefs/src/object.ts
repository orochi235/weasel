import type { PrefObject } from './schema';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * The object a write to one field of an `object` leaf starts from: `held` itself where it is one. Where it is
 * not, the write has to make a whole object, so it starts from the scalar lifted by the leaf's `fromScalar`, else
 * from the leaf's `default`: one field on its own is a stroke with a width and no paint.
 */
export function prefObjectBase(pref: PrefObject, held: unknown): Record<string, unknown> {
  if (isObject(held)) return held;
  return pref.fromScalar?.(held) ?? (isObject(pref.default) ? pref.default : {});
}

/** The object an `object` leaf holds after one of its fields is set: {@link prefObjectBase} with `key` at
 *  `value`, or without the key for `undefined`. */
export function prefObjectWithField(pref: PrefObject, held: unknown, key: string, value: unknown): Record<string, unknown> {
  const base = prefObjectBase(pref, held);
  if (value !== undefined) return { ...base, [key]: value };
  const { [key]: _dropped, ...rest } = base;
  return rest;
}
