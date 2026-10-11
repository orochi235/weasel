/**
 * Declares the `color` dep the color actions read. `colorContribution`
 * publishes its live source.
 */
import '@weasel-js/core';
import type { ColorContextValue } from './ColorContextProvider';

declare module '@weasel-js/core' {
  interface DepSchema {
    color?: ColorContextValue;
  }
}

export {};

// An augmentation that stops merging still compiles — TS just declares a fresh
// interface and nothing names the loss. This says the key really landed.
const _merged: import('@weasel-js/core').DepName = 'color';
void _merged;
