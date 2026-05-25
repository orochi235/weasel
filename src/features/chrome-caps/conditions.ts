import type { Condition, ChromeCtx } from './types';
import type { ModifierState } from '../../interactions/gestures/types';

/**
 * Wrap a plain predicate as a fluent {@link Condition}. The returned
 * value is still callable (`cond(fn)(ctx)` works); the fluent methods
 * (`and` / `or` / `andNot` / `orNot`) are attached for chain
 * composition.
 *
 * **Chain semantics: strict left-to-right.** No boolean precedence.
 * `focused.or(hovering).and(selectionIs(1))` evaluates
 * `((focused || hovering) && selectionIs(1))` — NOT
 * `(focused || (hovering && selectionIs(1)))` as standard precedence
 * would give. For grouped disjunction, use the top-level
 * {@link or}/{@link and}/{@link not} helpers or name intermediates.
 *
 * Use {@link when} for the inline-lambda escape hatch (it's an alias).
 */
export function cond(fn: (ctx: ChromeCtx) => boolean): Condition {
  const c = fn as Condition;
  c.and    = (other) => cond((ctx) => fn(ctx) && other(ctx));
  c.or     = (other) => cond((ctx) => fn(ctx) || other(ctx));
  c.andNot = (other) => cond((ctx) => fn(ctx) && !other(ctx));
  c.orNot  = (other) => cond((ctx) => fn(ctx) || !other(ctx));
  return c;
}

/** Inline-lambda escape hatch. Identical to {@link cond}; named for
 *  readability at call sites: `andNot(when(ctx => ...))`. */
export const when = cond;

// ─── Variadic helpers (for grouped expressions) ─────────────────────

/** `(a && b && c && ...)` — useful when chain mixing makes left-to-right
 *  semantics ambiguous. */
export function and(...cs: Condition[]): Condition {
  return cond((ctx) => cs.every((c) => c(ctx)));
}

/** `(a || b || c || ...)` — preferred over `.or` chains when mixed with
 *  `.and` to make grouping explicit. */
export function or(...cs: Condition[]): Condition {
  return cond((ctx) => cs.some((c) => c(ctx)));
}

/** `!c` — top-level negation. Most rules use `.andNot()` / `.orNot()`
 *  instead; this is for the lead-with-negation case. */
export function not(c: Condition): Condition {
  return cond((ctx) => !c(ctx));
}

// ─── Constant atoms ─────────────────────────────────────────────────

/** Always true. The fallback for any chrome id without a registered rule. */
export const always: Condition = cond(() => true);

/** Always false. Useful for "turn this chrome off entirely":
 *  `chromeVisibility={{ 'snap.guides': never }}`. */
export const never: Condition = cond(() => false);

// ─── Focus / action atoms ───────────────────────────────────────────

/** Canvas surface currently focused (`useCanvasFocus().getFocused()`). */
export const focused: Condition = cond((c) => c.focused);

/** Any action currently in flight (read: user is gesturing). */
export const gesturing: Condition = cond((c) => c.action.kind !== null);

/** Active action's kind matches `kind` (e.g. `actionIs('move')`,
 *  `actionIs('marquee')`). */
export const actionIs = (kind: string): Condition =>
  cond((c) => c.action.kind === kind);

// ─── Selection atoms ────────────────────────────────────────────────

/** Nothing selected. */
export const selectionEmpty: Condition = cond((c) => c.selection.length === 0);

/** Exactly `n` items selected. */
export const selectionIs = (n: number): Condition =>
  cond((c) => c.selection.length === n);

/** At least `n` items selected. `selectionAtLeast(1)` is the common
 *  "something is selected" check. */
export const selectionAtLeast = (n: number): Condition =>
  cond((c) => c.selection.length >= n);

/** Multi-mode handle behavior active (single shared union-bounds
 *  handle vs per-item handles). */
export const multiActive: Condition = cond((c) => c.multiActive);

// ─── Hover / suppression atoms ──────────────────────────────────────

/** Pointer is hovering some node. */
export const hovering: Condition = cond((c) => c.hover !== null);

/** Pointer is hovering a node that is currently selected. */
export const hoveringSelected: Condition = cond(
  (c) => c.hover !== null && c.selection.includes(c.hover),
);

/** Id is in the suppressed-ids set (the consumer-supplied "hide
 *  this chrome for this id" filter — used by path-edit to hide the
 *  selection outline of the path being edited). */
export const suppressed = (id: string): Condition =>
  cond((c) => c.suppressedIds.has(id));

// ─── Modifier atoms ─────────────────────────────────────────────────

/** Named modifier key currently held. */
export const modifierHeld = (m: keyof ModifierState): Condition =>
  cond((c) => c.modifiers[m]);

// ─── View atoms ─────────────────────────────────────────────────────

/** View scale (uniform or geometric mean for non-uniform) is at least
 *  `z`. Useful for "hide hairline chrome at low zoom" rules. */
export const zoomAtLeast = (z: number): Condition =>
  cond((c) => {
    const sx = c.view.scale.x;
    const sy = c.view.scale.y;
    const s = sx === sy ? sx : Math.sqrt(sx * sy);
    return s >= z;
  });
