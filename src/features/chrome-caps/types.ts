import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';

/**
 * Live state read by chrome-visibility {@link Condition}s. Built once
 * per frame on the rendering side, passed to the resolver, discarded.
 *
 * Extending this struct is an additive change — new fields can be
 * added without touching existing atoms, but every atom that reads a
 * new field must be added to the conditions library before consumers
 * can use it.
 */
export interface ChromeCtx {
  /** Live focus state of the canvas surface (`useCanvasFocus`). */
  readonly focused: boolean;
  /** Current selection. Same value as `ChromeState.selection`. */
  readonly selection: readonly NodeId[];
  /** True when the selection has been promoted to multi-mode (the
   *  single-shared union-bounds handle behavior). */
  readonly multiActive: boolean;
  /** Ids the consumer has flagged as suppressed (e.g. during
   *  path-edit mode). Predicates can `not(suppressed(id))` to
   *  honor this. */
  readonly suppressedIds: ReadonlySet<string>;
  /** Modifier-key snapshot. */
  readonly modifiers: ModifierState;
  /** Active action, or `{ kind: null, id: null }` when idle. The
   *  `kind` is the in-flight action's stable tag (`'move'`,
   *  `'marquee'`, `'lasso'`, `'resize'`, `'rotate'`, …). */
  readonly action: { readonly kind: string | null; readonly id: string | null };
  /** Last-hovered node id under the pointer, or null when nothing
   *  is hovered (pointer outside the canvas, or over empty space). */
  readonly hover: NodeId | null;
  /** Current viewport transform — needed by view-dependent rules
   *  (e.g. `zoomAtLeast`). */
  readonly view: View;
}

/**
 * Composable visibility predicate. Always callable as `(ctx) =>
 * boolean`; the fluent methods (`and` / `or` / `andNot` / `orNot`)
 * return new conditions wrapping the original.
 *
 * **Chain semantics: strict left-to-right, no precedence.**
 * `a.and(b).or(c)` is `(a && b) || c`; `a.or(b).and(c)` is
 * `(a || b) && c`. Mix `.and` and `.or` only when you mean
 * left-to-right evaluation. For grouped disjunction, name the
 * subexpression or use the top-level `or(...)`.
 */
export interface Condition {
  (ctx: ChromeCtx): boolean;
  /** `this && other` */
  and(other: Condition): Condition;
  /** `this || other` */
  or(other: Condition): Condition;
  /** `this && !other` */
  andNot(other: Condition): Condition;
  /** `this || !other` */
  orNot(other: Condition): Condition;
}

/**
 * Stable identifier for one user-visible chrome element. The same id
 * gates both paint and hit-test — there is no separate
 * `affordance.X` / `selection.X` split — so toggling a rule cannot
 * leave a visually-present but un-hittable handle (or vice versa).
 *
 * Naming convention by lifecycle:
 *
 *   - `selection.*` — chrome reflecting committed selection state
 *     (persists between actions).
 *   - `action.*` — chrome that only exists during an in-flight
 *     action (vanishes on commit / cancel).
 *   - `snap.*` — snapping system chrome (guides, target highlights).
 *   - `grid`, `debug.*` — environment chrome.
 *
 * The intersection `(string & {})` keeps the union open so consumers
 * can register their own ids; the kit's built-ins are listed
 * explicitly for autocomplete.
 */
export type ChromeId =
  | 'selection.outline'
  | 'selection.resize-handles'
  | 'selection.rotation-handle'
  | 'action.marquee'
  | 'action.lasso'
  | 'action.move-ghosts'
  | 'action.insert-preview'
  | 'action.commands'
  | 'snap.guides'
  | 'snap.targets'
  | 'grid'
  | (string & {});

/**
 * Consumer override map. Merged on top of the kit's
 * `defaultVisibilityRules`; absent keys fall through to defaults,
 * absent ids fall through to `always`.
 */
export type VisibilityRules = Partial<Record<ChromeId, Condition>>;
