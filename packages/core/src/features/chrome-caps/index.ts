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

export type { Rule, Selector } from './rule';
export type { RuleCtx, BuildRuleCtxArgs } from './ruleCtx';

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
  resizable,
  actionIs,
  selectionEmpty,
  selectionIs,
  selectionAtLeast,
  multiActive,
  hovering,
  hoveringSelected,
  modifierHeld,
  zoomAtLeast,
  modeIs,
  modeIn,
  modeNot,
  capabilityIs,
  capabilityIn,
  capabilityAll,
  capabilityNot,
} from './conditions';

export { evaluate, ALWAYS, NEVER } from './rule';
export { buildRuleCtx } from './ruleCtx';
export { defaultVisibilityRules } from './defaults';
export { resolveVisibility } from './resolve';
export { buildChromeCtx, type BuildChromeCtxArgs } from './buildChromeCtx';
export { useHoverTracking, type UseHoverTrackingArgs } from './useHoverTracking';
