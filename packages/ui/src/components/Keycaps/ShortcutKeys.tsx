import { formatShortcutParts, SHORTCUT_LEADER_SEPARATOR, type ShortcutInput } from '@weasel-js/gestures';
import { KeySequence } from './Keycaps';
import s from './Keycaps.module.css';
import { keySpecsFromLegend } from './keySpecsFromLegend';

/** Props for {@link ShortcutKeys}: a shortcut written out, or one held as data. */
export type ShortcutKeysProps = { className?: string } & (
  | { legend: string; shortcut?: never }
  | { shortcut: ShortcutInput; legend?: never }
);

function partsFromLegend(legend: string) {
  const steps = legend.split(SHORTCUT_LEADER_SEPARATOR);
  return { leader: steps.slice(0, -1).map((label) => ({ label })), keys: keySpecsFromLegend(steps.at(-1)!) };
}

/**
 * A shortcut as a list of actions shows it: outlined keycaps in the color of the text around them, lettered in the
 * UI font at its normal weight, after the keymaps that lead to it (`Loupe ▸ 2`). Takes the shortcut as data, or
 * already written out as `formatShortcut` writes one (`⇧⌘Z`, `Space`, `Loupe ▸ 2`).
 */
export function ShortcutKeys({ legend, shortcut, className }: ShortcutKeysProps) {
  const parts = legend !== undefined ? partsFromLegend(legend) : formatShortcutParts(shortcut);
  return <KeySequence keys={parts?.keys} leader={parts?.leader} joins="none" className={[s.shortcut, className].filter(Boolean).join(' ')} />;
}
