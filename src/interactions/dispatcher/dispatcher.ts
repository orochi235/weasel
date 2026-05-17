/**
 * Dispatcher orchestrator — pure module, no React, no DOM.
 *
 * Assembles `ScopedBinding[]` from the actions registry, active tool, and
 * hotkey stack; matches input events via `matchBest`; gates on `enabled()`;
 * then invokes `immediate` or `ongoing` invokers and tracks in-flight handles.
 *
 * ## gestureId scheme
 * - `key-held` ongoing actions: `key-held-<key>` (e.g. `key-held- ` for Space).
 *   Chosen because key-held gestures are identified by the held key alone.
 * - `pointerdown` / drag ongoing actions: `pointer-<pointerId>`, where
 *   `pointerId` defaults to `'mouse'` (Phase 3 has no real pointer IDs; the
 *   React seam in Task 4 will supply the actual DOM pointerId).
 * - `multitouch` ongoing actions: `multitouch-<fingers>`.
 * - Fallback for any other kind that triggers an ongoing invoker: `ongoing-<kind>`.
 *
 * ## Action-lookup miss behavior
 * When `matchBest` resolves a binding whose `actionId` has no entry in
 * `ctx.actions.list()`, the dispatcher emits `console.warn` and returns
 * `'unhandled'`. The user's input gesture falls through as if unmatched.
 * This preserves input flow (nothing is swallowed silently) while flagging
 * the misconfiguration at dev time.
 */

import type { Action, ActionsRegistry } from '../actions/registry';
import type { DepRegistry } from '../actions/depRegistry';
import type { GestureBinding } from '../actions/binding';
import type { OngoingHandle, InvocationCtx, ActionDeps } from '../actions/invoker';
import type { Tool } from '../../tools/types';
import type { InputEvent, BindingScope, ScopedBinding } from './matcher';
import { matchBest } from './matcher';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DispatcherContext {
  /** All registered actions; the dispatcher walks `.gestureBinding` for ambient bindings. */
  actions: ActionsRegistry;
  /** Dep sources keyed by name. */
  depRegistry: DepRegistry;
  /** Active tool's id (from ActiveToolContext). */
  activeToolId: string;
  /** Held-hotkey stack, top of stack last. */
  hotkeyStack: readonly string[];
  /** Lookup for tool definitions. */
  toolsById: ReadonlyMap<string, Tool>;
  /** Platform flag for `mod` shorthand resolution. */
  isMac: boolean;
}

export interface Dispatcher {
  /**
   * Route an input event through the binding pipeline. Returns `'handled'`
   * when a binding matched and the action invoked successfully (whether it
   * returned ops or not). Returns `'unhandled'` when no binding matched or
   * the matched action's `enabled()` returned a disabled reason.
   */
  handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled';

  /**
   * Synthesize an end-of-gesture for every in-flight ongoing handle.
   * Used by tool-switch cancellation (Q2 decision).
   */
  cancelAll(reason: 'commit' | 'cancel'): void;

  /**
   * Read-only view of currently in-flight ongoing handles, keyed by gestureId.
   * For debug/testing.
   */
  inFlight(): ReadonlyMap<string, OngoingHandle>;
}

// ---------------------------------------------------------------------------
// createDispatcher
// ---------------------------------------------------------------------------

export function createDispatcher(): Dispatcher {
  const inFlightHandles = new Map<string, OngoingHandle>();

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Build a minimal InvocationCtx stub for the given event + deps. */
  function buildInvocationCtx(event: InputEvent, deps: ActionDeps): InvocationCtx {
    const modifiers = {
      alt: event.altKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey,
    };
    const base: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers,
      deps,
    };

    // Populate gesture-kind-specific fields.
    if (event.kind === 'key') {
      base.key = { key: event.key, repeat: event.repeat ?? false };
    } else if (event.kind === 'key-held') {
      base.key = { key: event.key, repeat: false };
    } else if (event.kind === 'wheel') {
      base.wheel = { deltaX: 0, deltaY: 0, deltaZ: 0 };
    } else if (event.kind === 'pointerdown' || event.kind === 'click') {
      base.drag = { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } };
    } else if (event.kind === 'multitouch') {
      base.multiTouch = { centroid: { x: 0, y: 0 }, spread: 1, rotation: 0 };
    }

    return base;
  }

  /**
   * Derive a gestureId from an event for keying in-flight ongoing handles.
   * See module JSDoc for the full scheme.
   */
  function gestureIdFor(event: InputEvent): string {
    if (event.kind === 'key-held') {
      return `key-held-${event.key}`;
    }
    if (event.kind === 'pointerdown') {
      return `pointer-mouse`;
    }
    if (event.kind === 'multitouch') {
      return `multitouch-${event.fingers}`;
    }
    return `ongoing-${event.kind}`;
  }

  /** Assemble the ScopedBinding list from all three scopes. */
  function assembleScopedBindings(ctx: DispatcherContext): ScopedBinding[] {
    const result: ScopedBinding[] = [];

    // Hotkey scope (top of stack = highest priority, iterated last so they
    // appear first in matchBest's inner loop — but matchBest itself iterates
    // by scope priority, so order within scope matters: last-in-stack = last-declared).
    for (const toolId of ctx.hotkeyStack) {
      const tool = ctx.toolsById.get(toolId);
      for (const binding of tool?.bindings ?? []) {
        result.push({ binding, scope: 'hotkey' as BindingScope });
      }
    }

    // Active scope.
    const activeTool = ctx.toolsById.get(ctx.activeToolId);
    for (const binding of activeTool?.bindings ?? []) {
      result.push({ binding, scope: 'active' as BindingScope });
    }

    // Ambient scope: walk the actions registry.
    for (const action of ctx.actions.list()) {
      const gs = action.gestureBinding;
      if (!gs) continue;
      const specs = Array.isArray(gs) ? gs : [gs];
      for (const spec of specs) {
        const gestureBinding: GestureBinding = { spec, actionId: action.id };
        result.push({ binding: gestureBinding, scope: 'ambient' as BindingScope });
      }
    }

    return result;
  }

  /** Build an actionId → Action lookup from the registry. */
  function buildActionMap(registry: ActionsRegistry): Map<string, Action> {
    const map = new Map<string, Action>();
    for (const action of registry.list()) {
      map.set(action.id, action);
    }
    return map;
  }

  /** Build the deps bag for an action. */
  function buildDeps(action: Action, depRegistry: DepRegistry): ActionDeps {
    // `requires` is not on Action's public interface yet (Phase 3 stub).
    // Cast through unknown to read it if present without a type error.
    const requires = (action as unknown as { requires?: string[] }).requires ?? [];
    const entries = requires.map((name) => [name, depRegistry.get(name as never)]);
    return Object.fromEntries(entries) as ActionDeps;
  }

  // -------------------------------------------------------------------------
  // handleInput
  // -------------------------------------------------------------------------

  function handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled' {
    // --- Pump: check for key-held up-phase against in-flight handle ---
    if (event.kind === 'key-held' && event.phase === 'up') {
      const gestureId = gestureIdFor(event);
      const handle = inFlightHandles.get(gestureId);
      if (handle) {
        const stubCtx = buildInvocationCtx(event, {});
        handle.onEnd?.(stubCtx, 'commit');
        inFlightHandles.delete(gestureId);
      }
      // Whether we had a handle or not, this is a follow-up event, not a new match.
      return handle ? 'handled' : 'unhandled';
    }

    // --- Scope assembly ---
    const scopedBindings = assembleScopedBindings(ctx);

    // --- Match ---
    const match = matchBest(event, scopedBindings, ctx.isMac);
    if (!match) return 'unhandled';

    // --- Action lookup ---
    const actionMap = buildActionMap(ctx.actions);
    const action = actionMap.get(match.binding.actionId);
    if (!action) {
      console.warn(
        `weasel dispatcher: binding resolved actionId "${match.binding.actionId}" which has ` +
        `no registered action. Skipping. (misconfiguration)`,
      );
      return 'unhandled';
    }

    // --- Enabled gate ---
    if (action.enabled) {
      const result = action.enabled();
      if (result !== true) {
        return 'unhandled';
      }
    }

    // --- Invoke ---
    const deps = buildDeps(action, ctx.depRegistry);

    if (action.invoker?.timing === 'immediate') {
      try {
        action.invoker.run(deps);
      } catch (err) {
        console.error(`weasel dispatcher: action "${action.id}" invoker threw`, err);
      }
      return 'handled';
    }

    if (action.invoker?.timing === 'ongoing') {
      const invCtx = buildInvocationCtx(event, deps);
      const handle = action.invoker.start(invCtx, match.binding.opts);
      const gestureId = gestureIdFor(event);
      inFlightHandles.set(gestureId, handle);
      return 'handled';
    }

    // Fallback: legacy `run` path (no invoker).
    try {
      action.run?.();
    } catch (err) {
      console.error(`weasel dispatcher: action "${action.id}" threw`, err);
    }
    return 'handled';
  }

  // -------------------------------------------------------------------------
  // cancelAll
  // -------------------------------------------------------------------------

  function cancelAll(reason: 'commit' | 'cancel'): void {
    const stubCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    for (const handle of inFlightHandles.values()) {
      handle.onEnd?.(stubCtx, reason);
    }
    inFlightHandles.clear();
  }

  // -------------------------------------------------------------------------
  // inFlight
  // -------------------------------------------------------------------------

  function inFlight(): ReadonlyMap<string, OngoingHandle> {
    return inFlightHandles;
  }

  return { handleInput, cancelAll, inFlight };
}
