// src/tools/useTools.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { createToolsDispatcher, type ToolsDispatcher, type ToolsDispatcherOptions } from './dispatcher';
import { dlog } from '../debug/flag';
import type { AnyTool, ToolCtx } from './types';
import type { RenderLayer } from 'core/layers/render';
import { useOptionalActiveToolContext } from '../interactions/actions/activeToolContext';

export interface UseToolsOptions {
  /** Initial active-slot tool id. Must exist in `registry`. */
  active: string;
  /** Tools eligible for the active slot or hotkey slot. The keys are the
   *  tool ids; the values are the tool records. A tool with `hotkey` set
   *  is wired into the hotkey slot whenever the engagement state matches. */
  registry: Record<string, AnyTool>;
  /** Always-on tools — listen continuously regardless of active slot. */
  ambient?: AnyTool[];
  /** Optional fallback tool consulted ONLY for `pointer.onClick` when the
   *  active tool's click handler returns `'pass'` (or has no handler).
   *  Lets a non-select tool stay active while unhandled clicks fall through
   *  to the select tool for click-to-select. Not consulted for pointerdown,
   *  drag, keyboard, wheel, or dblTap. */
  fallback?: AnyTool;
  /** Per-event base ctx supplier. `<Canvas>` wires this to inject world
   *  coords, modifiers, selection, adapter, applyOps. Tests can supply
   *  a stub. Optional — the dispatcher works with a default empty ctx
   *  for tests that don't need the wiring. */
  getCtx?: (overrides?: {
    clientX?: number;
    clientY?: number;
    modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean };
  }) => Omit<ToolCtx, 'scratch'>;
  /** Optional scene hit-test for populating `ctx.target` on pointer events.
   *  `<Canvas>` wires this from the effective `pickEvery` + adapter. Tests
   *  may supply a stub; omit for the always-empty fallback. */
  getNodeAtPoint?: ToolsDispatcherOptions['getNodeAtPoint'];
}

export interface ToolsApi {
  /** Current active-slot tool id. */
  active: string;
  /** Set the active-slot tool. Cancels any in-flight gesture. */
  setActive: (id: string) => void;
  /** Currently hotkey-engaged tool id (or `null`). Derived as the top of
   *  the hotkey stack for backwards compat with the pre-stack API. */
  hotkeyEngaged: string | null;
  /** Engage a hotkey-slot tool by id. No-op if a gesture is in flight. */
  engageHotkey: (id: string) => void;
  /** Disengage the hotkey-slot tool, if any. */
  disengageHotkey: () => void;
  /** All always-on tools, in registration order. */
  ambient: readonly AnyTool[];
  /** Full registry — for userland UI (palette buttons, etc.). */
  registry: Readonly<Record<string, AnyTool>>;
  /** The dispatcher `<Canvas>` wires to its DOM events. */
  dispatcher: ToolsDispatcher;
  /** Increments whenever an in-flight gesture starts, transitions phase, or
   *  ends. Consumers (e.g. `<Canvas>` cursor resolution) include this in
   *  their render deps to re-evaluate derived state on real DOM events
   *  rather than waiting for an unrelated re-render. */
  gestureTick: number;
  /** Returns true if a tool with the given id is in the registry or ambient list. */
  has(id: string): boolean;
  /** All overlay layers from currently-engaged tools (active slot, hotkey
   *  slot if engaged, all ambient slot tools). Filters out tools with no
   *  `overlay` field. Order: active, then hotkey (if engaged), then
   *  ambient (registration order). */
  getActiveOverlays(): RenderLayer<unknown>[];
}

const DEFAULT_CTX: Omit<ToolCtx, 'scratch'> = {
  worldX: 0,
  worldY: 0,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
  selection: {
    get: () => [], set: () => {}, add: () => {}, remove: () => {},
    toggle: () => {}, clear: () => {}, applyClick: () => {},
  } as never,
  adapter: null,
  view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
  setView: () => {},
  canvasRect: typeof DOMRect !== 'undefined' ? new DOMRect() : ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect),
  applyOps: () => {},
  debug: undefined,
};

/**
 * Manages the active tool, hotkey slot, and gesture dispatcher.
 *
 * **Soft-fallback semantics**: when rendered inside `<ActiveToolContextProvider>`
 * (automatically provided by `<SceneCanvas>`), active/hotkey state lives in the
 * context (Phase 5 semantics). Without a provider, `useTools` falls back to
 * internal `useState` (pre-Phase-5 semantics). This preserves backwards
 * compatibility for standalone `useTools` calls outside `<SceneCanvas>`.
 *
 * **First-mount-wins semantics** (context path only): if `opts.active` differs
 * from the context default (`'select'`) on first mount, `useTools` pushes
 * `opts.active` to the context via a microtask. Subsequent mounts respect
 * whatever the context currently holds (the first caller wins).
 */
export function useTools(opts: UseToolsOptions): ToolsApi {
  if (!(opts.active in opts.registry)) {
    throw new Error(`useTools: active "${opts.active}" not in registry`);
  }

  // Soft-fallback: use context when available, otherwise fall back to local state.
  const optionalCtx = useOptionalActiveToolContext();
  const usingContext = optionalCtx !== null;

  // Local state — used only when no context provider is in scope.
  const [localActive, setLocalActive] = useState<string>(opts.active);
  const [localHotkeyStack, setLocalHotkeyStack] = useState<string[]>([]);

  // First-mount sync (context path only): if context is at its default ('select')
  // and caller wants something else, push opts.active to the context via microtask
  // so we don't setState during render.
  const hasInitializedRef = useRef(false);
  const isFirstRender = !hasInitializedRef.current;
  if (isFirstRender) {
    hasInitializedRef.current = true;
    if (usingContext && optionalCtx.active === 'select' && opts.active !== 'select') {
      queueMicrotask(() => optionalCtx.setActive(opts.active));
    }
  }

  // Effective state: from context when available, otherwise local.
  // On the very first render with context, if context hasn't yet been updated
  // to match opts.active, use opts.active directly to avoid a flash of the wrong tool.
  const active = usingContext
    ? (isFirstRender && optionalCtx.active === 'select' && opts.active !== 'select'
        ? opts.active
        : optionalCtx.active)
    : localActive;
  const hotkeyStack = usingContext ? optionalCtx.hotkeyStack : localHotkeyStack;
  const hotkeyEngaged = hotkeyStack.at(-1) ?? null;

  const [gestureTick, setGestureTick] = useState(0);

  // Refs so the dispatcher's getSlots/getCtx callbacks see latest values
  // without re-creating the dispatcher.
  const registryRef = useRef(opts.registry);
  registryRef.current = opts.registry;
  const ambientRef = useRef(opts.ambient ?? []);
  ambientRef.current = opts.ambient ?? [];
  const fallbackRef = useRef(opts.fallback);
  fallbackRef.current = opts.fallback;
  const activeRef = useRef(active);
  activeRef.current = active;
  const hotkeyRef = useRef(hotkeyEngaged);
  hotkeyRef.current = hotkeyEngaged;
  const getCtxRef = useRef(opts.getCtx);
  getCtxRef.current = opts.getCtx;
  const getNodeAtPointRef = useRef(opts.getNodeAtPoint);
  getNodeAtPointRef.current = opts.getNodeAtPoint;

  const dispatcher = useMemo(
    () =>
      createToolsDispatcher({
        getSlots: () => ({
          hotkey: hotkeyRef.current ? registryRef.current[hotkeyRef.current] ?? null : null,
          active: registryRef.current[activeRef.current] ?? null,
          ambient: ambientRef.current,
          fallback: fallbackRef.current ?? null,
        }),
        getCtx: (overrides) => {
          if (getCtxRef.current) return getCtxRef.current(overrides);
          return DEFAULT_CTX;
        },
        getNodeAtPoint: (wx, wy) => getNodeAtPointRef.current?.(wx, wy) ?? null,
        onGestureChange: () => setGestureTick((t) => t + 1),
      }),
    [],
  );

  const setActive = useCallback(
    (id: string) => {
      if (!(id in registryRef.current)) {
        throw new Error(`setActive: "${id}" not in registry`);
      }
      dlog('[tools] active:', activeRef.current, '→', id);
      dispatcher.cancelGesture();
      if (usingContext) optionalCtx.setActive(id);
      else setLocalActive(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatcher, usingContext, optionalCtx],
  );

  const engageHotkey = useCallback(
    (id: string) => {
      if (dispatcher.hasActiveGesture()) return; // mid-gesture lockout
      if (!(id in registryRef.current)) {
        throw new Error(`engageHotkey: "${id}" not in registry`);
      }
      dlog('[tools] hotkey engaged:', id);
      if (usingContext) optionalCtx.pushHotkey(id);
      else setLocalHotkeyStack((s) => [...s, id]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatcher, usingContext, optionalCtx],
  );

  const disengageHotkey = useCallback(() => {
    if (hotkeyRef.current) dlog('[tools] hotkey disengaged:', hotkeyRef.current);
    if (usingContext) optionalCtx.popHotkey();
    else setLocalHotkeyStack((s) => (s.length === 0 ? s : s.slice(0, -1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingContext, optionalCtx]);

  return {
    active,
    setActive,
    hotkeyEngaged,
    engageHotkey,
    disengageHotkey,
    ambient: ambientRef.current,
    registry: registryRef.current,
    dispatcher,
    gestureTick,
    has(id: string): boolean {
      return id in registryRef.current || ambientRef.current.some(t => t.id === id);
    },
    getActiveOverlays(): RenderLayer<unknown>[] {
      const out: RenderLayer<unknown>[] = [];
      const activeTool = registryRef.current[activeRef.current];
      if (activeTool?.overlay) out.push(activeTool.overlay);
      const mod = hotkeyRef.current ? registryRef.current[hotkeyRef.current] : null;
      if (mod?.overlay) out.push(mod.overlay);
      for (const t of ambientRef.current) {
        if (t.overlay) out.push(t.overlay);
      }
      return out;
    },
  };
}
