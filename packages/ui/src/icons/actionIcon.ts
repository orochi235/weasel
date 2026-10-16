import type { ReactNode } from 'react';

/** An action's icon as declared: a node, or a thunk drawing one on demand. */
export type ActionIconSource = ReactNode | (() => ReactNode);

/** The node to draw for an action's declared icon. */
export function actionIcon(icon: ActionIconSource): ReactNode {
  return typeof icon === 'function' ? icon() : icon;
}
