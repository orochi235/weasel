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
  /** Matches `ctx.editingAnchors` — true while a path is in anchor-edit
   *  mode. Absent flag is treated as `false`. */
  editingAnchors?: boolean;
  /** Matches `ctx.selectionResizable`. Absent flag is treated as `true`
   *  (resizable), so `{ resizable: true }` passes for legacy ctx builders
   *  that don't compute it. */
  resizable?: boolean;
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
  if (s.editingAnchors !== undefined && (ctx.editingAnchors ?? false) !== s.editingAnchors) return false;
  if (s.zoomAtLeast !== undefined) {
    const sx = ctx.view.scale.x, sy = ctx.view.scale.y;
    const z = sx === sy ? sx : Math.sqrt(sx * sy);
    if (z < s.zoomAtLeast) return false;
  }
  if (s.resizable !== undefined) {
    // Absent flag === resizable (back-compat for ctx builders that don't
    // compute it). Only an explicit `false` opts a selection out.
    const resizable = ctx.selectionResizable ?? true;
    if (resizable !== s.resizable) return false;
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// Rendering
// ───────────────────────────────────────────────────────────────────────────

/** Deepest nesting `describeRule` will walk before giving up. `Rule` is plain
 *  data and can't be cyclic by construction, so this is only a backstop that
 *  makes termination unconditional — no rule anyone writes gets near it. */
const MAX_RULE_DEPTH = 10;

/**
 * Render a selector's value side. Handles the shapes {@link Selector} allows:
 * primitives, `{ not }` / `{ in }` wrappers, capability arrays (which AND, so
 * they join with `+`), and the multi-field `selection` object.
 */
function describeValue(value: unknown, depth: number): string {
  if (depth > MAX_RULE_DEPTH) return '…';
  if (value === null || typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map((v) => describeValue(v, depth + 1)).join('+');
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === 'not') return `not(${describeValue(obj.not, depth + 1)})`;
  if (keys.length === 1 && keys[0] === 'in') return `in(${describeValue(obj.in, depth + 1)})`;
  return keys.map((k) => `${k}=${describeValue(obj[k], depth + 1)}`).join(',');
}

function describeSelector(s: Selector, depth: number): string {
  const keys = Object.keys(s) as Array<keyof Selector>;
  // An empty selector matches every context — `evaluateSelector` has no test
  // to fail. `*` says that the way a CSS reader expects.
  if (keys.length === 0) return '*';
  return keys.map((k) => `${k}:${describeValue(s[k], depth + 1)}`).join(' & ');
}

function describeAt(rule: Rule, depth: number): string {
  if (depth > MAX_RULE_DEPTH) return '…';
  if (isAllRule(rule)) return `all(${rule.all.map((r) => describeAt(r, depth + 1)).join(', ')})`;
  if (isAnyRule(rule)) return `any(${rule.any.map((r) => describeAt(r, depth + 1)).join(', ')})`;
  if (isNotRule(rule)) return `not(${describeAt(rule.not, depth + 1)})`;
  // `when` is the one arm with nothing to introspect — its predicate is a
  // closure. The function's name is all a reader gets, which is itself an
  // argument for reaching for a declarative selector instead.
  if (isWhenRule(rule)) return `when(${rule.when.name || 'ƒ'})`;
  return describeSelector(rule, depth);
}

/**
 * Render a {@link Rule} as a short human-readable string, for inspectors and
 * diagnostics that need to say WHICH rule decided something.
 *
 * ```
 * { capability: 'edits-page' }               → capability:edits-page
 * { all: [{ mode: 'normal' }, { focused: true }] } → all(mode:normal, focused:true)
 * { not: { selection: { empty: true } } }    → not(selection:empty=true)
 * { when: function hasPath() { … } }         → when(hasPath)
 * ```
 *
 * Never throws and always terminates — unlike `JSON.stringify`, which throws
 * on a cyclic value and renders the `when` arm as a useless `{}`.
 */
export function describeRule(rule: Rule): string {
  return describeAt(rule, 0);
}

export function evaluate(rule: Rule, ctx: RuleCtx): boolean {
  if (isAllRule(rule)) return rule.all.every((r) => evaluate(r, ctx));
  if (isAnyRule(rule)) return rule.any.some((r) => evaluate(r, ctx));
  if (isNotRule(rule)) return !evaluate(rule.not, ctx);
  if (isWhenRule(rule)) return rule.when(ctx);
  return evaluateSelector(rule, ctx);
}
