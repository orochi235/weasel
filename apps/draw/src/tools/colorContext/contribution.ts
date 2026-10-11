import type { Contribution } from '@weasel-js/core';
import { colorActions } from './actions';
import type { ColorContextValue } from './ColorContextProvider';

/** The color keys (D, X, Shift+X, /) and the `color` dep their actions read,
 *  as one entry for `<SceneCanvas ambient>`. `read` returns the live context. */
export function colorContribution(read: () => ColorContextValue): Contribution {
  return {
    id: 'draw.color',
    eligibility: { always: true },
    actions: colorActions,
    deps: { color: read },
  };
}
