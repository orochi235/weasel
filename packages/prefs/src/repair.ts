import type { PrefBoolean, PrefEnum, PrefLeaf, PrefNumber } from './schema';

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
    default:
      return stored;
  }
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
