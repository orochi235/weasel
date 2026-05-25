import type { ModifierState } from '../../interactions/gestures/types';
import type { CapabilityTag } from '@orochi235/weasel-modes';
import type { RuleCtx } from './ruleCtx';

/**
 * A selector is a conjunction of key/value tests. Multiple keys at the same
 * level AND together. Each key maps to a selector primitive in the evaluator.
 */
export interface Selector {
  selection?: { is?: number; atLeast?: number; empty?: boolean };
  mode?: string | { not: string } | { in: readonly string[] };
  capability?:
    | CapabilityTag
    | readonly CapabilityTag[]
    | { in: readonly CapabilityTag[] }
    | { not: CapabilityTag };
  gesturing?: boolean;
  actionIs?: string;
  modifierHeld?: keyof ModifierState;
  focused?: boolean;
  hovering?: boolean;
  hoveringSelected?: boolean;
  zoomAtLeast?: number;
}

/**
 * Composable visibility/eligibility rule. Trees of `all`/`any`/`not` nodes
 * over `Selector` leaves. `when` is the escape hatch — its closure is
 * opaque to introspection and should be avoided when a declarative form
 * exists. Empty `all` is true; empty `any` is false.
 */
export type Rule =
  | Selector
  | { all: readonly Rule[] }
  | { any: readonly Rule[] }
  | { not: Rule }
  | { when: (ctx: RuleCtx) => boolean };

/** Constant rules. Kept here so they have a single source. */
export const ALWAYS: Rule = { all: [] };
export const NEVER: Rule = { any: [] };

// ───────────────────────────────────────────────────────────────────────────
// Type guards
// ───────────────────────────────────────────────────────────────────────────

export function isAllRule(r: Rule): r is { all: readonly Rule[] } {
  return typeof r === 'object' && r !== null && 'all' in r;
}
export function isAnyRule(r: Rule): r is { any: readonly Rule[] } {
  return typeof r === 'object' && r !== null && 'any' in r;
}
export function isNotRule(r: Rule): r is { not: Rule } {
  return typeof r === 'object' && r !== null && 'not' in r;
}
export function isWhenRule(r: Rule): r is { when: (ctx: RuleCtx) => boolean } {
  return typeof r === 'object' && r !== null && 'when' in r;
}
export function isSelector(r: Rule): r is Selector {
  return !isAllRule(r) && !isAnyRule(r) && !isNotRule(r) && !isWhenRule(r);
}
