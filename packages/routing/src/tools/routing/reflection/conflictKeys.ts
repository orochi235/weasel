import { CHORD_MODIFIERS, chordCodesFor, matchPhase, type PhaseSpec } from '@weasel-js/gestures';
import type { ParsedModifiers } from '../routeGrammar';
import { VALID_MOD_NAMES } from '../routeGrammar';
import { PREDICATE_TARGET, type RegistryEntry } from './registry';

/** The two ways `mod` resolves: to `meta` on a Mac, to `ctrl` elsewhere. */
export type Platform = 'mac' | 'other';
export const PLATFORMS: readonly Platform[] = ['mac', 'other'];

/** `mods` with `mod` folded into the key it stands for on `platform`. As in
 *  `matchModifiers`, the other key keeps its own field, and where `mod` and
 *  that key's own field disagree the stronger wins. */
function resolveMod(mods: ParsedModifiers, platform: Platform): ParsedModifiers {
  if (mods.mod === undefined) return mods;
  const { mod, ...rest } = mods;
  const key = platform === 'mac' ? 'meta' : 'ctrl';
  return { ...rest, [key]: mod === 'required' || rest[key] === 'required' ? 'required' : 'optional' };
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
export function modifierTieKeys(entry: RegistryEntry, platform: Platform, chordsOnly = false): string[] {
  const mods = resolveMod(entry.modifiers, platform);
  const optional = VALID_MOD_NAMES.filter((k) => mods[k] === 'optional');
  const required = VALID_MOD_NAMES.filter((k) => mods[k] === 'required');
  const keys: string[] = [];
  for (let bits = 0; bits < 1 << optional.length; bits++) {
    const held = [...required, ...optional.filter((_, i) => (bits & (1 << i)) !== 0)].sort();
    if (chordsOnly && !held.some((m) => (CHORD_MODIFIERS as readonly string[]).includes(m))) continue;
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
 *  case-insensitive, so `'h'` and `'H'` are one arg — and each physical key
 *  `code` a key spec names, which fires it whatever key that press types. */
export function argKeysOf(entry: RegistryEntry): readonly string[] {
  const alts = entry.argAlternatives;
  const args = alts && alts.length > 0 ? [...new Set(alts.map((a) => a.toLowerCase()))] : [(entry.arg ?? '').toLowerCase()];
  const code = 'code' in entry.spec ? entry.spec.code : undefined;
  return code === undefined ? args : [...args, ...[code].flat().map((c) => `code:${c}`)];
}

/** The `code` args a key spec meets only as a chord: the physical keys bearing its letters or
 *  digits, which match it when a chord types no Latin character (Ctrl+я is Ctrl+Z). Read with
 *  `modifierTieKeys(…, true)`. */
export function chordArgsOf(entry: RegistryEntry): readonly string[] {
  if (entry.spec.kind !== 'key' && entry.spec.kind !== 'key-held') return [];
  const own = argKeysOf(entry);
  return [...new Set([entry.spec.key].flat().flatMap(chordCodesFor).map((c) => `code:${c}`))].filter((a) => !own.includes(a));
}

const phaseOf = (e: RegistryEntry): PhaseSpec | undefined => ('phase' in e.spec ? e.spec.phase : undefined);

/** Whether two bindings' phases both hold in some engagement state: each
 *  owner engaged or idle on its own, and any channel either one names, or
 *  none of them, engaged as well. */
export function phasesTie(e: RegistryEntry, f: RegistryEntry): boolean {
  const a = phaseOf(e);
  const b = phaseOf(f);
  if (a === undefined || b === undefined) return true;
  const named = [a, b].flatMap((p) => (typeof p === 'string' ? [] : p.map((atom) => atom.channel)))
    .filter((c) => c !== '&' && c !== '*');
  const channels = [...new Set([e.ownerId, f.ownerId, ...named, '\u0000other'])];
  for (let bits = 0; bits < 1 << channels.length; bits++) {
    const engagedChannels = new Set(channels.filter((_, i) => (bits & (1 << i)) !== 0));
    if (matchPhase(a, { selfChannel: e.ownerId, engagedChannels })
      && matchPhase(b, { selfChannel: f.ownerId, engagedChannels })) return true;
  }
  return false;
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
