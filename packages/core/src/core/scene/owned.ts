/** The scene's claim on the poses and data handed to it. */
import { isDev } from '@weasel-js/registry';

const DEV = isDev();

/**
 * Marks `value` as the scene's from here on: a pose or a `data` payload an edit
 * stores. The scene and its history keep the value by reference, so nothing may
 * write into it afterward; a new value goes in through another edit.
 *
 * In development this deep-freezes the value's plain objects and arrays, so a
 * stray write throws where it happens instead of slipping past history and
 * notifications. Class instances and typed arrays are left as they are: a class
 * may mutate itself by design, and a typed array with elements cannot be frozen.
 * A production build does nothing here.
 */
export function own<T>(value: T): T {
  if (DEV) freezePlain(value);
  return value;
}

function freezePlain(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  if (Array.isArray(value)) {
    Object.freeze(value);
    for (const item of value) freezePlain(item);
    return;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return;
  Object.freeze(value);
  for (const key of Object.keys(value)) freezePlain((value as Record<string, unknown>)[key]);
}
