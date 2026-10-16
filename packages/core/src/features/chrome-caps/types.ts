import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { Rule } from '@weasel-js/routing';
import type { RuleCtx } from '@weasel-js/routing';

export type { Rule };
export type { RuleCtx } from '@weasel-js/routing';

/**
 * Live state read by chrome-visibility {@link Condition}s: the legacy
 * subset of `RuleCtx`, without mode/capability info. The resolver fills
 * in normal mode's defaults for evaluation.
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
 * `Rule` tree at `.rule`; calling it evaluates the tree against ctx.
 *
 * **Chain semantics: strict left-to-right, no precedence.**
 * `a.and(b).or(c)` is `(a && b) || c`; `a.or(b).and(c)` is
 * `(a || b) && c`. For grouped disjunction, name the subexpression or use
 * the top-level `or(...)`.
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
 * gates both paint and hit-test, so toggling a rule cannot leave a
 * visually-present but un-hittable handle (or vice versa).
 *
 * Naming convention by lifecycle:
 *
 *   - `selection.*` — chrome reflecting committed selection state.
 *   - `action.*` — chrome that only exists during an in-flight action.
 *   - `snap.*` — snapping system chrome (guides, target highlights).
 *   - `grid`, `debug.*` — environment chrome.
 *
 * The union is open: consumers can register their own ids.
 */
export type ChromeId =
  | 'selection.outline'
  | 'selection.resize-handles'
  | 'selection.rotation-handle'
  | 'action.marquee'
  | 'action.lasso'
  | 'action.move-ghosts'
  | 'action.insert-preview'
  | 'action.polyline'
  | 'action.brush'
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
