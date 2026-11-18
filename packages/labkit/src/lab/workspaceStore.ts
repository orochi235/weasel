import { useLatest } from '@weasel-js/core';
import { getOwn, setOwn } from '@weasel-js/registry';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { asNodeId, createNode, type NodeId, Store } from 'windease';
import { useSurfaceOptional } from '../surface/useSurfaceTile';

export const ZONE_ID = asNodeId('lk-workspace');
const FLOAT_ZONE_ID = asNodeId('lk-workspace-floating');
export const PANEL_KIND = 'panel';
export const TRIAL_KIND = 'trial';

const PANEL_PREFIX = 'lk-panel-';

/** The node id an undocked panel's tile registers under. */
export const panelNodeId = (key: string): string => `${PANEL_PREFIX}${key}`;

/** A tile's persisted extent, keyed by the id its caller gave it. Grid resizes
 *  write `span`; `size` is here because a strategy swap would write that. */
export type TrialLayout = Record<
  string,
  { size?: { w?: number; h?: number }; span?: { cols?: number; rows?: number } }
>;

/** The layout store a workspace keeps for its lifetime: the tile grid, and the zone floating panels live in. */
function createWorkspaceStore(grid: { resizable: boolean; gap: number; padding: number }): Store {
  const store = new Store();
  store.registerNode(
    createNode({
      kind: 'zone',
      id: ZONE_ID,
      container: { strategyId: 'grid', config: grid },
    }),
  );
  store.registerNode(
    createNode({
      kind: 'zone',
      id: FLOAT_ZONE_ID,
      container: { strategyId: 'floating', config: {} },
    }),
  );
  return store;
}

function extentOf(store: Store, id: NodeId): TrialLayout[string] | null {
  const p = store.getNode(id)?.membership?.placement as TrialLayout[string] | undefined;
  if (!p) return null;
  const out: TrialLayout[string] = {};
  if (p.size) out.size = p.size;
  if (p.span) out.span = p.span;
  return Object.keys(out).length > 0 ? out : null;
}

/** The workspace's layout store, its grid held to `resizable`, `gap` and `padding`. */
export function useWorkspaceStore(resizable: boolean, gap: number, padding: number): Store {
  // One store for the component's lifetime: a tile's dragged extent lives in
  // its node, so rebuilding the store on every add or close would silently
  // reset every pane.
  const storeRef = useRef<Store | null>(null);
  if (storeRef.current === null)
    storeRef.current = createWorkspaceStore({ resizable, gap, padding });
  const store = storeRef.current;

  useLayoutEffect(() => {
    store.updateContainerConfig(ZONE_ID, { resizable, gap, padding });
  }, [store, resizable, gap, padding]);
  return store;
}

/** Keeps the grid's tiles to `nodeIds`, in that order. A tile registering for the first time takes its extent from
 *  `layout`. */
export function useTileSync(
  store: Store,
  nodeIds: readonly NodeId[],
  layout: TrialLayout | undefined,
): void {
  // Held in a ref rather than depended on: a fresh object each render would
  // re-run the sync, and only a newly registered tile reads `layout`.
  const layoutRef = useLatest(layout);
  useLayoutEffect(() => {
    const present = new Set(store.getContainerView(ZONE_ID)?.childOrder ?? []);
    const wanted = new Set(nodeIds);
    for (const id of present) {
      if (!wanted.has(id)) store.unregisterNode(id);
    }
    for (const id of nodeIds) {
      if (present.has(id)) continue;
      const kind = String(id).startsWith(PANEL_PREFIX) ? PANEL_KIND : TRIAL_KIND;
      store.registerNode(createNode({ kind, id, parentId: ZONE_ID, focus: true })); // eslint-disable-line weasel/effect-cleanup -- the store owns its tiles; this reconciles them with nodeIds
      store.showNode(id);
      const saved = layoutRef.current && getOwn(layoutRef.current, id);
      if (saved) store.patchPlacement(id, saved);
    }
    store.setChildOrder(ZONE_ID, [...nodeIds]);
  }, [store, nodeIds, layoutRef]);
}

/** Re-measures the lab's surface whenever the grid moves a tile. Optional: a lab may own no surface. */
export function useSurfaceRetile(store: Store, nodeIds: readonly NodeId[]): void {
  // A tile that only moves reports nothing to a ResizeObserver, and only the
  // workspace knows the grid moved one.
  const surface = useSurfaceOptional();
  // biome-ignore lint/correctness/useExhaustiveDependencies: nodeIds is the signal that the tile set changed — a re-tile moves tiles without resizing any — not a value this reads
  useEffect(() => {
    if (!surface) return;
    surface.invalidateRects();
    return store.events.on('node.placementChanged', () => surface.invalidateRects());
  }, [store, surface, nodeIds]);
}

/** Calls `onLayoutChange` with every tile's extent whenever one changes. */
export function useLayoutReport(
  store: Store,
  onLayoutChange: ((layout: TrialLayout) => void) | undefined,
): void {
  const onLayoutChangeRef = useLatest(onLayoutChange);
  useEffect(() => {
    if (!onLayoutChange) return;
    return store.events.on('node.placementChanged', () => {
      const next: TrialLayout = {};
      for (const child of store.getChildren(ZONE_ID)) {
        const extent = extentOf(store, child.id);
        if (extent) setOwn(next, child.id, extent);
      }
      onLayoutChangeRef.current?.(next);
    });
  }, [store, onLayoutChange, onLayoutChangeRef]);
}
