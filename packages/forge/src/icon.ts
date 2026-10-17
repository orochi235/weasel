import { scopedIcon } from '@weasel-js/icons';

/** forge draws no glyphs of its own, so every name it writes is qualified: `icon('ui:more')`. */
export const icon = scopedIcon<never>('forge');
