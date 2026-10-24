import type { IconRef } from '@weasel-js/icons';
import type { Emphasis, Grade } from '@weasel-js/theme';
import { icon } from '../icons.gen';

/** The glyph for each grade. */
export const GRADE_ICONS: Readonly<Record<Grade, IconRef>> = {
  info: icon('info'),
  success: icon('statusSuccess'),
  warn: icon('warning'),
  danger: icon('error'),
};

/** The glyph for each emphasis. */
export const EMPHASIS_ICONS: Readonly<Record<Emphasis, IconRef>> = {
  high: icon('statusAccent'),
  low: icon('statusMuted'),
};
