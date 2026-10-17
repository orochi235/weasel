import { scopedIcon } from '@weasel-js/icons';

/** labkit draws no glyphs of its own, so every name it writes is qualified: `icon('ui:close')`. */
export const icon = scopedIcon<never>('labkit');
