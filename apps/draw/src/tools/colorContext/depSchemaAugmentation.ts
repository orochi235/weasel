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
import '@orochi235/weasel';
import type { ColorContextValue } from './ColorContextProvider';

declare module '@orochi235/weasel' {
  interface DepSchema {
    color: ColorContextValue;
  }
}

export {};
