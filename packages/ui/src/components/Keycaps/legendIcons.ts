import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';

/** The icon a symbol legend is drawn as, so it matches its neighbors whatever
 *  font the chip is in. Every symbol the legend tables produce has one. */
export const LEGEND_ICONS: Readonly<Record<string, IconRef>> = {
  '⌘': icon('keyCommand'), '⇧': icon('keyShift'), '⌥': icon('keyOption'), '⌃': icon('keyControl'), '⎈': icon('keyHelm'), '⎇': icon('keyAlt'),
  '⎋': icon('keyEscape'), '↵': icon('keyReturn'), '⏎': icon('keyReturn'), '⇥': icon('keyTab'), '␣': icon('keySpace'),
  '⌫': icon('keyBackspace'), '⌦': icon('keyDelete'), '⟵': icon('keyBackspaceArrow'),
  '↑': icon('keyArrowUp'), '↓': icon('keyArrowDown'), '←': icon('keyArrowLeft'), '→': icon('keyArrowRight'),
  '↖': icon('keyHome'), '↘': icon('keyEnd'), '⇞': icon('keyPageUp'), '⇟': icon('keyPageDown'),
  '⎙': icon('keyPrintScreen'), '⎀': icon('keyInsert'), '⇳': icon('keyScrollLock'), '⎉': icon('keyPause'),
  '⊞': icon('keyWindows'), '▤': icon('keyMenu'),
};

/** An icon legend's side, as a multiple of the legend's type size; `.legendIcon` in `Keycaps.module.css` draws it so. */
export const LEGEND_ICON_SCALE = 1.25;
