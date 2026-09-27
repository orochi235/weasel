import type { IconName } from '../../icons/paths';
import type { BadgeStatus } from './types';

/** The glyph for each status. `custom` has none: its color is the call site's. */
export const BADGE_STATUS_ICONS: Readonly<Record<Exclude<BadgeStatus, 'custom'>, IconName>> = {
  accent: 'statusAccent',
  neutral: 'statusNeutral',
  muted: 'statusMuted',
  info: 'info',
  success: 'statusSuccess',
  warn: 'warning',
  danger: 'error',
};
