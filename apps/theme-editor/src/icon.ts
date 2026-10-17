import { scopedIcon } from '@weasel-js/icons';

/** The theme editor draws no glyphs of its own, so every name it writes is qualified: `icon('core:undo')`. */
export const icon = scopedIcon<never>('theme-editor');
