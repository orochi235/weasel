import { KeySequence } from './Keycaps';
import { keySpecsFromLegend } from './keySpecsFromLegend';

/**
 * A shortcut already written out (`⇧⌘Z`, `Space`) as a list of actions shows it: outlined keycaps in the color
 * of the text around them, lettered in the UI font.
 */
export function ShortcutKeys({ legend, className }: { legend: string; className?: string }) {
  return <KeySequence keys={keySpecsFromLegend(legend)} joins="none" variant="minimal" font="var(--wzl-font-ui)" className={className} />;
}
