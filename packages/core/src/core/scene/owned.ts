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

/**
 * A copy of an owned value for a snapshot: its plain objects, arrays and typed
 * arrays copied, so the snapshot is the caller's to edit and nothing written to
 * the scene's values afterward reaches it. Class instances are shared.
 */
export function detach<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) return new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)) as T;
    return (value as unknown as Uint8Array).slice() as T;
  }
  if (Array.isArray(value)) return value.map(detach) as T;
  if (!isPlain(value)) return value;
  // `fromEntries` defines keys, so an own `__proto__` stays a key rather than setting the prototype.
  const out = Object.fromEntries(Object.keys(value).map((k) => [k, detach((value as Record<string, unknown>)[k])]));
  if (Object.getPrototypeOf(value) === null) Object.setPrototypeOf(out, null);
  return out as T;
}

function isPlain(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function freezePlain(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  if (Array.isArray(value)) {
    Object.freeze(value);
    for (const item of value) freezePlain(item);
    return;
  }
  if (!isPlain(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value)) freezePlain((value as Record<string, unknown>)[key]);
}

const sharedSnapshots = new WeakMap<object, () => unknown>();

/** Pairs a scene's `toJSON` with the snapshot {@link sharedJSON} reads in its place. */
export function registerSharedJSON(toJSON: () => unknown, read: () => unknown): void {
  sharedSnapshots.set(toJSON, read);
}

/**
 * `scene.toJSON()` with the scene's own pose and `data` values in place of
 * copies, for kit code that diffs snapshots by identity each frame and never
 * writes to them. A scene whose `toJSON` is not the kit's falls back to it.
 */
export function sharedJSON<S extends { toJSON(): unknown }>(scene: S): ReturnType<S['toJSON']> {
  const read = sharedSnapshots.get(scene.toJSON);
  return (read ? read() : scene.toJSON()) as ReturnType<S['toJSON']>;
}
