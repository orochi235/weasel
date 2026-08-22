// src/tools/useTools.ts
import { useCallback, useMemo, useRef } from 'react';
import { dlog } from '../debug/flag';
import type { AnyTool, HotkeyTrigger } from './types';
import type { RenderLayer } from 'core/layers/render';
import { useActiveToolContext } from '../interactions/actions/activeToolContext';
import { useContributions } from '../contributions/useContributions';
import type { Contribution, Eligibility, OverlayPosition } from '../contributions/types';

/** Options for `useTools`: which tools exist, which one starts active, and
 *  which run continuously regardless of the active one. */
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

/** The tool registry's runtime surface: which tool is active, which is
 *  temporarily held by a hotkey, and how to change either. */
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
   *  slot if engaged, all ambient slot tools) that declare `position`.
   *  Filters out tools with no `overlay` field. Order: active, then hotkey
   *  (if engaged), then ambient (registration order). */
  getActiveOverlays(position?: OverlayPosition): RenderLayer<unknown>[];
}

/** The slot a caller passed a tool in, restated as declared eligibility.
 *  `ToolDef.hotkey` becomes `offhand` — it is the same declaration, read off
 *  the authored form via the `def` reflection handle. A tool that already
 *  declares what its slot implies is returned as-is: `ToolsApi.registry`
 *  hands back the objects the caller passed, and consumers compare identity. */
function declareSlot(tool: AnyTool, slot: 'focus' | 'always'): AnyTool {
  const hotkey = (tool.def as { hotkey?: HotkeyTrigger } | undefined)?.hotkey;
  const eligibility: Eligibility = {
    ...tool.eligibility,
    [slot]: true,
    ...(hotkey ? { offhand: hotkey } : {}),
  };
  return sameEligibility(tool.eligibility, eligibility) ? tool : { ...tool, eligibility };
}

function sameEligibility(a: Eligibility | undefined, b: Eligibility): boolean {
  if (!a) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Eligibility>;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/**
 * Manages the active tool and hotkey slot.
 *
 * A thin shim over {@link useContributions}: the `registry` / `ambient`
 * arguments are restated as declared eligibility (`focus` / `always`), and
 * assembly happens in one place for tools and non-tool contributions alike.
 *
 * Requires `<ActiveToolContextProvider>` (or `<WeaselProvider>` /
 * `<SceneCanvas>`, which mount one internally) in scope: active/hotkey state
 * lives in the context so the gesture dispatcher and any sibling
 * `useTools` calls all read the same source of truth.
 *
 * **First-mount-wins semantics**: if `opts.active` differs from the context
 * default (`'select'`) on first mount, `useTools` pushes `opts.active` to
 * the context. Subsequent mounts respect whatever the context currently
 * holds (the first caller wins).
 */
export function useTools(opts: UseToolsOptions): ToolsApi {
  if (!(opts.active in opts.registry)) {
    throw new Error(`useTools: active "${opts.active}" not in registry`);
  }

  const ctx = useActiveToolContext();

  const slotted = useMemo(() => {
    const registry: Record<string, AnyTool> = {};
    for (const [id, tool] of Object.entries(opts.registry)) {
      registry[id] = declareSlot(tool, 'focus');
    }
    const ambient = (opts.ambient ?? []).map((t) => declareSlot(t, 'always'));
    const byId = new Map<string, Contribution>();
    for (const tool of [...Object.values(registry), ...ambient]) {
      const prior = byId.get(tool.id);
      if (prior) byId.set(tool.id, { ...tool, eligibility: { ...prior.eligibility, ...tool.eligibility } });
      else byId.set(tool.id, tool);
    }
    return { registry, ambient, entries: [...byId.values()] };
  }, [opts.registry, opts.ambient]);

  const contributions = useContributions({ entries: slotted.entries, focused: opts.active });

  const hotkeyEngaged = ctx.hotkeyStack.at(-1) ?? null;

  // Refs so the memoized callbacks below see latest values without
  // re-creating themselves.
  const slottedRef = useRef(slotted);
  slottedRef.current = slotted;
  const activeRef = useRef(contributions.focused);
  activeRef.current = contributions.focused;
  const hotkeyRef = useRef(hotkeyEngaged);
  hotkeyRef.current = hotkeyEngaged;

  const setFocused = contributions.setFocused;
  const setActive = useCallback(
    (id: string) => {
      if (!(id in slottedRef.current.registry)) {
        throw new Error(`setActive: "${id}" not in registry`);
      }
      dlog('tools', 'active:', activeRef.current, '→', id);
      setFocused(id);
    },
    [setFocused],
  );

  const engageHotkey = useCallback(
    (id: string) => {
      if (!(id in slottedRef.current.registry)) {
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

  const has = useCallback(
    (id: string): boolean =>
      id in slottedRef.current.registry
      || slottedRef.current.ambient.some((t) => t.id === id),
    [],
  );

  // Memoize the returned ToolsApi so consumers using `tools` as a dep (e.g.
  // SceneCanvas's `onToolsCreated` useEffect) don't see identity churn on
  // every render — which otherwise loops infinitely when the consumer
  // setStates from inside `onToolsCreated`.
  const active = contributions.focused;
  const getActiveOverlays = contributions.overlays;
  // Which tools exist, not which object holds them: callers commonly rebuild
  // `opts.registry` as a literal every render, and keying the memo on
  // `slotted` itself would hand them a new `ToolsApi` per render.
  const registryKey =
    Object.keys(slotted.registry).sort().join('|')
    + '#' + slotted.ambient.map((t) => t.id).join('|');
  return useMemo(
    () => ({
      active,
      setActive,
      hotkeyEngaged,
      engageHotkey,
      disengageHotkey,
      ambient: slottedRef.current.ambient,
      registry: slottedRef.current.registry,
      has,
      getActiveOverlays,
    }),
    [active, setActive, hotkeyEngaged, engageHotkey, disengageHotkey, has, getActiveOverlays, registryKey],
  );
}
