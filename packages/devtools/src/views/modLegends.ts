/** How the panel draws a modifier chord, in the one order a route strip and an input line share. */
import type { ModifierKey } from '@weasel-js/core/routing';
import { isApplePlatform, keyLegendsFromMods, modKey, type LogicalModSpec } from '@weasel-js/gestures';
import type { KeyLegend } from '@weasel-js/ui/components/Keycaps';

const MOD_ORDER: readonly ModifierKey[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

/** `mods`' legends in chord order, whatever order they came in. */
export function modLegends(mods: readonly LogicalModSpec[]): readonly KeyLegend[] {
  const rank = (m: LogicalModSpec): number => MOD_ORDER.indexOf(m.name);
  return keyLegendsFromMods([...mods].sort((a, b) => rank(a) - rank(b)));
}

/** The modifiers an input held, with the platform's `mod` key named `mod`, as a route names it. */
export function heldMods(held: Readonly<Record<'shift' | 'alt' | 'ctrl' | 'meta', boolean>>, apple = isApplePlatform()): LogicalModSpec[] {
  const mod = modKey(apple);
  return (['shift', 'alt', 'ctrl', 'meta'] as const).filter((m) => held[m]).map((m) => ({ name: m === mod ? 'mod' : m }));
}
