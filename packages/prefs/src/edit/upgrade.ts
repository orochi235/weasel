import { isPlainObject, setOwn } from '@weasel-js/registry';

/**
 * `stored`, as read back from storage, with every data unit that names its decimal places `precision`, as one
 * saved before 2026-11-17 does, naming them `places` in the same position. A stored schema carries no version, so
 * each object under a `unit` key is read for it.
 */
export function upgradeStored(stored: unknown): unknown {
  if (Array.isArray(stored)) return stored.map(upgradeStored);
  if (!isPlainObject(stored)) return stored;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stored)) setOwn(out, key, key === 'unit' ? upgradeUnit(upgradeStored(value)) : upgradeStored(value));
  return out;
}

function upgradeUnit(unit: unknown): unknown {
  if (!isPlainObject(unit) || !Object.hasOwn(unit, 'precision') || Object.hasOwn(unit, 'places')) return unit;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(unit)) setOwn(out, key === 'precision' ? 'places' : key, value);
  return out;
}
