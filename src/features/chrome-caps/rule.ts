import type { ModifierState } from '../../interactions/gestures/types';
import type { CapabilityTag } from '@weasel-js/modes';
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

// ───────────────────────────────────────────────────────────────────────────
// Evaluator
// ───────────────────────────────────────────────────────────────────────────

function checkSelection(s: NonNullable<Selector['selection']>, ctx: RuleCtx): boolean {
  if (s.empty !== undefined && (ctx.selection.length === 0) !== s.empty) return false;
  if (s.is !== undefined && ctx.selection.length !== s.is) return false;
  if (s.atLeast !== undefined && ctx.selection.length < s.atLeast) return false;
  return true;
}

function checkMode(m: NonNullable<Selector['mode']>, ctx: RuleCtx): boolean {
  if (typeof m === 'string') return ctx.mode === m;
  if ('not' in m) return ctx.mode !== m.not;
  if ('in' in m) return m.in.includes(ctx.mode);
  return false;
}

function checkCapability(c: NonNullable<Selector['capability']>, ctx: RuleCtx): boolean {
  if (typeof c === 'string') return ctx.allowedCapabilities.has(c);
  if (Array.isArray(c)) return c.every((tag) => ctx.allowedCapabilities.has(tag));
  if ('in' in c) return c.in.some((tag) => ctx.allowedCapabilities.has(tag));
  if ('not' in c) return !ctx.allowedCapabilities.has(c.not);
  return false;
}

function evaluateSelector(s: Selector, ctx: RuleCtx): boolean {
  if (s.selection !== undefined && !checkSelection(s.selection, ctx)) return false;
  if (s.mode !== undefined && !checkMode(s.mode, ctx)) return false;
  if (s.capability !== undefined && !checkCapability(s.capability, ctx)) return false;
  if (s.gesturing !== undefined && (ctx.action.kind !== null) !== s.gesturing) return false;
  if (s.actionIs !== undefined && ctx.action.kind !== s.actionIs) return false;
  if (s.modifierHeld !== undefined && !ctx.modifiers[s.modifierHeld]) return false;
  if (s.focused !== undefined && ctx.focused !== s.focused) return false;
  if (s.hovering !== undefined && (ctx.hover !== null) !== s.hovering) return false;
  if (s.hoveringSelected !== undefined) {
    const isHovSel = ctx.hover !== null && ctx.selection.includes(ctx.hover);
    if (isHovSel !== s.hoveringSelected) return false;
  }
  if (s.zoomAtLeast !== undefined) {
    const sx = ctx.view.scale.x, sy = ctx.view.scale.y;
    const z = sx === sy ? sx : Math.sqrt(sx * sy);
    if (z < s.zoomAtLeast) return false;
  }
  return true;
}

export function evaluate(rule: Rule, ctx: RuleCtx): boolean {
  if (isAllRule(rule)) return rule.all.every((r) => evaluate(r, ctx));
  if (isAnyRule(rule)) return rule.any.some((r) => evaluate(r, ctx));
  if (isNotRule(rule)) return !evaluate(rule.not, ctx);
  if (isWhenRule(rule)) return rule.when(ctx);
  return evaluateSelector(rule, ctx);
}
