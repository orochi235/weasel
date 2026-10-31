// src/tools/useTools.ts
import { useCallback, useMemo } from 'react';
import type { ModeRegistry } from '@weasel-js/modes';
import { dlog } from '../dlog';
import type { AnyTool, Tool } from './types';
import type { HotkeyTrigger } from '../contributions/types';
import { useActiveToolContext } from '../interactions/actions/activeToolContext';
import { useContributions } from '../contributions/useContributions';
import type { Contribution, Eligibility, OverlayPosition } from '../contributions/types';
import type { KernelOverlay } from '../index';
import { sameList, useLatest, useStableByContent } from '@weasel-js/react';
import { useModeDefaultTool } from './useModeDefaultTool';

/** Options for `useTools`: which tools exist, which one starts active, and
 *  which run continuously regardless of the active one. */
export interface UseToolsOptions<TOverlay = KernelOverlay> {
  /** Initial active-slot tool id, which must exist in `registry`. Omit, or
   *  pass `null`, for no active tool: only hotkey and ambient bindings run. */
  active?: string | null;
  /** Tools eligible for the active slot or hotkey slot. The keys are the
   *  tool ids; the values are the tool records. A tool with `hotkey` set
   *  is wired into the hotkey slot whenever the engagement state matches. */
  registry: Record<string, Tool<TOverlay>>;
  /** Always-on entries — tools or other contributions, live regardless of
   *  the active slot. */
  ambient?: readonly Contribution<TOverlay>[];
  /** The modes the canvas can be in. A mode's `defaultTool` becomes active
   *  as the mode is entered, and the tool it replaced comes back as the mode
   *  is left. The dev-time route-conflict check reads them too; without a
   *  registry it checks against the kit's `DEFAULT_MODES`. */
  modes?: ModeRegistry;
}

/** The tool registry's runtime surface: which tool is active, which is
 *  temporarily held by a hotkey, and how to change either. */
export interface ToolsApi<TOverlay = KernelOverlay> {
  /** Current active-slot tool id, or `null` when no tool is active. */
  active: string | null;
  /** Set the active-slot tool, or `null` to clear it. The gesture dispatcher
   *  watches the active tool and cancels any in-flight handle itself. */
  setActive: (id: string | null) => void;
  /** Currently hotkey-engaged tool id (or `null`): the top of the hotkey stack. */
  hotkeyEngaged: string | null;
  /** Engage a hotkey-slot tool by id. */
  engageHotkey: (id: string) => void;
  /** Disengage the hotkey-slot tool, if any. */
  disengageHotkey: () => void;
  /** All always-on entries, in registration order. */
  ambient: readonly Contribution<TOverlay>[];
  /** Full registry — for userland UI (palette buttons, etc.). */
  registry: Readonly<Record<string, Tool<TOverlay>>>;
  /** Returns true if a tool with the given id is in the registry or ambient list. */
  has(id: string): boolean;
  /** Overlay layers from currently-engaged tools that declare `position`.
   *  Order: active, then hotkey (if engaged), then ambient (registration order). */
  getActiveOverlays(position?: OverlayPosition): TOverlay[];
}

/** The slot a caller passed a tool in, restated as declared eligibility.
 *  A tool that already declares what its slot implies is returned as-is:
 *  `ToolsApi.registry` hands back the objects the caller passed, and
 *  consumers compare identity. */
function declareSlot<T extends Contribution<unknown>>(tool: T, slot: 'focus' | 'always'): T {
  const hotkey = (tool.def as { hotkey?: HotkeyTrigger } | undefined)?.hotkey;
  const eligibility: Eligibility = {
    ...tool.eligibility,
    [slot]: true,
    ...(hotkey ? { offhand: hotkey } : {}),
  };
  return sameEligibility(tool.eligibility, eligibility) ? tool : { ...tool, eligibility };
}

const NO_AMBIENT: readonly never[] = [];

/** `registry` and `ambient` as last passed, kept by identity for as long as
 *  every tool in them is the same object under the same id. */
function useStableSources<T extends AnyTool, A extends Contribution<unknown>>(
  registry: Record<string, T>,
  ambient: readonly A[] | undefined,
): { registry: Record<string, T>; ambient: readonly A[] } {
  return useStableByContent(
    { registry, ambient: ambient ?? NO_AMBIENT },
    (a, b) => sameRecord(a.registry, b.registry) && sameList(a.ambient, b.ambient),
  );
}

function sameRecord<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => k in b && a[k] === b[k]);
}

function sameEligibility(a: Eligibility | undefined, b: Eligibility): boolean {
  if (!a) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Eligibility>;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/**
 * Manages the active tool and hotkey slot; a thin shim over
 * {@link useContributions}.
 *
 * Requires `<ActiveToolContextProvider>` (or `<WeaselProvider>` /
 * `<SceneCanvas>`, which mount one internally) in scope: active/hotkey state
 * lives in the context.
 *
 * **First mount wins**: if the context's slot is unseeded on first mount,
 * `useTools` pushes `opts.active` to the context. Subsequent mounts respect
 * whatever the context currently holds.
 */
export function useTools<TOverlay = KernelOverlay>(
  opts: UseToolsOptions<TOverlay>,
): ToolsApi<TOverlay> {
  const initialActive = opts.active ?? null;
  if (initialActive !== null && !(initialActive in opts.registry)) {
    throw new Error(`useTools: active "${initialActive}" not in registry`);
  }

  const ctx = useActiveToolContext();

  // Rebuilt when the tools themselves change, not the objects holding them:
  // callers commonly pass `opts.registry` / `opts.ambient` as literals made
  // every render, while a tool redefined under an existing id must replace it.
  const sources = useStableSources(opts.registry, opts.ambient);
  const slotted = useMemo(() => {
    const registry: Record<string, Tool<TOverlay>> = {};
    for (const [id, tool] of Object.entries(sources.registry)) {
      registry[id] = declareSlot(tool, 'focus');
    }
    const ambient = sources.ambient.map((t) => declareSlot(t, 'always'));
    const byId = new Map<string, Contribution<TOverlay>>();
    for (const tool of [...Object.values(registry), ...ambient]) {
      const prior = byId.get(tool.id);
      if (prior) byId.set(tool.id, { ...tool, eligibility: { ...prior.eligibility, ...tool.eligibility } });
      else byId.set(tool.id, tool);
    }
    return { registry, ambient, entries: [...byId.values()] };
  }, [sources]);

  const contributions = useContributions<TOverlay>({
    entries: slotted.entries,
    focused: initialActive,
    ...(opts.modes ? { modes: opts.modes } : {}),
  });

  const hotkeyEngaged = ctx.hotkeyStack.at(-1) ?? null;

  // Refs so the memoized callbacks below see latest values without
  // re-creating themselves.
  const slottedRef = useLatest(slotted);
  const activeRef = useLatest(contributions.focused);
  const hotkeyRef = useLatest(hotkeyEngaged);

  const setFocused = contributions.setFocused;
  const setActive = useCallback(
    (id: string | null) => {
      if (id !== null && !(id in slottedRef.current.registry)) {
        throw new Error(`setActive: "${id}" not in registry`);
      }
      dlog('tools', 'active:', activeRef.current, '→', id);
      setFocused(id);
    },
    [setFocused, slottedRef, activeRef],
  );

  const engageHotkey = useCallback(
    (id: string) => {
      if (!(id in slottedRef.current.registry)) {
        throw new Error(`engageHotkey: "${id}" not in registry`);
      }
      dlog('tools', 'hotkey engaged:', id);
      ctx.pushHotkey(id);
    },
    [ctx, slottedRef],
  );

  const disengageHotkey = useCallback(() => {
    if (hotkeyRef.current) dlog('tools', 'hotkey disengaged:', hotkeyRef.current);
    ctx.popHotkey();
  }, [ctx, hotkeyRef]);

  // May be called while rendering, so it reads this render's tools, not a ref.
  const has = useCallback(
    (id: string): boolean =>
      id in slotted.registry
      || slotted.ambient.some((t) => t.id === id),
    [slotted],
  );

  useModeDefaultTool(opts.modes, { active: contributions.focused, initial: initialActive, setActive, has });

  // Memoized: a consumer using `tools` as an effect dep loops infinitely on
  // identity churn when it setStates from inside that effect.
  const active = contributions.focused;
  const getActiveOverlays = contributions.overlays;
  return useMemo(
    () => ({
      active,
      setActive,
      hotkeyEngaged,
      engageHotkey,
      disengageHotkey,
      ambient: slotted.ambient,
      registry: slotted.registry,
      has,
      getActiveOverlays,
    }),
    [active, setActive, hotkeyEngaged, engageHotkey, disengageHotkey, has, getActiveOverlays, slotted],
  );
}
