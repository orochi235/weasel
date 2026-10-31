/**
 * The `Action` descriptor, split along the line the dispatcher reads.
 * `ActionDispatch` is everything routing consults to decide whether an action
 * runs and what happens when it does; `ActionPresentation` is what a palette,
 * menu or toolbar renders. `Action` is both.
 */
import type { ModifierRoles } from './modifierRoles';
import type { IconRef } from '@weasel-js/icons';
import type { CursorSpec } from '@weasel-js/cursor';
import type { ActionDeps, Invoker } from './invoker';
import type { ActionSettings } from './actionSettings';
import type { PrefGroup } from '@weasel-js/prefs';
import type { BindingSource } from './binding';
import type { DepName } from '../../index';
import type { IngestItem } from '@weasel-js/gestures';

/** What content being routed brings to `Action.enabled`: a drop's or a
 *  paste's items, or a carry's payload with no items. */
export interface Carried {
  items: readonly IngestItem[];
  carry?: { type: string; value: unknown };
}

/**
 * The kit's symbolic reasons an action might report itself as disabled. The
 * consumer (palette, menu, etc.) maps these to display strings via its own
 * label map. An action may also answer with any other string, which is
 * display text and shown as is — see {@link ActionUnavailable}.
 */
export const ActionDisabledReason = {
  SelectionRequired: 'selection-required',
  SceneEmpty: 'scene-empty',
  NotApplicable: 'not-applicable',
  /** Sentinel: the predicate threw. Surfaced by `evaluateEnabled`'s catch. */
  PredicateThrew: 'predicate-threw',
} as const;
/** Why an action is unavailable right now. */
export type ActionDisabledReason =
  (typeof ActionDisabledReason)[keyof typeof ActionDisabledReason];

/** What `enabled` answers with when the action cannot run: one of the
 *  symbolic {@link ActionDisabledReason}s, or a sentence to show as it is. */
export type ActionUnavailable = ActionDisabledReason | (string & {});

/**
 * What a palette, menu or toolbar renders for an action. No part of this is
 * read during dispatch.
 */
export interface ActionPresentation {
  label: string;
  /** The action's icon, by qualified name: `icon('group')` in the package that draws it. */
  icon?: IconRef;
  /** Grouping key for palette/menu surfaces. Free-form string; the kit
   *  ships defaults for `'align'` (six edges/centers), `'distribute'`
   *  (two axes), and recommends `'pathfinder'` for boolean ops. */
  group?: string;
  /** Words the action is also found by and gathered under. Where `group` is
   *  the one place an action sits, an action carries any number of tags: a
   *  palette search matches them as it matches the label, and
   *  `actionsTagged` / `taggedActionItems` gather every action or entry
   *  carrying one, for a bar or a menu built from a tag. */
  tags?: readonly string[];
  /** Display override for the keyboard shortcut. When omitted, palette
   *  surfaces derive a label from `defaultBinding` via their own
   *  formatter. */
  shortcut?: string;
  /** The distinct things a parametric action does, one per set of params —
   *  `flip` flips horizontally or vertically, `reorder.forward` moves one step
   *  or all the way. A bar, menu or palette shows one entry per variant and
   *  triggers the action with that variant's `params`. Omitted = the action
   *  is one entry. See `actionItems`. */
  variants?: readonly ActionVariant[];
  /** A form of the settings the action changes on the selection. A surface
   *  draws the action as that form instead of a bare trigger, and each change
   *  triggers it with the params `settings.params` makes. Not combined with
   *  `variants`. */
  settings?: ActionSettings;
  /** The params `invoker.run` reads, as a form: one leaf per param, keyed by its name, with its label, range,
   *  step, and default. An immediate run that commits one history entry is kept as the tree's last operation,
   *  which a panel draws as this form so the params can be changed after the fact. `ActionParamSchema` stays
   *  what types a tuning; this is what a person sees. */
  params?: PrefGroup;
}

/**
 * One entry a parametric action contributes to a bar, menu or palette.
 */
export interface ActionVariant {
  /** Unique within the action; joined to its id to make the entry's key. */
  key: string;
  label: string;
  /** Falls back to the action's own `icon`. */
  icon?: IconRef;
  /** Tags this variant carries besides its action's, which it carries too. */
  tags?: readonly string[];
  /** Passed to `trigger`, and matched against each binding's
   *  `opts.params` to find the variant's shortcuts. */
  params: Readonly<Record<string, unknown>>;
}

/**
 * What routing consults: the bindings that reach the action, the deps its
 * invoker reads, the gates it passes, and the cursors it claims.
 */
export interface ActionDispatch extends BindingSource {
  /** Names of the deps this action's invoker reads (keys of `DepSchema`).
   *  The dispatcher (and `trigger`, when `requires` is present) resolves
   *  each name against the `DepRegistry` at invocation time and passes the
   *  resulting bag to the invoker. Dev builds warn when the invoker reads a
   *  dep it didn't declare here — see `buildDepsFromRequires`. */
  requires?: readonly DepName[];
  /** Pluggable invocation strategy. The gesture dispatcher routes matched
   *  bindings through `invoker.start` / `invoker.run` depending on timing.
   *  All kit-standard descriptors ship one; consumer-supplied actions
   *  without an invoker can still register but won't be triggered. */
  invoker?: Invoker;
  /** When set to `'hotkey'`, this action's `defaultBinding` rides the hotkey
   *  `BindingScope` instead of the ambient scope — meaning it beats any
   *  active-tool binding on the same input shape. Use for tool-switch
   *  shortcuts and global held-key triggers. Default: ambient. */
  scope?: 'hotkey';
  /**
   * Optional predicate saying whether the action can run right now. Return
   * `true` when it can, or an `ActionDisabledReason` or a sentence of display
   * text when it cannot. The
   * command palette greys out a disabled row, skips it in keyboard nav,
   * ignores clicks, and shows the reason next to the label. The dispatcher
   * skips a disabled action too, on a key as on a pointer, and falls through
   * to the next binding that matches. `ActionsRegistry.trigger` asks too, but
   * with no point, so a `run` whose answer depends on `at` should still
   * self-guard.
   *
   * **Contract:** must be pure (no side effects), fast (< 4ms in dev), and
   * must not throw. A throw is caught and treated as disabled with reason
   * `ActionDisabledReason.PredicateThrew`.
   *
   * The palette evaluates `enabled` once when opened and does NOT re-evaluate
   * on selection changes while open.
   *
   * `deps` is the same bag passed to `ImmediateInvoker.run`.
   *
   * `at` is the world point of the event being routed, when it has one — a
   * click, a press, a long-press. An action that only applies somewhere
   * (on a path segment, say) refuses other points here, so the dispatcher
   * falls through to the next binding and hover prediction shows the
   * action's `cursor` only where it would act. `trigger` passes the
   * `world` its params carry, so a menu row is run under the
   * question it was shown enabled for. Palettes and keystrokes pass no
   * point; treat absent as "anywhere".
   *
   * `carried` is what a drop, a paste or a carry being routed brings. For
   * an OS drag still in flight its items hold a MIME and nothing else, since
   * a browser withholds contents until the drop. A carry has no items and
   * hands over its payload whole. An action that takes only some content
   * refuses the rest here, so a drag it would not take is not accepted and a
   * paste it would not take stays the page's.
   */
  enabled?: (
    deps?: ActionDeps,
    at?: { x: number; y: number },
    carried?: Carried,
  ) => true | ActionUnavailable;
  /**
   * Whether the action reads as held down right now: bold on the selected
   * text, snapping switched on. A toolbar button draws it as pressed.
   * Omitted = the action has no pressed state, which is not the same as
   * one that is off. Never read during dispatch.
   *
   * Under the same contract as `enabled`: pure, fast, and it must not
   * throw. `deps` is the bag `enabled` is given.
   */
  active?: (deps?: ActionDeps) => boolean;
  /**
   * Show what running the action now would do, and change nothing: the
   * result an operation would make, drawn over the canvas. A toolbar asks
   * while its button is hovered or focused, through
   * `ActionsRegistry.preview`, and calls what this returns when that ends.
   * Asked only while `enabled` says yes, with the deps and params `run`
   * would get. Omitted = the action has nothing to show.
   */
  preview?: (deps: ActionDeps, params?: Record<string, unknown>) => (() => void) | void;
  /**
   * Declarative eligibility rule, evaluated against the current
   * `RuleCtx` by the dispatcher before invoking `start()`. Omitted =
   * always eligible.
   *
   * Accepts either a fluent `Condition` (callable with `.rule`) or a
   * raw `Rule` tree; the dispatcher normalizes via `.rule` unwrap.
   *
   * Prefer `capability:`-based rules (e.g. `{ capability: 'transforms-selection' }`)
   * over `mode:` rules — capability rules survive new modes being added
   * that allow the same capability.
   */
  eligible?:
    | import('../../eligibility').Rule
    | import('../../eligibility').Condition;
  /**
   * CSS cursor shown while the pointer hovers a spot where this action
   * would win the drag — or, when the drag's winner declares no cursor,
   * the click. The hover-cursor pump runs the same match walk a real press
   * takes, so the hint and the actual target stay in sync. Omitted = no
   * override (the active tool's `Tool.cursor` shows). Affordance hits are
   * resolved earlier in the pump via `AffordanceRegion.cursor` and never
   * reach this field.
   *
   * A function is asked each time with the params the winning binding would
   * start the action with, tunings included, so a cursor can follow them — a
   * brush ring as wide as the brush. Read it through {@link actionCursor}.
   * Prediction runs `enabled()` but cannot run the invoker, so an action that
   * matches yet bails at `start()` (empty handle) may still show its cursor —
   * keep `enabled` accurate for actions that declare one.
   */
  cursor?: CursorSpec | ((params: Record<string, unknown> | undefined) => CursorSpec | undefined);
  /**
   * CSS cursor shown while THIS action's ongoing handle is in flight —
   * grabbing while panning, `move` while dragging a selection, `crosshair`
   * while pulling a marquee.
   *
   * Separate from `cursor` because the two answer different questions:
   * `cursor` is a prediction ("a drag from here would pan"), this is a state
   * ("you are panning"). An action can declare either, both, or neither;
   * with only `cursor` set, the hover hint holds for the duration of the
   * gesture.
   */
  activeCursor?: CursorSpec;
  /**
   * The modifiers an ongoing action reads while it runs, by role: Shift
   * holding a handle's angle, Alt breaking its mirror. The dispatcher resolves
   * each into `InvocationCtx.roles` on the press, every move, and the release,
   * so a binding's `opts.roles` or a tuning's `roles` can move one to another
   * key. Read them with {@link roleReader}. A binding's own `mods` are matched
   * once, at the press; these are read throughout.
   */
  modifierRoles?: ModifierRoles;
}

/**
 * Single registered action.
 */
export interface Action extends ActionDispatch, ActionPresentation {}

/**
 * The whole of an actions registry the dispatcher reads. It walks the list
 * once per event to build its actionId lookup and never mutates it, so the
 * routing side depends on this rather than on `ActionsRegistry`, whose
 * register / mute / trigger surface is the React provider's.
 */
export interface ActionSource {
  list(): readonly Action[];
}

/** `action`'s hover cursor for an invocation given `params`: its `cursor`,
 *  asked when it is a function. */
export function actionCursor(
  action: Pick<Action, 'cursor'> | undefined,
  params?: Record<string, unknown>,
): CursorSpec | undefined {
  const c = action?.cursor;
  return typeof c === 'function' ? c(params) : c;
}
