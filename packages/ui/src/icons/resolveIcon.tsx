import type { ReactNode } from 'react';
import { toIconRef, type IconRef } from '@weasel-js/icons';
import { Icon } from './Icon';

/** A ref, or a string read from data, as a glyph. A bare or malformed string draws nothing. */
export function resolveIcon(source: IconRef | string | undefined, size = 14): ReactNode {
  const ref = toIconRef(source);
  return ref ? <Icon name={ref} size={size} /> : undefined;
}
