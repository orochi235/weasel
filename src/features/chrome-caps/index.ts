/**
 * chrome-caps — declarative overlay-chrome visibility.
 *
 * Stable ids name each user-visible chrome element; composable
 * {@link Condition}s decide when each shows. A single rules table
 * gates both paint and hit-test so visible-is-hittable falls out by
 * construction.
 *
 * See `docs/superpowers/specs/2026-05-24-chrome-caps-design.md`.
 */
export type {
  ChromeCtx,
  ChromeId,
  Condition,
  VisibilityRules,
} from './types';

export {
  cond,
  when,
  and,
  or,
  not,
  always,
  never,
  focused,
  gesturing,
  actionIs,
  selectionEmpty,
  selectionIs,
  selectionAtLeast,
  multiActive,
  hovering,
  hoveringSelected,
  suppressed,
  modifierHeld,
  zoomAtLeast,
} from './conditions';

export { defaultVisibilityRules } from './defaults';
export { resolveVisibility } from './resolve';
export { buildChromeCtx, type BuildChromeCtxArgs } from './buildChromeCtx';
export { useHoverTracking, type UseHoverTrackingArgs } from './useHoverTracking';
