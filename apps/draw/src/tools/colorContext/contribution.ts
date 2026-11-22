import type { Contribution } from '@weasel-js/core';
import { colorActions } from './actions';
import type { ColorContextValue } from './ColorContextProvider';
import type { PaintSelection } from '../../usePaintSelection';

/** The color keys (D, X, Shift+X, /) and the `color` and `colorPaint` deps their actions read, as one entry for
 *  `<SceneCanvas ambient>`. `read` returns the live context; `paint` paints the selection as a swatch button does. */
export function colorContribution(read: () => ColorContextValue, paint: () => PaintSelection): Contribution {
  return {
    id: 'draw.color',
    eligibility: { always: true },
    actions: colorActions,
    deps: { color: read, colorPaint: paint },
  };
}
