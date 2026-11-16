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

/** The value of the field `key` in `held`. A dotted key (`'nib.angle'`) names a field of a field. */
export function prefObjectField(held: Record<string, unknown> | undefined, key: string): unknown {
  let cursor: unknown = held;
  for (const step of key.split('.')) {
    if (!isObject(cursor)) return undefined;
    cursor = cursor[step];
  }
  return cursor;
}

/** The object an `object` leaf holds after one of its fields is set: {@link prefObjectBase} with `key` at
 *  `value`, or without the key for `undefined`. A dotted key sets a field of a field, making the objects on
 *  the way, and clearing one drops an object it leaves empty. */
export function prefObjectWithField(pref: PrefObject, held: unknown, key: string, value: unknown): Record<string, unknown> {
  return withField(prefObjectBase(pref, held), key.split('.'), value);
}

function withField(base: Record<string, unknown>, [step, ...rest]: string[], value: unknown): Record<string, unknown> {
  const next = rest.length === 0 ? value : withField(isObject(base[step]) ? base[step] : {}, rest, value);
  const drops = next === undefined || (rest.length > 0 && Object.keys(next as object).length === 0);
  if (!drops) return { ...base, [step]: next };
  const { [step]: _dropped, ...kept } = base;
  return kept;
}
