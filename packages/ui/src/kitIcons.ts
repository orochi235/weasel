import { icons as coreIcons } from '@weasel-js/core/icons';
import type { IconTable } from '@weasel-js/icons';
import { icons as uiIcons } from './icons.table';

/** Core's and ui's icon tables, whole: for a registry that should hold every kit glyph, such as a workshop's or a test's. */
export const kitIcons: readonly IconTable[] = [coreIcons, uiIcons];
