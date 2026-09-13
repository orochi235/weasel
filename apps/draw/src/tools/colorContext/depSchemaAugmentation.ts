/**
 * WeaselDraw-side DepSchema augmentation — Phase 9 of registry unification.
 *
 * Declares `color: ColorContextValue` so the three color action descriptors
 * (`color.reset`, `color.swap`, `color.toggleFocusedNone`) can consume color
 * state via the dep registry at dispatch time.
 *
 * The `<ColorDepBridge>` component (in App.tsx) registers the live source:
 *   useDepSource('color', () => colorContext)
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
