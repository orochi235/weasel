import { prefSectionLeaves } from './helpers';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import { prefVariantOf, type PrefUnion } from './union';
import type { PrefBoolean, PrefEnum, PrefLeaf, PrefNumber, PrefObject } from './schema';

/** Decides what a stored value reads as for one kind of leaf: the value to
 *  read, or `undefined` for "invalid, read the default". */
export type PrefValidator = (stored: unknown, leaf: PrefLeaf) => unknown;

/** What `stored` reads as for `leaf`. Never writes anything back: a schema
 *  rolled back finds the original still in storage. */
export function repairPrefValue(
  leaf: PrefLeaf,
  stored: unknown,
  validators?: Readonly<Record<string, PrefValidator>>,
): unknown {
  if (leaf.kind === 'number') {
    if (stored === 'Infinity') stored = Infinity;
    else if (stored === '-Infinity') stored = -Infinity;
  }
  const validate = validators?.[leaf.kind];
  if (validate) {
    try {
      const out = validate(stored, leaf);
      return out === undefined ? leaf.default : out;
    } catch {
      return leaf.default;
    }
  }
  switch (leaf.kind) {
    case 'number':
      return repairNumber(leaf as PrefNumber, stored);
    case 'boolean':
      return (leaf as PrefBoolean).encoding || typeof stored === 'boolean' ? stored : leaf.default;
    case 'string':
    case 'color':
    case 'field':
      return typeof stored === 'string' ? stored : leaf.default;
    case 'enum': {
      const e = leaf as PrefEnum;
      if (e.encoding) return stored;
      return e.options.some((o) => o.value === stored) ? stored : leaf.default;
    }
    case 'object':
      if (isPlainObject(stored)) return repairFields(leaf as PrefObject, stored as Record<string, unknown>, validators);
      return (leaf as PrefObject).fromScalar ? stored : leaf.default;
    case 'map':
      return repairMap(leaf as PrefMap, stored, validators);
    case 'union': {
      const variant = prefVariantOf(leaf as PrefUnion, stored);
      return variant ? repairFields(variant[1], stored as Record<string, unknown>, validators) : leaf.default;
    }
    case 'list':
      return repairList(leaf as PrefList, stored, validators);
    default:
      return stored;
  }
}

type Validators = Readonly<Record<string, PrefValidator>> | undefined;

/**
 * Each field the object holds reads as its own leaf would. A field it omits
 * stays omitted: absent is a state of its own (no dash, no shadow), and not
 * the field at its default. Fields no leaf describes pass through.
 */
function repairFields(leaf: PrefObject, stored: Record<string, unknown>, validators: Validators): unknown {
  let out: Record<string, unknown> | undefined;
  for (const [key, field] of prefSectionLeaves(leaf.children)) {
    if (!Object.hasOwn(stored, key) || stored[key] === undefined) continue;
    const read = repairPrefValue(field, stored[key], validators);
    if (read !== stored[key]) (out ??= { ...stored })[key] = read;
  }
  return out ?? stored;
}

/** Each value reads as `item` would on its own, under the key it was stored at. */
function repairMap(leaf: PrefMap, stored: unknown, validators: Validators): unknown {
  if (!isPlainObject(stored)) return leaf.default;
  const held = stored as Record<string, unknown>;
  let out: Record<string, unknown> | undefined;
  for (const [key, value] of Object.entries(held)) {
    const read = repairPrefValue(leaf.item, value, validators);
    if (read !== value) (out ??= { ...held })[key] = read;
  }
  return out ?? stored;
}

/** Each entry reads as `item` would on its own, so one bad entry costs that entry and not the list. */
function repairList(
  leaf: PrefList,
  stored: unknown,
  validators?: Readonly<Record<string, PrefValidator>>,
): unknown {
  if (!Array.isArray(stored)) return leaf.default;
  if (leaf.minItems !== undefined && stored.length < leaf.minItems) return leaf.default;
  const kept = leaf.maxItems !== undefined && stored.length > leaf.maxItems ? stored.slice(0, leaf.maxItems) : stored;
  const read = kept.map((entry) => repairPrefValue(leaf.item, entry, validators));
  return kept === stored && read.every((entry, i) => entry === stored[i]) ? stored : read;
}

function isPlainObject(v: unknown): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function repairNumber(leaf: PrefNumber, stored: unknown): unknown {
  if (typeof stored !== 'number' || Number.isNaN(stored)) return leaf.default;
  const { endless } = leaf;
  if (stored === Infinity && (endless === 'max' || endless === 'both')) return stored;
  if (stored === -Infinity && (endless === 'min' || endless === 'both')) return stored;
  let v = stored;
  if (leaf.min !== undefined && v < leaf.min) v = leaf.min;
  if (leaf.max !== undefined && v > leaf.max) v = leaf.max;
  return Number.isFinite(v) ? v : leaf.default;
}
