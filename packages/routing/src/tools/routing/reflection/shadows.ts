import type { Contribution } from '../../../contributions/types';
import type { Conflict } from './conflicts';
import { argKeysOf, chordArgsOf, modifierTieKeys, phasesTie, PLATFORMS, targetKey, typesMeet, type Platform } from './conflictKeys';
import { buildRouteRegistry, type RegistryEntry } from './registry';

/**
 * How `action`, a hotkey-tier entry, shadows `lower`, an entry of a lower tier: the first of the
 * action's bindings that takes a press one of `lower`'s also matches, which then fires only when the
 * action declines. Tier ranks before specificity, so any press both match counts, whatever either
 * binding's target, modifiers or rank. `undefined` when no press meets both.
 */
export function shadowOf(action: Contribution<unknown>, lower: Contribution<unknown>): Conflict | undefined {
  const below = buildRouteRegistry([lower]).filter((r) => r.gesture !== 'hover');
  for (const a of buildRouteRegistry([action])) {
    // A binding that yields is ordered ahead of the one it yields to on purpose.
    if (a.gesture === 'hover' || a.yields) continue;
    if (!below.some((b) => bothMatch(a, b))) continue;
    const { phase, gesture, arg, target, modifiers } = a;
    return { phase, gesture, arg, target, modifiers, ownerIds: [action.id, lower.id], shadows: true };
  }
  return undefined;
}

function bothMatch(a: RegistryEntry, b: RegistryEntry): boolean {
  return a.gesture === b.gesture && targetsMeet(a, b) && viewsMeet(a.views, b.views)
    && typesMeet(a, b) && phasesTie(a, b) && PLATFORMS.some((p) => pressesMeet(a, b, p));
}

const WILD = '*';

/** An untargeted binding matches on every target; two named ones only on the same one. */
function targetsMeet(a: RegistryEntry, b: RegistryEntry): boolean {
  const ta = targetKey(a);
  const tb = targetKey(b);
  return ta === '' || tb === '' || ta === WILD || tb === WILD || ta === tb;
}

function viewsMeet(a: readonly (string | null)[] | undefined, b: readonly (string | null)[] | undefined): boolean {
  return a === undefined || b === undefined || a.some((v) => b.includes(v));
}

/** Each arg and modifier state a binding takes a press in on `platform`, with no regard to rank. */
function pressesOf(e: RegistryEntry, platform: Platform): { arg: string; held: string }[] {
  const held = (chord: boolean): string[] => modifierTieKeys(e, platform, chord).map((k) => k.slice(0, k.lastIndexOf(':')));
  return [
    ...argKeysOf(e).flatMap((arg) => held(false).map((h) => ({ arg, held: h }))),
    ...chordArgsOf(e).flatMap((arg) => held(true).map((h) => ({ arg, held: h }))),
  ];
}

function pressesMeet(a: RegistryEntry, b: RegistryEntry, platform: Platform): boolean {
  const theirs = pressesOf(b, platform);
  return pressesOf(a, platform).some((x) => theirs.some((y) =>
    x.held === y.held && (x.arg === y.arg || x.arg === WILD || y.arg === WILD)));
}
