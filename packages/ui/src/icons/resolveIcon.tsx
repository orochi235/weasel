import type { ReactNode } from 'react';
import type { IconRef } from '@weasel-js/icons';
import { Icon } from './Icon';
import { iconFromData } from './iconFromData';

/** A ref, or a string read from data, as a glyph. A bare or malformed string draws nothing, and warns in development. */
export function resolveIcon(source: IconRef | string | undefined, size = 14): ReactNode {
  const ref = iconFromData(source);
  return ref ? <Icon name={ref} size={size} /> : undefined;
}
