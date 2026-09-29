// src/contributions/useContributions.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { activeModeOf, type ModeRegistry } from '@weasel-js/modes';
import type { ScopedBinding } from '../interactions/dispatcher/matcher';
import { useActiveToolContext } from '../interactions/actions/activeToolContext';
import { useActionsRegistry } from '../interactions/actions/ActionsProvider';
import {
  buildToolOffhandBindings,
  makeToolOffhandAction,
  offhandKeyFor,
  type ToolOffhandBindingSpec,
} from '../interactions/actions/toolOffhand';
import { reportRouteConflicts } from '../tools/routing/reflection/conflicts';
import type { HotkeyTrigger } from './types';
import { scopeBindings } from './assemble';
import { liveScope } from './eligibility';
import type { Contribution, OverlayPosition } from './types';
import { isDev } from '../devFlag';
import { sameList, useStableByContent } from '../useStableByContent';
import type { KernelOverlay } from '../index';

/** Options for {@link useContributions}. */
export interface UseContributionsOptions<TOverlay = KernelOverlay> {
  /** Every registry entry, in declaration order. Order decides which of two
   *  same-specificity bindings in one scope tier wins. */
  entries: readonly Contribution<TOverlay>[];
  /** Desired focused entry id, or `null` for none. First-mount-wins against
   *  the shared `ActiveToolContext` — see `useTools` for the full semantics. */
  focused: string | null;
  /** The modes the canvas can be in. The dev-time route-conflict check reads
   *  them to decide whether two gated actions can ever compete; without a
   *  registry it checks against the kit's `DEFAULT_MODES`. */
  modes?: ModeRegistry;
}

/** The assembled registry {@link useContributions} returns. */
export interface ContributionsApi<TOverlay = KernelOverlay> {
  /** Every entry, as passed in. */
  entries: readonly Contribution<TOverlay>[];
  /** Currently focused entry id, or `null` when nothing is focused. */
  focused: string | null;
  /** Focus an entry, or pass `null` to focus none. Writes through to the
   *  shared `ActiveToolContext`. */
  setFocused: (id: string | null) => void;
  /** Every live binding, tiered by the declaring entry's eligibility. */
  scopedBindings(): ScopedBinding[];
  /** Overlays of every live entry declaring `position`, ordered active, then
   *  hotkey, then ambient. */
  overlays(position?: OverlayPosition): TOverlay[];
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
export function useContributions<TOverlay = KernelOverlay>(
  opts: UseContributionsOptions<TOverlay>,
): ContributionsApi<TOverlay> {
  const ctx = useActiveToolContext();
  const actionsRegistry = useActionsRegistry();

  // First-mount sync: if the context's slot is still unseeded and the caller
  // wants a tool, push it. Captured at first render; the setState runs in a
  // post-commit effect so it never updates state during render.
  const firstMountRef = useRef<{ sync: boolean } | null>(null);
  const isFirstRender = firstMountRef.current == null;
  if (firstMountRef.current == null) firstMountRef.current = { sync: ctx.active === null && opts.focused !== null };
  useEffect(() => {
    const first = firstMountRef.current;
    if (!first?.sync) return;
    first.sync = false;
    ctx.setActive(opts.focused);
    // First-mount sync only — deliberately runs once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focused = isFirstRender && ctx.active === null && opts.focused !== null
    ? opts.focused
    : ctx.active;

  // Consumers commonly rebuild the entry list every render; identity follows
  // its contents, so everything keyed on it below changes only when they do.
  const entries = useStableByContent(opts.entries, sameList);
  const engaged = ctx.hotkeyStack;

  const setFocused = useCallback((id: string | null) => { ctx.setActive(id); }, [ctx]);

  /** Live eligibility state, plus the entries ordered so that hotkey-engaged
   *  ones come first — stack order breaks ties within the hotkey tier. */
  const snapshot = useCallback(() => {
    const engagedIds = new Set(engaged);
    const ordered: Contribution<TOverlay>[] = [];
    for (const id of engaged) {
      const entry = entries.find((e) => e.id === id);
      if (entry && !ordered.includes(entry)) ordered.push(entry);
    }
    for (const entry of entries) {
      if (!ordered.includes(entry)) ordered.push(entry);
    }
    return {
      ordered,
      state: { focusedId: focused, engagedIds },
    };
  }, [entries, focused, engaged]);

  const scopedBindings = useCallback((): ScopedBinding[] => {
    const { ordered, state } = snapshot();
    return scopeBindings(ordered, state);
  }, [snapshot]);

  const overlays = useCallback((position: OverlayPosition = 'top'): TOverlay[] => {
    const { ordered, state } = snapshot();
    const active: TOverlay[] = [];
    const hotkey: TOverlay[] = [];
    const ambient: TOverlay[] = [];
    for (const entry of ordered) {
      if (!entry.overlay) continue;
      if ((entry.overlayPosition ?? 'top') !== position) continue;
      const layers = Array.isArray(entry.overlay) ? entry.overlay : [entry.overlay];
      const scope = liveScope(entry.id, entry.eligibility ?? {}, state);
      if (scope === 'active') active.push(...layers);
      else if (scope === 'hotkey') hotkey.push(...layers);
      else if (scope === 'ambient') ambient.push(...layers);
    }
    return [...active, ...hotkey, ...ambient];
  }, [snapshot]);

  useOffhandAction(entries);

  // Route-conflict check. Two entries declaring the same (phase, gesture, arg,
  // target, modifiers) tuple in one scope are resolved by declaration order and
  // almost certainly not as either author intended. This is where the entry set
  // is assembled, so this is where it looks.
  //
  // Dev-only, and deduped on a signature of the entry set: the check walks
  // every binding of every entry, and consumers usually rebuild the entry list
  // each render. Actions are read inside the effect, after the registrations
  // that ran in child effects have landed.
  const lastConflictSigRef = useRef<{ sig: string; modes: ModeRegistry | undefined } | null>(null);
  const entrySig = entries.map((e) => e.id).join(',');
  const modesRegistry = opts.modes;
  useEffect(() => {
    if (!isDev()) return;
    const last = lastConflictSigRef.current;
    if (last?.sig === entrySig && last.modes === modesRegistry) return;
    lastConflictSigRef.current = { sig: entrySig, modes: modesRegistry };
    // An entry can be in both buckets and usually is: every tool `defineTool`
    // builds declares `focus: true`, and an ambient one carries `always: true`
    // on top of that. Sorting on "not focus-eligible" put ambient tools in the
    // registry bucket, which is never compared against itself — registry tools
    // take turns in the active slot — so ambient-vs-ambient went unreported.
    const registry: Contribution<TOverlay>[] = [];
    const ambient: Contribution<TOverlay>[] = [];
    for (const entry of entries) {
      if (entry.eligibility?.focus) registry.push(entry);
      if (entry.eligibility?.always || entry.eligibility?.claimed) ambient.push(entry);
    }
    reportRouteConflicts({
      registry,
      ambient,
      actions: actionsRegistry?.list() ?? [],
      ...(modesRegistry ? { modes: modesRegistry.list().map(activeModeOf) } : {}),
    });
  }, [entrySig, entries, actionsRegistry, modesRegistry]);

  // Memoized so consumers using the result as an effect dep don't see identity
  // churn every render — which loops infinitely when the consumer setStates
  // from inside such an effect.
  return useMemo(
    () => ({ entries, focused, setFocused, scopedBindings, overlays }),
    [entries, focused, setFocused, scopedBindings, overlays],
  );
}

/**
 * Registers the consolidated `tool.offhand` action for every entry declaring
 * an `offhand` trigger, into the nearest `<ActionsProvider>`; its invoker
 * reads `params.toolId` off the matched binding. `useContributions` calls it,
 * and so does any host that assembles its entries above its own provider —
 * `<SceneCanvas>` does — since a null registry here registers nothing.
 */
export function useOffhandAction(entries: readonly Contribution<unknown>[]): void {
  const actionsRegistry = useActionsRegistry();
  const offhandSig = JSON.stringify(entries
    .filter((e) => e.eligibility?.offhand)
    .map((e) => [e.id, e.eligibility.offhand]));
  useEffect(() => {
    const pairs = JSON.parse(offhandSig) as [string, HotkeyTrigger][];
    if (!actionsRegistry || pairs.length === 0) return;
    const specs: ToolOffhandBindingSpec[] = pairs.map(([toolId, trigger]) => (
      { toolId, key: offhandKeyFor(trigger) }
    ));
    return actionsRegistry.register(makeToolOffhandAction(buildToolOffhandBindings(specs)));
  }, [actionsRegistry, offhandSig]);
}
