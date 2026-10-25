import type { IconRef } from '@weasel-js/icons';
import type { ColorModePreference } from '@weasel-js/theme';
import { icon } from '../icons.gen';

/** One color mode as a control offers it: its glyph, its name, and what choosing it means where the name alone doesn't say. */
export interface ColorModeEntry {
  value: ColorModePreference;
  glyph: IconRef;
  label: string;
  hint?: string;
}

/** The color modes, in rotation order. */
export const COLOR_MODES: readonly ColorModeEntry[] = [
  { value: 'auto', glyph: icon('modeAuto'), label: 'Auto', hint: 'follow the system' },
  { value: 'light', glyph: icon('modeLight'), label: 'Light' },
  { value: 'dark', glyph: icon('modeDark'), label: 'Dark' },
];
