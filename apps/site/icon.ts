import { scopedIcon } from '@weasel-js/icons';

/** The site draws no glyphs of its own, so every name it writes is qualified: `icon('core:select')`. */
export const icon = scopedIcon<never>('site');
