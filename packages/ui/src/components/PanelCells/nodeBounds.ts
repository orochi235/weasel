import { getOwn, setOwn, isPlainObject } from '@weasel-js/registry';
import {
  isPrefLeaf, prefClampNumber, prefNumberAt, prefSectionLeaves,
  type PrefLeaf, type PrefNumber, type PrefObject, type PrefSection,
} from '@weasel-js/prefs';
import type { PanelRecord } from './model';

/** `leaf` as it bounds `record`: a number leaf's `minAt` and `maxAt` read against the record's own values. */
export function leafAt(leaf: PrefLeaf, record: PanelRecord): PrefLeaf {
  return leaf.kind === 'number' ? prefNumberAt(leaf as PrefNumber, (path) => record.valueAt(path)) : leaf;
}

/**
 * What a write of `value` stores into `record` at `leaf`: a number held to that
 * record's bounds, and an object with each field the write changed from `held`
 * held to its own.
 */
export function boundAt(leaf: PrefLeaf, record: PanelRecord, value: unknown, held?: unknown): unknown {
  if (leaf.kind === 'object') return objectAt(leaf as PrefObject, record, value, held);
  return typeof value === 'number' && leaf.kind === 'number' ? prefClampNumber(leafAt(leaf, record) as PrefNumber, value) : value;
}

function objectAt(leaf: PrefObject, record: PanelRecord, value: unknown, held: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const before = isPlainObject(held) ? held : undefined;
  let out: Record<string, unknown> = value;
  for (const [key, field] of prefSectionLeaves(leaf.children)) {
    const given = getOwn(value, key);
    const was = before === undefined ? undefined : getOwn(before, key);
    if (before !== undefined && given === was) continue;
    const bound = boundAt(field, record, given, was);
    if (bound === given) continue;
    if (out === value) out = { ...value };
    setOwn(out, key, bound);
  }
  return out;
}

/** `children` with each leaf replaced by what `fn` makes of it, sections kept; the same object when none changed. */
function mapFields(children: PrefObject['children'], fn: (leaf: PrefLeaf) => PrefLeaf): PrefObject['children'] {
  let out: PrefObject['children'] | undefined;
  for (const [key, child] of Object.entries(children)) {
    const next = isPrefLeaf(child) ? fn(child) : mapSection(child, fn);
    if (next === child) continue;
    out ??= { ...children };
    setOwn(out, key, next);
  }
  return out ?? children;
}

function mapSection(section: PrefSection, fn: (leaf: PrefLeaf) => PrefLeaf): PrefSection {
  const members = mapFields(section.members, fn);
  return members === section.members ? section : { ...section, members };
}

/**
 * `leaf` as one control over `records` draws it: each record's own bounds, and
 * across several the loosest of them, so a value one record may take is not
 * refused for another's sake. Each write is then held to its record's own. An
 * object leaf has its fields drawn so.
 */
export function leafAcross(leaf: PrefLeaf, records: readonly PanelRecord[]): PrefLeaf {
  if (leaf.kind === 'object') {
    const object = leaf as PrefObject;
    const children = mapFields(object.children, (field) => leafAcross(field, records));
    return children === object.children ? leaf : ({ ...object, children } as PrefLeaf);
  }
  if (leaf.kind !== 'number') return leaf;
  const { minAt, maxAt } = leaf as PrefNumber;
  if ((minAt === undefined && maxAt === undefined) || records.length === 0) return leaf;
  const each = records.map((record) => leafAt(leaf, record) as PrefNumber);
  const loosest = (pick: (n: PrefNumber) => number | undefined, by: (...xs: number[]) => number): number | undefined => {
    const bounds = each.map(pick);
    return bounds.some((b) => b === undefined) ? undefined : by(...(bounds as number[]));
  };
  const { minAt: _min, maxAt: _max, min: _lo, max: _hi, ...rest } = leaf as PrefNumber;
  const min = loosest((n) => n.min, Math.min);
  const max = loosest((n) => n.max, Math.max);
  return { ...rest, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) } as PrefLeaf;
}
