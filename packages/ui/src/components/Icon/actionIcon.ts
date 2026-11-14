import type { ReactNode } from 'react';
import type { IconSpec } from '@weasel-js/icons';
import { resolveIcon } from './resolveIcon';

/** The node to draw for an action's icon. */
export function actionIcon(icon: IconSpec | undefined, size = 16): ReactNode {
  return resolveIcon(icon, size);
}
