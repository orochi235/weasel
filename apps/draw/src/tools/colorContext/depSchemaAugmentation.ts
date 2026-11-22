/**
 * Declares the `color` and `colorPaint` deps the color actions read. `colorContribution`
 * publishes its live source.
 */
import '@weasel-js/routing';
import type { ColorContextValue } from './ColorContextProvider';
import type { PaintSelection } from '../../usePaintSelection';

declare module '@weasel-js/routing' {
  interface DepSchema {
    color?: ColorContextValue;
    /** Paints the selection with the active paints a color key just set. */
    colorPaint?: PaintSelection;
  }
}

export {};

// An augmentation that stops merging still compiles — TS just declares a fresh
// interface and nothing names the loss. This says the key really landed.
const _merged: import('@weasel-js/core').DepName = 'color';
void _merged;
