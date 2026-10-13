import type { ParsedModifiers } from '../routeGrammar';
import { VALID_MOD_NAMES } from '../routeGrammar';
import { PREDICATE_TARGET, type RegistryEntry } from './registry';

/** The two ways `mod` resolves: to `meta` on a Mac, to `ctrl` elsewhere. */
export type Platform = 'mac' | 'other';
export const PLATFORMS: readonly Platform[] = ['mac', 'other'];

/** `mods` with `mod` replaced by the key it stands for on `platform`. As in
 *  `matchModifiers`, a spec naming `mod` has its own `meta` and `ctrl` ignored. */
function resolveMod(mods: ParsedModifiers, platform: Platform): ParsedModifiers {
  if (mods.mod === undefined) return mods;
  const { mod, meta: _meta, ctrl: _ctrl, ...rest } = mods;
  return { ...rest, [platform === 'mac' ? 'meta' : 'ctrl']: mod };
}

/** Whether every entry fires the same action of the same owner with equal
 *  params, so that which of them wins a tie changes nothing. */
export function sameOutcome(entries: readonly RegistryEntry[]): boolean {
  const first = entries[0];
  return entries.every((e) =>
    e.ownerId === first.ownerId && e.actionId === first.actionId && sameParams(e.params, first.params));
}

function sameParams(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((k) => sameParams((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** One key per way an entry can win a press: each modifier state its spec
 *  accepts, with how many modifiers it requires. Two specs tie only where
 *  they share a state and that count, since the matcher ranks a required
 *  modifier above an optional one. `mod` is read as the key it resolves to on
 *  `platform`, so it meets a `ctrl` or `meta` spelled out beside it. */
export function modifierTieKeys(entry: RegistryEntry, platform: Platform): string[] {
  const mods = resolveMod(entry.modifiers, platform);
  const optional = VALID_MOD_NAMES.filter((k) => mods[k] === 'optional');
  const required = VALID_MOD_NAMES.filter((k) => mods[k] === 'required');
  const keys: string[] = [];
  for (let bits = 0; bits < 1 << optional.length; bits++) {
    const held = [...required, ...optional.filter((_, i) => (bits & (1 << i)) !== 0)].sort();
    keys.push(`${held.join('+')}:${required.length}`);
  }
  return keys;
}

/** Whether two bindings' `views` let them tie in some view. A binding is live
 *  only in the views it names, and there it outranks one that names none
 *  (`preferViewScoped`), so a scoped and an unscoped binding never tie; two
 *  scoped ones tie where their views overlap. */
export function viewsTie(
  a: readonly (string | null)[] | undefined,
  b: readonly (string | null)[] | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.some((v) => b.includes(v));
}

/** Every arg value an entry buckets under, lowercased — `matchKey` is
 *  case-insensitive, so `'h'` and `'H'` are one arg. */
export function argKeysOf(entry: RegistryEntry): readonly string[] {
  const alts = entry.argAlternatives;
  if (alts && alts.length > 0) return [...new Set(alts.map((a) => a.toLowerCase()))];
  return [(entry.arg ?? '').toLowerCase()];
}

/** Bucket key for an entry's target slot. Predicate targets all render as
 *  the same grammar token, so they're keyed by the predicate's identity —
 *  two different functions are two different targets. */
export function targetKey(entry: RegistryEntry): string {
  if (entry.target !== PREDICATE_TARGET) return entry.target ?? '';
  const spec = entry.spec as { target?: unknown };
  const pred = spec.target;
  if (typeof pred !== 'object' || pred === null) return PREDICATE_TARGET;
  return `${PREDICATE_TARGET}#${objectId(pred)}`;
}

const OBJECT_IDS = new WeakMap<object, number>();
let nextObjectId = 0;

/** A stable number for an object, so a bucket key can name it by identity. */
export function objectId(obj: object): number {
  let id = OBJECT_IDS.get(obj);
  if (id === undefined) {
    id = nextObjectId++;
    OBJECT_IDS.set(obj, id);
  }
  return id;
}
