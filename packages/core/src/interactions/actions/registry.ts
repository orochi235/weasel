/**
 * @experimental
 * The actions store contract and the `actions` prop that seeds it. The
 * provider that implements this lives in `ActionsProvider.tsx`; nothing here
 * touches React.
 * Spec: docs/superpowers/specs/2026-05-09-actions-registry-design.md
 */
import type { GestureSpec, PhaseSpec } from '../gestures/spec';
import type { BoundGesture } from './binding';
import type { Action } from './action';
import type { DepRegistry } from './depRegistry';
import { RESERVED_ID_NAMES, RESERVED_ID_PREFIXES, type PhaseAtom } from '../../tools/routing/routeGrammar';
import type { Dispatcher, UiOngoingControl } from '../dispatcher/dispatcher';
export type { UiOngoingControl } from '../dispatcher/dispatcher';





/**
 * @experimental
 * Partial override or full descriptor passed via `<SceneCanvas actions={...}>`.
 * `null` disables a default at this id.
 */
export type ActionEntry = null | Partial<Action> | Action;

/**
 * @experimental
 * Shape of the `actions` prop on `<SceneCanvas>`. `null` disables all defaults.
 */
export type ActionsProp = null | Record<string, ActionEntry>;

/**
 * @experimental
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
  /** Declare `id` not for this scope: it stays registered, and every other
   *  scope over the same store still resolves it, but here it lists as absent
   *  and neither `trigger` nor `begin` will fire it. Returns a release; an
   *  `<ActionsScope>` drops what it muted when it unmounts. This is the
   *  "not for me" door — `unregister` is the "should not exist" one. */
  mute(id: string): () => void;
  list(): readonly Action[];
  /** Fire an immediate-invoker action by id. The optional `params` arg is
   *  forwarded to `ImmediateInvoker.run` as its second argument — use it for
   *  parametric actions (e.g. `trigger('tool.activate', { toolId: 'rect' })`).
   *  Ongoing-invoker actions are not reachable from `trigger`. */
  trigger(id: string, params?: Record<string, unknown>): boolean;
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
   *  Returns a release that clears the slot only while this dispatcher still
   *  holds it: a canvas displaced by a later one must not take input away from
   *  the canvas now on screen. Call with `null` to detach unconditionally. */
  setDispatcher(d: Dispatcher | null): () => void;

  /** Wire a `DepRegistry` into the registry so `trigger()` / `begin()` can
   *  resolve action deps even when this provider is mounted ABOVE the dep
   *  registry (e.g. a consumer's root `<ActionsProvider>` reused by
   *  SceneCanvas's `ActionsProviderIfRoot`). Takes precedence over the dep
   *  registry read from context at the provider's own level. Call with
   *  `null` to detach unconditionally; the returned release clears the slot
   *  only while this registry still holds it. */
  setDepRegistry(r: DepRegistry | null): () => void;
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

