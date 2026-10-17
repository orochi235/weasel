import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { BadgeStatus } from './types';

/** The glyph for each status. `custom` has none: its color is the call site's. */
export const BADGE_STATUS_ICONS: Readonly<Record<Exclude<BadgeStatus, 'custom'>, IconRef>> = {
  accent: icon('statusAccent'),
  neutral: icon('statusNeutral'),
  muted: icon('statusMuted'),
  info: icon('info'),
  success: icon('statusSuccess'),
  warn: icon('warning'),
  danger: icon('error'),
};
