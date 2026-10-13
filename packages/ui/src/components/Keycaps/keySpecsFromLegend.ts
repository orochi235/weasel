import type { KeySpec } from './Keycaps';
import { MODIFIER_LABELS } from './keySpecsFromMods';

/**
 * A shortcut already written out, as `formatShortcut` writes one (`⇧⌘Z`,
 * `Ctrl+Shift+Z`, `Space`), as `KeySequence` keys: each modifier a key of its
 * own, then the key. For a shortcut held as data, use `keySpecsFromShortcut`.
 */
export function keySpecsFromLegend(legend: string): readonly KeySpec[] {
  // Joined by `+`, as the platforms that spell their modifiers out write one. A lone `+` is a key.
  const spelled = legend.split('+').filter((part) => part !== '');
  if (spelled.length > 1) return spelled.map((label) => ({ label }));
  const keys: KeySpec[] = [];
  const glyphs = [...legend];
  let at = 0;
  while (at < glyphs.length - 1 && MODIFIER_LABELS.has(glyphs[at]!)) keys.push({ label: glyphs[at++]! });
  const key = glyphs.slice(at).join('');
  return key === '' ? keys : [...keys, { label: key }];
}
