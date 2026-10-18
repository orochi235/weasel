/**
 * The actions store contract and the `actions` prop that seeds it. The
 * provider that implements this lives in `ActionsProvider.tsx`; nothing here
 * touches React.
 */
import type { GestureSpec, PhaseSpec } from '@weasel-js/gestures';
import type { BoundGesture } from './binding';
import type { Action } from './action';
import type { ActionTuning } from './tuning';
import { RESERVED_ID_NAMES, RESERVED_ID_PREFIXES, type PhaseAtom } from '../../tools/routing/routeGrammar';
import type { Dispatcher, UiOngoingControl } from '../dispatcher/dispatcher';
export type { UiOngoingControl } from '../dispatcher/dispatcher';





/**
 * Partial override or full descriptor passed via `<SceneCanvas actions={...}>`.
 * `null` disables a default at this id.
 */
export type ActionEntry = null | Partial<Action> | Action;

/**
 * Shape of the `actions` prop on `<SceneCanvas>`. `null` disables all defaults.
 */
export type ActionsProp = null | Record<string, ActionEntry>;

/**
 * Imperative API exposed by `useActionsRegistry()`.
 */
export interface ActionsRegistry {
  /** Add an action and return its release. Registrants for one id stack,
   *  newest live, so releasing yours uncovers whoever you displaced. Call it
   *  from an effect and release it in that effect's cleanup — registering from
   *  a render body pushes an entry per render and releases none. */
  register(action: Action): () => void;
  /** Drop every registrant of `id`. This is the "this action should not exist"
   *  door, not a release — for that, call what `register` returned. */
  unregister(id: string): void;
  /** Declare `id` not for this scope: it stays registered wherever it was,
   *  but here — and in scopes below — it lists as absent and neither
   *  `trigger` nor `begin` will fire it. Returns a release. This is the
   *  "not for me" door — `unregister` is the "should not exist" one. */
  mute(id: string): () => void;
  /** Tune `id` here and in scopes below: its params and added bindings
   *  apply to whichever descriptor is live for it, registered before the
   *  tuning or after. Returns a release. See {@link ActionTuning}. */
  tune(id: string, tuning: ActionTuning): () => void;
  /** The params an invocation of `id` from this scope starts with when it
   *  passes `given`: every tuning's params, `given` laid over them. What a
   *  tool's chrome reads to show what the action it binds will do. */
  paramsOf(id: string, given?: Record<string, unknown>): Record<string, unknown>;
  list(): readonly Action[];
  /** Fire an immediate-invoker action by id. The optional `params` arg is
   *  forwarded to `ImmediateInvoker.run` as its second argument — use it for
   *  parametric actions (e.g. `trigger('tool.activate', { toolId: 'rect' })`).
   *  Returns whether it ran one: `false` for an unknown id, for an action
   *  whose `enabled` refuses, and for an ongoing-invoker action, which
   *  `trigger` cannot reach (see `begin`). `enabled` is asked at
   *  `{ x: params.worldX, y: params.worldY }` when both are numbers, and with
   *  no point otherwise. */
  trigger(id: string, params?: Record<string, unknown>): boolean;
  /** Show what firing `id` with `params` would do, by its `Action.preview`,
   *  and return what takes it down; calling that twice is harmless. Shows
   *  nothing for an unknown id, one with no preview, and one whose `enabled`
   *  refuses, asked as `trigger` asks it. */
  preview(id: string, params?: Record<string, unknown>): () => void;
  /**
   * Subscribe to registry mutations. The callback fires after any
   * `register`/`unregister` that changes the version. Returns an
   * unsubscribe function. Designed for `useSyncExternalStore`-driven
   * surfaces (e.g. `<ActionBar>` in `@weasel-js/ui`) that need to
   * re-render when the action set changes.
   */
  subscribe(listener: () => void): () => void;

  /**
   * Start an ongoing action driven by UI (color picker, opacity slider).
   * Returns a control object with `update(params)` and `end(reason)`.
   *
   * Returns `null` if no dispatcher is wired into this registry, the
   * action is unknown, or its invoker is not ongoing.
   *
   * See `Dispatcher.beginUiOngoing` for full semantics including
   * auto-commit when a prior UI handle for the same action is in flight.
   */
  begin(id: string, params?: Record<string, unknown>): UiOngoingControl | null;

  /** Wire a dispatcher into the registry so `begin()` can delegate to it.
   *  Returns a release that takes out only this dispatcher; a `null` wires
   *  nothing. */
  setDispatcher(d: Dispatcher | null): () => void;

  /** Make this registry's scope the one chrome above it reaches, and the one
   *  keys go to: `trigger`, `begin` and `list` on any ancestor then answer from
   *  here. A dispatcher calls it on the pointerdown and wheel that land in its
   *  scope; moving DOM focus alone does not. */
  activate(): void;

  /** Whether a lookup made from the root of this registry's tree starts here.
   *  A dispatcher with no canvas to press in asks this before handling a
   *  keystroke. */
  isActive(): boolean;

  /** Whether this registry's scope is the one last activated on the page, in
   *  any tree: the question a canvas's dispatcher asks before handling a key
   *  or a paste that reached the page. No scope holds the keys before the
   *  first activation. */
  holdsKeys(): boolean;

  /** Let go of the keys if this scope holds them, as its canvas unmounts. */
  dropKeys(): void;
}

// ─── Registration-time validation ─────────────────────────────────────────

/** Validate that `id` is usable as an action id in the route grammar.
 *  Rejects ids that start with a reserved sigil (would shadow future
 *  grammar extensions) and ids that collide with phase keywords (would
 *  parse as the bare-phase shorthand). Mirrors `defineTool`'s tool-id
 *  validation. */
export function validateActionId(id: string): void {
  if (id.length === 0) {
    throw new Error(`weasel: action id may not be empty`);
  }
  if (RESERVED_ID_PREFIXES.has(id[0]!)) {
    throw new Error(
      `weasel: action id "${id}" starts with reserved sigil "${id[0]}" ` +
      `(reserved set: ${[...RESERVED_ID_PREFIXES].join(' ')})`,
    );
  }
  if (RESERVED_ID_NAMES.has(id)) {
    throw new Error(
      `weasel: action id "${id}" collides with a reserved phase keyword ` +
      `(reserved: ${[...RESERVED_ID_NAMES].join(', ')})`,
    );
  }
}

/** Reject any '&'-channel phase atom in an Action's defaultBinding —
 *  actions have no owning tool, so '&' can't resolve. Tool-side bindings
 *  (Tool.bindings) are the right place for '&' atoms. */
export function validateActionDefaultBinding(action: Action): void {
  const gs = action.defaultBinding;
  if (!gs) return;
  const entries: BoundGesture[] = Array.isArray(gs) ? gs : [gs as BoundGesture];
  for (const entry of entries) {
    const spec = ('kind' in entry ? entry : entry.spec) as GestureSpec;
    const phase: PhaseSpec | undefined = spec.phase;
    if (phase === undefined) continue;
    const atoms: readonly PhaseAtom[] = Array.isArray(phase)
      ? phase
      : [{ channel: '&', phase: phase }];
    for (const atom of atoms) {
      if (atom.channel === '&') {
        throw new Error(
          `weasel: action "${action.id}" defaultBinding uses '&' channel ` +
          `which has no owning tool to resolve to. Use a named tool channel ` +
          `(e.g. '[rect:engaged]') or '*' instead, or move this binding to ` +
          `the tool's own Tool.bindings.`,
        );
      }
    }
  }
}

