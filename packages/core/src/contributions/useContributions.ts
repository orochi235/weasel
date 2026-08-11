// src/contributions/useContributions.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RenderLayer } from 'core/layers/render';
import type { ScopedBinding } from '../interactions/dispatcher/matcher';
import { useActiveToolContext } from '../interactions/actions/activeToolContext';
import { useActionsRegistry } from '../interactions/actions/registry';
import {
  buildToolOffhandBindings,
  makeToolOffhandAction,
  offhandKeyFor,
  type ToolOffhandBindingSpec,
} from '../interactions/actions/defaults/toolOffhand';
import { reportRouteConflicts } from '../tools/routing/reflection';
import type { HotkeyTrigger, Tool } from '../tools/types';
import { scopeBindings } from './assemble';
import { liveScope } from './eligibility';
import type { Contribution } from './types';

const NO_TRIGGERS: ReadonlySet<string> = new Set<string>();

export interface UseContributionsOptions {
  /** Every registry entry, in declaration order. Order decides which of two
   *  same-specificity bindings in one scope tier wins. */
  entries: readonly Contribution[];
  /** Desired focused entry id. First-mount-wins against the shared
   *  `ActiveToolContext` — see `useTools` for the full semantics. */
  focused: string;
}

export interface ContributionsApi {
  /** Every entry, as passed in. */
  entries: readonly Contribution[];
  /** Currently focused entry id. */
  focused: string;
  /** Focus an entry. Writes through to the shared `ActiveToolContext`. */
  setFocused: (id: string) => void;
  /** Every live binding, tiered by the declaring entry's eligibility. */
  scopedBindings(): ScopedBinding[];
  /** Overlays of every live entry, ordered active, then hotkey, then ambient. */
  overlays(): RenderLayer<unknown>[];
}

/**
 * Assembles one registry: every entry's bindings and overlays, each tiered by
 * what the entry declares about its own eligibility rather than by which
 * argument a consumer passed it in.
 *
 * Requires `<ActiveToolContextProvider>` (or `<WeaselProvider>` /
 * `<SceneCanvas>`, which mount one internally): focus and held-key state live
 * in the context so the gesture dispatcher and every sibling caller read the
 * same source of truth.
 */
export function useContributions(opts: UseContributionsOptions): ContributionsApi {
  const ctx = useActiveToolContext();
  const actionsRegistry = useActionsRegistry();

  // First-mount sync: if context is at its default ('select') and the caller
  // wants something else, push it. Captured at first render; the setState runs
  // in a post-commit effect so it never updates state during render.
  const hasInitializedRef = useRef(false);
  const isFirstRender = !hasInitializedRef.current;
  const needsFirstMountSyncRef = useRef(false);
  if (isFirstRender) {
    hasInitializedRef.current = true;
    needsFirstMountSyncRef.current = ctx.active === 'select' && opts.focused !== 'select';
  }
  useEffect(() => {
    if (!needsFirstMountSyncRef.current) return;
    needsFirstMountSyncRef.current = false;
    ctx.setActive(opts.focused);
    // First-mount sync only — deliberately runs once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focused = isFirstRender && ctx.active === 'select' && opts.focused !== 'select'
    ? opts.focused
    : ctx.active;

  // Refs so the memoized callbacks below see latest values without
  // re-creating themselves.
  const entriesRef = useRef(opts.entries);
  entriesRef.current = opts.entries;
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const engagedRef = useRef<readonly string[]>(ctx.hotkeyStack);
  engagedRef.current = ctx.hotkeyStack;

  const setFocused = useCallback((id: string) => { ctx.setActive(id); }, [ctx]);

  /** Live eligibility state, plus the entries ordered so that hotkey-engaged
   *  ones come first — stack order breaks ties within the hotkey tier. */
  const snapshot = useCallback(() => {
    const engaged = engagedRef.current;
    const engagedIds = new Set(engaged);
    const ordered: Contribution[] = [];
    for (const id of engaged) {
      const entry = entriesRef.current.find((e) => e.id === id);
      if (entry && !ordered.includes(entry)) ordered.push(entry);
    }
    for (const entry of entriesRef.current) {
      if (!ordered.includes(entry)) ordered.push(entry);
    }
    return {
      ordered,
      state: { focusedId: focusedRef.current, heldTriggers: NO_TRIGGERS, engagedIds },
    };
  }, []);

  const scopedBindings = useCallback((): ScopedBinding[] => {
    const { ordered, state } = snapshot();
    return scopeBindings(ordered, state);
  }, [snapshot]);

  const overlays = useCallback((): RenderLayer<unknown>[] => {
    const { ordered, state } = snapshot();
    const active: RenderLayer<unknown>[] = [];
    const hotkey: RenderLayer<unknown>[] = [];
    const ambient: RenderLayer<unknown>[] = [];
    for (const entry of ordered) {
      if (!entry.overlay) continue;
      const scope = liveScope(entry.id, entry.eligibility ?? {}, state);
      if (scope === 'active') active.push(entry.overlay);
      else if (scope === 'hotkey') hotkey.push(entry.overlay);
      else if (scope === 'ambient') ambient.push(entry.overlay);
    }
    return [...active, ...hotkey, ...ambient];
  }, [snapshot]);

  // A declared `offhand` trigger registers its own engagement. One
  // consolidated `tool.offhand` action serves every entry that declares one;
  // its invoker reads `params.toolId` off the matched binding.
  const offhandSig = opts.entries
    .map((e) => (e.eligibility?.offhand ? `${e.id}:${e.eligibility.offhand}` : ''))
    .filter(Boolean)
    .join(',');
  useEffect(() => {
    if (!actionsRegistry || offhandSig === '') return;
    const specs: ToolOffhandBindingSpec[] = offhandSig.split(',').map((entry) => {
      const [toolId, trigger] = entry.split(':');
      return { toolId, key: offhandKeyFor(trigger as HotkeyTrigger) };
    });
    return actionsRegistry.register(makeToolOffhandAction(buildToolOffhandBindings(specs)));
  }, [actionsRegistry, offhandSig]);

  // Route-conflict check. Two entries declaring the same (phase, gesture, arg,
  // target, modifiers) tuple in one scope are resolved by declaration order and
  // almost certainly not as either author intended. This is where the entry set
  // is assembled, so this is where it looks.
  //
  // Dev-only, and deduped on a signature of the entry set: the check walks
  // every binding of every entry, and consumers usually rebuild the entry list
  // each render. Actions are read inside the effect, after the registrations
  // that ran in child effects have landed.
  const lastConflictSigRef = useRef<string | null>(null);
  const entrySig = opts.entries.map((e) => e.id).join(',');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (lastConflictSigRef.current === entrySig) return;
    lastConflictSigRef.current = entrySig;
    const registry: Tool<unknown>[] = [];
    const ambient: Tool<unknown>[] = [];
    for (const entry of entriesRef.current) {
      (entry.eligibility?.focus ? registry : ambient).push(entry);
    }
    reportRouteConflicts({
      registry,
      ambient,
      actions: actionsRegistry?.list() ?? [],
    });
  }, [entrySig, actionsRegistry]);

  // Memoized so consumers using the result as an effect dep don't see identity
  // churn every render — which loops infinitely when the consumer setStates
  // from inside such an effect.
  return useMemo(
    () => ({
      entries: entriesRef.current,
      focused,
      setFocused,
      scopedBindings,
      overlays,
    }),
    [focused, setFocused, scopedBindings, overlays],
  );
}
