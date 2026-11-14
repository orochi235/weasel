import type { ReactNode } from 'react';
import { iconParts } from '@weasel-js/icons';
import { Icon } from './Icon';
import { iconFromData } from './iconFromData';

/** A spec, or a value read from data, as a glyph with its mark. Anything that is not one draws nothing, and warns in development. */
export function resolveIcon(source: unknown, size = 14): ReactNode {
  const parts = iconParts(iconFromData(source));
  return parts ? <Icon name={parts.name} mark={parts.mark} size={size} /> : undefined;
}
