/**
 * @experimental
 * The `Action` descriptor, split along the line the dispatcher reads.
 * `ActionDispatch` is everything routing consults to decide whether an action
 * runs and what happens when it does; `ActionPresentation` is what a palette,
 * menu or toolbar renders. `Action` is both.
 */
import type { ReactNode } from 'react';
import type { CursorSpec } from '@weasel-js/cursor';
import type { ActionDeps, Invoker } from './invoker';
import type { BindingSource } from './binding';
import type { DepName } from './depSchema';

/**
 * @experimental
 * Closed enum of reasons an action might report itself as disabled. The
 * consumer (palette, menu, etc.) maps these symbolic values to display
 * strings via its own label map.
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

/**
 * @experimental
 * What a palette, menu or toolbar renders for an action. No part of this is
 * read during dispatch.
 */
export interface ActionPresentation {
  label: string;
  /** Inline-SVG icon for palette / toolbar surfaces. Mirrors
   *  `ToolPresentation.icon` so a generic `<ActionBar>` can render from
   *  action metadata the same way `<ToolPalette>` renders from tool
   *  metadata. May be a static `ReactNode` or a function (rare; useful
   *  for state-aware icons like a "lock" toggle). */
  icon?: ReactNode | (() => ReactNode);
  /** Grouping key for palette/menu surfaces. Free-form string; the kit
   *  ships defaults for `'align'` (six edges/centers), `'distribute'`
   *  (two axes), and recommends `'pathfinder'` for boolean ops. */
  group?: string;
  /** Display override for the keyboard shortcut. When omitted, palette
   *  surfaces derive a label from `defaultBinding` via their own
   *  formatter. */
  shortcut?: string;
}

/**
 * @experimental
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
   * @experimental
   * Optional predicate the command palette consults when rendering. Return
   * `true` when the action is currently triggerable. Return a reason string
   * (e.g. `'Selection required'`) when disabled — the palette greys out
   * the row, skips it in keyboard nav, ignores clicks, and shows the
   * reason next to the label. Keystroke dispatch (the registered binding)
   * is unaffected; the action's own `run` should self-guard.
   *
   * **Contract:** must be pure (no side effects), fast (< 4ms in dev), and
   * must not throw. If a call throws or exceeds the budget in dev mode,
   * `evaluateEnabled` logs a one-time warning per action id; throws are
   * caught and treated as disabled with reason `'(predicate threw)'`.
   *
   * Snapshot-on-open semantics: the palette evaluates `enabled` once when
   * opened and does NOT re-evaluate on selection changes while open. Live
   * reactive updates are deferred — palette is short-lived.
   *
   * The reason set is a closed enum — to add a new reason, edit
   * `ActionDisabledReason` and the consumer's display map.
   *
   * The optional `deps` argument is the same bag passed to
   * `ImmediateInvoker.run`; callers (`evaluateEnabled` / the ActionBar) may
   * synthesize it from the surrounding `DepRegistry` so predicates can
   * inspect selection / scene / etc. Predicates that don't need deps just
   * ignore the arg.
   */
  enabled?: (deps?: ActionDeps) => true | ActionDisabledReason;
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
    | import('../../features/chrome-caps').Rule
    | import('../../features/chrome-caps').Condition;
  /**
   * CSS cursor shown while the pointer hovers a spot where this action
   * would win the drag. The hover-cursor pump (in `useGestureDispatcher`)
   * runs `Dispatcher.resolveOnly` on each idle pointermove — the same
   * match walk a real pointerdown takes — and applies the winning
   * action's `cursor`, so the hint and the actual click target stay in
   * sync by construction. Omitted = no override (the active tool's
   * `Tool.cursor` shows). Affordance hits are resolved earlier in the
   * pump via `AffordanceRegion.cursor` and never reach this field.
   *
   * Static value only. Prediction runs `enabled()` but cannot run the
   * invoker, so an action that matches yet bails at `start()` (empty
   * handle) may still show its cursor — keep `enabled` accurate for
   * actions that declare one.
   */
  cursor?: CursorSpec;
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
   *
   * This is where mid-gesture cursors live now. They used to come from the
   * tool side — `ViewportToolDef.engaged.cursor` for a phase-gated string,
   * or a function-form `Tool.cursor` reading the gesture scratch out of the
   * tool-routing dispatcher. Both belonged to a pipeline whose whole job was
   * being taken over by bindings, and neither could describe a cursor for an
   * action a tool doesn't own.
   */
  activeCursor?: CursorSpec;
}

/**
 * @experimental
 * Single registered action. v1: one binding per action.
 */
export interface Action extends ActionDispatch, ActionPresentation {}
