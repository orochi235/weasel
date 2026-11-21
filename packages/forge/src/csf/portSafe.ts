import { isPlainObject } from '@weasel-js/core';
import { setOwn } from '@weasel-js/registry';
import { sameKnob } from '../route/url';

const g = globalThis as Record<string, unknown>;
const CLONED_NAMES = [
  'Date',
  'RegExp',
  'ArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
] as const;
const CLONED_WHOLE = new Set<unknown>(
  CLONED_NAMES.map((name) => (g[name] as { prototype?: object } | undefined)?.prototype).filter(Boolean),
);

/** Own keys a clone keeps: enumerable string keys, plus an array's `length`. */
const hasOnlyClonedKeys = (v: object): boolean =>
  Reflect.ownKeys(v).every(
    (key) =>
      typeof key === 'string' &&
      (Object.prototype.propertyIsEnumerable.call(v, key) || (Array.isArray(v) && key === 'length')),
  );

/** Whether `structuredClone` takes `value`, which a Proxy refuses however plain it reads through its traps. */
const clones = (value: unknown): boolean => {
  try {
    structuredClone(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Whether a MessagePort delivers `value` as the same thing it was. `structuredClone` succeeding is
 * not enough: it copies a class instance's fields onto a plain object and drops its methods.
 */
export function isPortSafe(value: unknown): boolean {
  const seen = new Set<object>();
  const safe = (v: unknown): boolean => {
    if (v === null) return true;
    if (typeof v !== 'object') return typeof v !== 'function' && typeof v !== 'symbol';
    if (seen.has(v)) return true;
    seen.add(v);
    const proto = Object.getPrototypeOf(v);
    if (CLONED_WHOLE.has(proto)) return true;
    if (proto === Map.prototype)
      return hasOnlyClonedKeys(v) && [...(v as Map<unknown, unknown>)].every(([key, member]) => safe(key) && safe(member));
    if (proto === Set.prototype) return hasOnlyClonedKeys(v) && [...(v as Set<unknown>)].every(safe);
    if (proto !== Array.prototype && proto !== Object.prototype && proto !== null) return false;
    return hasOnlyClonedKeys(v) && Object.values(v).every(safe);
  };
  try {
    return safe(value) && clones(value);
  } catch {
    return false;
  }
}

/** A plain object or array whose members can be split: React elements are plain objects, but whole, and so is one
 *  whose members each cross yet which does not, a Proxy. */
const splittable = (v: unknown): v is Record<string, unknown> | unknown[] =>
  (Array.isArray(v) ? Object.getPrototypeOf(v) === Array.prototype : isPlainObject(v) && !('$$typeof' in v)) &&
  hasOnlyClonedKeys(v as object) &&
  !(Object.values(v as object).every(isPortSafe) && !clones(v));

/**
 * The part of `value` a port delivers intact, or null when none of it can cross. A plain object
 * keeps its port-safe fields; an array holds null where a member has no part.
 */
export function portSafePart(value: unknown): { value: unknown } | null {
  const walking = new Set<object>();
  const part = (v: unknown): { value: unknown } | null => {
    if (isPortSafe(v)) return { value: v };
    if (!splittable(v) || walking.has(v)) return null;
    walking.add(v);
    try {
      if (Array.isArray(v)) {
        // Not `?.value ?? null`: an `undefined` member crosses as itself, and only one with no part becomes null.
        return { value: v.map((member) => { const kept = part(member); return kept ? kept.value : null; }) };
      }
      const out: Record<string, unknown> = {};
      for (const [key, member] of Object.entries(v)) {
        const kept = part(member);
        if (kept) setOwn(out, key, kept.value);
      }
      return { value: out };
    } finally {
      walking.delete(v);
    }
  };
  try {
    return part(value);
  } catch {
    return null;
  }
}

/** `sent`, a value that crossed the port as `portSafePart(original)` or an edit of it, with what the part left behind put back. */
export function withUnsent(sent: unknown, original: unknown): unknown {
  if (isPortSafe(original)) return sent;
  if (sent === null && portSafePart(original) === null) return original;
  if (Array.isArray(original) && Array.isArray(sent)) return listWithUnsent(sent, original);
  if (!splittable(original) || Array.isArray(original) || !isPlainObject(sent)) return sent;
  const out: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(original)) {
    // A key whose member has no part was never sent, so the sent value under it is an edit, null included.
    if (Object.hasOwn(sent, key)) setOwn(out, key, portSafePart(member) === null ? sent[key] : withUnsent(sent[key], member));
    else if (portSafePart(member) === null) setOwn(out, key, member);
  }
  for (const [key, member] of Object.entries(sent)) if (!Object.hasOwn(original, key)) setOwn(out, key, member);
  return out;
}

/**
 * Each entry of `sent` with what its own original left behind: the original whose sent part it still equals, or, for
 * an entry equal to none (an edit), the unclaimed one at its index. An entry equal to more than one original, once
 * entries were added or removed, gets nothing back rather than another entry's.
 */
function listWithUnsent(sent: readonly unknown[], original: readonly unknown[]): unknown[] {
  // A member with no part crossed as null.
  const parts = original.map((member) => portSafePart(member)?.value ?? null);
  const kept = sent.length === original.length;
  const used = new Set<number>();
  const pairs = sent.map((member, i) => {
    const matches = parts.flatMap((part, j) => (!used.has(j) && sameKnob(part, member) ? [j] : []));
    if (matches.length === 0) return 'edited' as const;
    const j = kept && matches.includes(i) ? i : matches.length === 1 ? matches[0]! : undefined;
    if (j !== undefined) used.add(j);
    return j;
  });
  return sent.map((member, i) => {
    const pair = pairs[i];
    const j = pair === 'edited' ? (i < original.length && !used.has(i) ? i : undefined) : pair;
    return j === undefined ? member : withUnsent(member, original[j]);
  });
}
