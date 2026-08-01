// src/tools/useTools.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { dlog } from '../debug/flag';
import type { AnyTool } from './types';
import type { RenderLayer } from 'core/layers/render';
import { useActiveToolContext } from '../interactions/actions/activeToolContext';
import { reportRouteConflicts } from './routing/reflection';

export interface UseToolsOptions {
  /** Initial active-slot tool id. Must exist in `registry`. */
  active: string;
  /** Tools eligible for the active slot or hotkey slot. The keys are the
   *  tool ids; the values are the tool records. A tool with `hotkey` set
   *  is wired into the hotkey slot whenever the engagement state matches. */
  registry: Record<string, AnyTool>;
  /** Always-on tools — listen continuously regardless of active slot. */
  ambient?: AnyTool[];
}

export interface ToolsApi {
  /** Current active-slot tool id. */
  active: string;
  /** Set the active-slot tool. The gesture dispatcher watches the active
   *  tool and cancels any in-flight handle itself. */
  setActive: (id: string) => void;
  /** Currently hotkey-engaged tool id (or `null`). Derived as the top of
   *  the hotkey stack for backwards compat with the pre-stack API. */
  hotkeyEngaged: string | null;
  /** Engage a hotkey-slot tool by id. */
  engageHotkey: (id: string) => void;
  /** Disengage the hotkey-slot tool, if any. */
  disengageHotkey: () => void;
  /** All always-on tools, in registration order. */
  ambient: readonly AnyTool[];
  /** Full registry — for userland UI (palette buttons, etc.). */
  registry: Readonly<Record<string, AnyTool>>;
  /** Returns true if a tool with the given id is in the registry or ambient list. */
  has(id: string): boolean;
  /** All overlay layers from currently-engaged tools (active slot, hotkey
   *  slot if engaged, all ambient slot tools). Filters out tools with no
   *  `overlay` field. Order: active, then hotkey (if engaged), then
   *  ambient (registration order). */
  getActiveOverlays(): RenderLayer<unknown>[];
}

/**
 * Manages the active tool and hotkey slot.
 *
 * It used to also own a dispatcher: `useTools` constructed the tool-routing
 * dispatcher and `<Canvas>` pumped DOM events into it. Input now belongs
 * entirely to `useGestureDispatcher`, so what's left here is slot state plus
 * the overlay roll-up.
 *
 * Requires `<ActiveToolContextProvider>` (or `<WeaselProvider>` /
 * `<SceneCanvas>`, which mount one internally) in scope: active/hotkey state
 * lives in the context so the gesture dispatcher and any sibling
 * `useTools` calls all read the same source of truth.
 *
 * **First-mount-wins semantics**: if `opts.active` differs from the context
 * default (`'select'`) on first mount, `useTools` pushes `opts.active` to
 * the context via a microtask. Subsequent mounts respect whatever the
 * context currently holds (the first caller wins).
 */
export function useTools(opts: UseToolsOptions): ToolsApi {
  if (!(opts.active in opts.registry)) {
    throw new Error(`useTools: active "${opts.active}" not in registry`);
  }

  const ctx = useActiveToolContext();

  // First-mount sync: if context is at its default ('select') and caller wants
  // something else, push opts.active to the context. The decision is captured at
  // first render; the actual setState runs in a post-commit effect (below) rather
  // than a render-phase microtask, so it never updates state during render and is
  // wrapped in act() under test.
  const hasInitializedRef = useRef(false);
  const isFirstRender = !hasInitializedRef.current;
  const needsFirstMountSyncRef = useRef(false);
  if (isFirstRender) {
    hasInitializedRef.current = true;
    needsFirstMountSyncRef.current = ctx.active === 'select' && opts.active !== 'select';
  }
  useEffect(() => {
    if (!needsFirstMountSyncRef.current) return;
    needsFirstMountSyncRef.current = false;
    ctx.setActive(opts.active);
    // First-mount sync only — deliberately runs once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On the very first render, if context hasn't yet been updated to match
  // opts.active, use opts.active directly to avoid a flash of the wrong tool.
  const active = isFirstRender && ctx.active === 'select' && opts.active !== 'select'
    ? opts.active
    : ctx.active;
  const hotkeyStack = ctx.hotkeyStack;
  const hotkeyEngaged = hotkeyStack.at(-1) ?? null;

  // Refs so the memoized callbacks below see latest values without
  // re-creating themselves.
  const registryRef = useRef(opts.registry);
  registryRef.current = opts.registry;
  const ambientRef = useRef(opts.ambient ?? []);
  ambientRef.current = opts.ambient ?? [];
  const activeRef = useRef(active);
  activeRef.current = active;
  const hotkeyRef = useRef(hotkeyEngaged);
  hotkeyRef.current = hotkeyEngaged;
  const setActive = useCallback(
    (id: string) => {
      if (!(id in registryRef.current)) {
        throw new Error(`setActive: "${id}" not in registry`);
      }
      dlog('tools', 'active:', activeRef.current, '→', id);
      ctx.setActive(id);
    },
    [ctx],
  );

  const engageHotkey = useCallback(
    (id: string) => {
      if (!(id in registryRef.current)) {
        throw new Error(`engageHotkey: "${id}" not in registry`);
      }
      dlog('tools', 'hotkey engaged:', id);
      ctx.pushHotkey(id);
    },
    [ctx],
  );

  const disengageHotkey = useCallback(() => {
    if (hotkeyRef.current) dlog('tools', 'hotkey disengaged:', hotkeyRef.current);
    ctx.popHotkey();
  }, [ctx]);

  // Route-conflict check. Two tools declaring the same (phase, gesture, arg,
  // target, modifiers) tuple are resolved by slot order and almost certainly
  // not as either author intended — the kit has been able to detect that
  // since `findConflicts` was written and never looked. This is where the
  // tool set is assembled, so this is where it looks.
  //
  // Dev-only, and deduped on a signature of the tool set: the check walks
  // every binding of every tool, and `registry` / `ambient` are usually fresh
  // object literals each render, so keying the effect on them directly would
  // re-warn on every keystroke.
  const lastConflictSigRef = useRef<string | null>(null);
  const toolSetSig = Object.keys(opts.registry).join(',')
    + '|' + (opts.ambient ?? []).map(t => t.id).join(',');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (lastConflictSigRef.current === toolSetSig) return;
    lastConflictSigRef.current = toolSetSig;
    reportRouteConflicts({
      registry: registryRef.current,
      ambient: ambientRef.current,
    });
  }, [toolSetSig]);

  // `has` and `getActiveOverlays` read live state via refs, so they're
  // safe to memoize once for the lifetime of the hook.
  const has = useCallback(
    (id: string): boolean =>
      id in registryRef.current || ambientRef.current.some(t => t.id === id),
    [],
  );
  const getActiveOverlays = useCallback((): RenderLayer<unknown>[] => {
    const out: RenderLayer<unknown>[] = [];
    const activeTool = registryRef.current[activeRef.current];
    if (activeTool?.overlay) out.push(activeTool.overlay);
    const mod = hotkeyRef.current ? registryRef.current[hotkeyRef.current] : null;
    if (mod?.overlay) out.push(mod.overlay);
    for (const t of ambientRef.current) {
      if (t.overlay) out.push(t.overlay);
    }
    return out;
  }, []);

  // Memoize the returned ToolsApi so consumers using `tools` as a dep (e.g.
  // SceneCanvas's `onToolsCreated` useEffect) don't see identity churn on
  // every render — which otherwise loops infinitely when the consumer
  // setStates from inside `onToolsCreated`.
  return useMemo(
    () => ({
      active,
      setActive,
      hotkeyEngaged,
      engageHotkey,
      disengageHotkey,
      ambient: ambientRef.current,
      registry: registryRef.current,
      has,
      getActiveOverlays,
    }),
    [active, setActive, hotkeyEngaged, engageHotkey, disengageHotkey, has, getActiveOverlays],
  );
}
