/**
 * The canonical JSON codec for scene snapshots. A snapshot (`scene.toJSON()`, `serializeHistory()`) is in-memory
 * data: a structured clone carries it as it is, typed arrays included. Its encoded form is JSON: each typed array
 * tagged with `@weasel-js/geom`'s encoding, and any value of the consumer's that the decoder would misread written
 * inside a `{ "__raw": … }` wrapper. The two are distinct types, so a decoded snapshot cannot be stored as JSON, nor
 * an encoded one loaded, by mistake.
 */
import { isRawWrapper, typedArrayReplacerWrapping, untagTypedArray } from '@weasel-js/geom';

declare const encodedOf: unique symbol;

/** `T` in its encoded form: plain JSON, which `JSON.stringify` and every storage adapter keep exactly.
 *  {@link decodeSnapshot} turns it back into `T`. */
export type Encoded<T> = { readonly [encodedOf]: T };

/** `T` encoded as JSON text, as {@link stringifySnapshot} writes it. */
export type SnapshotText<T> = string & { readonly [encodedOf]: T };

const isPathKey = (k: string): k is 'commands' | 'coords' => k === 'commands' || k === 'coords';

const isLegacyNumber = (v: unknown): boolean => typeof v === 'number' || v === null;

/** A path's typed array as a save from before typed arrays were tagged wrote it: a plain array of numbers, or an
 *  object of them under the keys `0`, `1`, .... `null` is how JSON wrote a NaN. Anything else is not one. */
function legacyNumbers(v: unknown): number[] | undefined {
  if (Array.isArray(v)) return v.every(isLegacyNumber) ? v.map((n) => Number(n ?? 0)) : undefined;
  if (v === null || typeof v !== 'object') return undefined;
  const src = v as Record<string, unknown>;
  const keys = Object.keys(src);
  if (!keys.every((key, i) => key === String(i) && isLegacyNumber(src[key]))) return undefined;
  return keys.map((key) => Number(src[key] ?? 0));
}

/** The `JSON.stringify` replacer the codec writes with: typed arrays tagged, and any value the decoder would read as
 *  something else (a tagged array, a wrapper, or a path's untagged legacy arrays) wrapped. For a writer that
 *  stringifies a larger value of its own, such as a clipboard payload, with snapshots inside it. */
export const snapshotReplacer: (this: unknown, key: string, value: unknown) => unknown =
  typedArrayReplacerWrapping((key, value) => isPathKey(key) && legacyNumbers(value) !== undefined);

/** `value` encoded as JSON text. */
export function stringifySnapshot<T>(value: T): SnapshotText<T> {
  return (JSON.stringify(value, snapshotReplacer) ?? 'null') as SnapshotText<T>;
}

/** `value` encoded: the JSON value {@link stringifySnapshot} writes, as `JSON.parse` reads it back. */
export function encodeSnapshot<T>(value: T): Encoded<T> {
  return JSON.parse(stringifySnapshot(value)) as Encoded<T>;
}

/** A copy of `value` decoded: every tagged typed array a typed array again, a path's `commands` and `coords` as an
 *  older save wrote them untagged read as typed arrays, and every `{ "__raw": … }` wrapper taken off, what it holds
 *  not read as anything itself but its contents decoded. `value` is left as it is. */
export function decodeSnapshot<T>(value: Encoded<T>): T;
export function decodeSnapshot(value: unknown): unknown;
export function decodeSnapshot(value: unknown): unknown {
  if (isRawWrapper(value)) return decodeWithin(value.__raw);
  return untagTypedArray(value) ?? decodeWithin(value);
}

/** The snapshot `text` encodes. */
export function parseSnapshot<T>(text: SnapshotText<T>): T;
export function parseSnapshot(text: string): unknown;
export function parseSnapshot(text: string): unknown {
  return decodeSnapshot(JSON.parse(text) as unknown);
}

/** A copy of an array or plain object with everything it holds decoded, a path's legacy arrays made typed; anything
 *  else as it is. */
function decodeWithin(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => decodeSnapshot(v));
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return value;
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    const v = src[key];
    const legacy = isPathKey(key) && !ArrayBuffer.isView(v) ? legacyNumbers(v) : undefined;
    const next = legacy ? (key === 'commands' ? Uint8Array.from(legacy) : Float32Array.from(legacy)) : decodeSnapshot(v);
    // Assigned, an own `__proto__` as `JSON.parse` makes would set the copy's prototype instead.
    Object.defineProperty(out, key, { value: next, enumerable: true, writable: true, configurable: true });
  }
  return out;
}
