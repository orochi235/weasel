import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { Rule } from './rule';
import type { RuleCtx } from './ruleCtx';

export type { Rule };
export type { RuleCtx } from './ruleCtx';

/**
 * Live state read by chrome-visibility {@link Condition}s. Backward-compat
 * alias for the legacy ChromeCtx shape — kept for consumers that still
 * import `ChromeCtx`. Subset of `RuleCtx`: legacy ChromeCtx didn't carry
 * mode/capability info. The resolver builds a `RuleCtx` for evaluation;
 * surfaces that still operate in `ChromeCtx` shape supply defaults
 * (mode='normal', empty allowedCapabilities) at the construction site.
 */
export interface ChromeCtx {
  readonly focused: boolean;
  readonly selection: readonly NodeId[];
  readonly multiActive: boolean;
  readonly modifiers: ModifierState;
  readonly action: { readonly kind: string | null; readonly id: string | null };
  readonly hover: NodeId | null;
  readonly view: View;
}

/**
 * Composable visibility predicate with fluent surface. Carries its underlying
 * `Rule` tree at `.rule` so the resolver can introspect / share trees with
 * the affordance pipeline and the dispatcher's eligibility filter.
 *
 * Callable form `cond(ctx)` evaluates the tree against ctx. The fluent
 * methods return new Conditions wrapping new trees.
 *
 * **Chain semantics: strict left-to-right, no precedence.**
 * `a.and(b).or(c)` is `(a && b) || c`; `a.or(b).and(c)` is
 * `(a || b) && c`. Mix `.and` and `.or` only when you mean
 * left-to-right evaluation. For grouped disjunction, name the
 * subexpression or use the top-level `or(...)`.
 */
export interface Condition {
  (ctx: RuleCtx): boolean;
  readonly rule: Rule;
  /** `this && other` */
  and(other: Condition | Rule): Condition;
  /** `this || other` */
  or(other: Condition | Rule): Condition;
  /** `this && !other` */
  andNot(other: Condition | Rule): Condition;
  /** `this || !other` */
  orNot(other: Condition | Rule): Condition;
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
 * absent ids fall through to `always`. Entries may be either fluent
 * `Condition` instances OR raw `Rule` trees — the resolver normalizes.
 */
export type VisibilityRules = Partial<Record<ChromeId, Condition | Rule>>;
