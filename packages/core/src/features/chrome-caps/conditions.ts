import type { Condition } from './types';
import type { Rule } from './rule';
import type { RuleCtx } from './ruleCtx';
import { evaluate, ALWAYS, NEVER } from './rule';
import type { ModifierState } from '../../interactions/gestures/types';

/**
 * Promote a Rule tree to a fluent Condition. The function form evaluates
 * the tree against a RuleCtx; combinator methods produce new Conditions
 * wrapping `all`/`any`/`not` nodes.
 *
 * **Chain semantics: strict left-to-right.** No boolean precedence.
 * `focused.or(hovering).and(selectionIs(1))` evaluates
 * `((focused || hovering) && selectionIs(1))` — NOT
 * `(focused || (hovering && selectionIs(1)))` as standard precedence
 * would give. For grouped disjunction, use the top-level `or` / `and` /
 * `not` helpers or name intermediates.
 *
 * Combinators flatten same-kind nesting on construction so `a.and(b).and(c)`
 * produces `{ all: [a, b, c] }` rather than `{ all: [{ all: [a, b] }, c] }`.
 * Canonical form simplifies downstream introspection.
 *
 * Use {@link when} for the inline-lambda escape hatch.
 */
export function cond(rule: Rule): Condition {
  const fn = (ctx: RuleCtx) => evaluate(rule, ctx);
  const condition = fn as Condition;
  (condition as { rule: Rule }).rule = rule;
  condition.and    = (other) => cond(combineAll(rule, asRule(other)));
  condition.or     = (other) => cond(combineAny(rule, asRule(other)));
  condition.andNot = (other) => cond(combineAll(rule, { not: asRule(other) }));
  condition.orNot  = (other) => cond(combineAny(rule, { not: asRule(other) }));
  return condition;
}

function asRule(value: Condition | Rule): Rule {
  return typeof value === 'function' ? (value as Condition).rule : value;
}

function combineAll(a: Rule, b: Rule): Rule {
  const left = 'all' in a ? a.all : [a];
  const right = 'all' in b ? b.all : [b];
  return { all: [...left, ...right] };
}

function combineAny(a: Rule, b: Rule): Rule {
  const left = 'any' in a ? a.any : [a];
  const right = 'any' in b ? b.any : [b];
  return { any: [...left, ...right] };
}

/** Inline-lambda escape hatch. Wraps the closure as a `when` rule node. */
export function when(fn: (ctx: RuleCtx) => boolean): Condition {
  return cond({ when: fn });
}

// ─── Variadic helpers (for grouped expressions) ─────────────────────

/** `(a && b && c && ...)` — useful when chain mixing makes left-to-right
 *  semantics ambiguous. */
export function and(...cs: (Condition | Rule)[]): Condition {
  return cond({ all: cs.map(asRule) });
}

/** `(a || b || c || ...)` — preferred over `.or` chains when mixed with
 *  `.and` to make grouping explicit. */
export function or(...cs: (Condition | Rule)[]): Condition {
  return cond({ any: cs.map(asRule) });
}

/** `!c` — top-level negation. Most rules use `.andNot()` / `.orNot()`
 *  instead; this is for the lead-with-negation case. */
export function not(c: Condition | Rule): Condition {
  return cond({ not: asRule(c) });
}

// ─── Constant atoms ─────────────────────────────────────────────────

/** Always true. The fallback for any chrome id without a registered rule. */
export const always: Condition = cond(ALWAYS);

/** Always false. Useful for "turn this chrome off entirely":
 *  `chromeVisibility={{ 'snap.guides': never }}`. */
export const never: Condition = cond(NEVER);

// ─── Focus / action atoms ───────────────────────────────────────────

/** Canvas surface currently focused. */
export const focused: Condition = cond({ focused: true });

/** Any action currently in flight (read: user is gesturing). */
export const gesturing: Condition = cond({ gesturing: true });

/** A path is currently in anchor-edit mode. */
export const editingAnchors: Condition = cond({ editingAnchors: true });

/** Current selection is resizable (every selected node passes the consumer's
 *  `selectTool.resize.resizable` predicate). Absent predicate → resizable. */
export const resizable: Condition = cond({ resizable: true });

/** Active action's kind matches `kind` (e.g. `actionIs('move')`). */
export const actionIs = (kind: string): Condition => cond({ actionIs: kind });

// ─── Selection atoms ────────────────────────────────────────────────

/** Nothing selected. */
export const selectionEmpty: Condition = cond({ selection: { empty: true } });

/** Exactly `n` items selected. */
export const selectionIs = (n: number): Condition => cond({ selection: { is: n } });

/** At least `n` items selected. `selectionAtLeast(1)` is the common
 *  "something is selected" check. */
export const selectionAtLeast = (n: number): Condition => cond({ selection: { atLeast: n } });

/** Multi-mode handle behavior active (single shared union-bounds
 *  handle vs per-item handles). Implemented as a `when` because
 *  `multiActive` is a derived single-call read on RuleCtx, not a
 *  selector-table key. Stable; safe to introspect. */
export const multiActive: Condition = cond({ when: (c) => c.multiActive });

// ─── Hover atoms ────────────────────────────────────────────────────

/** Pointer is hovering some node. */
export const hovering: Condition = cond({ hovering: true });

/** Pointer is hovering a node that is currently selected. */
export const hoveringSelected: Condition = cond({ hoveringSelected: true });

// ─── Modifier atoms ─────────────────────────────────────────────────

/** Named modifier key currently held. */
export const modifierHeld = (m: keyof ModifierState): Condition => cond({ modifierHeld: m });

// ─── View atoms ─────────────────────────────────────────────────────

/** View scale (uniform or geometric mean for non-uniform) is at least
 *  `z`. Useful for "hide hairline chrome at low zoom" rules. */
export const zoomAtLeast = (z: number): Condition => cond({ zoomAtLeast: z });

// ─── Mode + capability atoms (new) ─────────────────────────────────

/** Active mode equals `m`. */
export const modeIs = (m: string): Condition => cond({ mode: m });

/** Active mode is one of `modes`. */
export const modeIn = (modes: readonly string[]): Condition => cond({ mode: { in: modes } });

/** Active mode is NOT `m`. */
export const modeNot = (m: string): Condition => cond({ mode: { not: m } });

/** Active mode's `allows` includes capability `cap`. */
export const capabilityIs = (cap: string): Condition => cond({ capability: cap });

/** Active mode's `allows` includes ANY of `caps` (OR). */
export const capabilityIn = (caps: readonly string[]): Condition => cond({ capability: { in: caps } });

/** Active mode's `allows` includes ALL of `caps` (AND). */
export const capabilityAll = (caps: readonly string[]): Condition => cond({ capability: [...caps] });

/** Active mode's `allows` does NOT include capability `cap`. */
export const capabilityNot = (cap: string): Condition => cond({ capability: { not: cap } });

// ─── Device atoms ───────────────────────────────────────────────────

/** Primary pointer is imprecise (touch, most styluses). Absent device
 *  profile → false, so a rule written with this atom is inert on the
 *  mouse-shaped default rather than silently flipping. */
export const coarsePointer: Condition = cond({ coarsePointer: true });

/** Primary pointer can hover. Absent device profile → true. Pair with
 *  `not(...)` to gate chrome that only makes sense with a hovering
 *  pointer: `not(canHover)` is "this device cannot hover". */
export const canHover: Condition = cond({ canHover: true });
