import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { ICON_PATHS, type IconName } from './paths';

/** Whether the kit's icon set holds a glyph called `name`. */
export function isIconName(name: string | undefined): name is IconName {
  return name !== undefined && Object.hasOwn(ICON_PATHS, name);
}

/** A schema's icon name as a glyph, where the kit's icon set holds it. A leaf's `icon` is any string, so one the
 *  set lacks draws nothing. */
export function namedGlyph(name: string | undefined, size = 14): ReactNode {
  return isIconName(name) ? <Icon name={name} size={size} /> : undefined;
}
