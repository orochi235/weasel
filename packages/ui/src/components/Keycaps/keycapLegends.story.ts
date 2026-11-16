import { keyLegendFromKey, keyLegendsFromMods, type LegendStyle, type LogicalMod, type Platform } from '@weasel-js/gestures';
import { getOwn } from '@weasel-js/registry';
import type { KeyLegend } from './Keycaps';

const MOD_BY_GLYPH: Readonly<Record<string, LogicalMod | undefined>> = {
  '⌘': 'mod', '⇧': 'shift', '⌥': 'alt', '⌃': 'ctrl', '⇪': 'meta',
};
const NAMED_BY_GLYPH: Readonly<Record<string, string | undefined>> = {
  '⎋': 'Escape', '↵': 'Enter', '⇥': 'Tab', '␣': 'Space', '⌫': 'Backspace', '⌦': 'Delete',
};

/** The keycap stories' labels: a macOS modifier or named-key glyph spelled for `platform` and `legend`, through
 *  `keyLegendsFromMods` and `keyLegendFromKey`; any other label as it is. */
export function relabel(label: string, platform: Platform, legend: LegendStyle): string {
  const mod = getOwn(MOD_BY_GLYPH, label);
  if (mod) return keyLegendsFromMods([{ name: mod }], { platform, legend })[0]!.label;
  const named = getOwn(NAMED_BY_GLYPH, label);
  if (named) return keyLegendFromKey(named, { platform, legend }).label;
  return label;
}

/** {@link relabel} over every key of a sequence. */
export function relabelKeys(keys: readonly KeyLegend[] | undefined, platform: Platform, legend: LegendStyle): KeyLegend[] | undefined {
  return keys?.map((k) => ({ ...k, label: relabel(k.label, platform, legend) }));
}
