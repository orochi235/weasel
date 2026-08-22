import { Children, type ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import { asNodeId, createNode, gridStrategy, Store } from 'windease';
import { type ChromeMap, Container, Provider, StrategyRegistryProvider } from 'windease/react';

const ZONE_ID = asNodeId('lk-workspaces');
const STRATEGIES = { grid: gridStrategy as never };
const KIND = 'workspace';

export interface WorkspaceGridProps {
  children: ReactNode;
  /**
   * Stable id per child, positionally matched. Supply these whenever a tile
   * can be closed from the middle: without them a tile is identified by its
   * position, so closing one shifts every id after it and the panes inherit
   * each other's dragged extents.
   */
  ids?: readonly string[];
  /** Draggable seams between tiles. Off by default — an even tiling is the
   *  behavior every existing caller has. */
  resizable?: boolean;
  gap?: number;
  padding?: number;
  /**
   * Fixed tiling extent. Omit in an app — the grid measures its own box. Supply
   * it where nothing measures, notably jsdom: at a zero measurement the grid
   * renders no tiles at all.
   */
  viewport?: { w: number; h: number };
}

/**
 * Auto-balanced tiling of workspaces, `ceil(sqrt(n))` columns wide.
 *
 * Tiles are absolutely positioned at the rects `gridStrategy` computes, not
 * laid out by CSS — `windease/styles.css` (folded into
 * `@weasel-js/labkit/styles.css`) carries the rules that positioning depends on.
 */
export function WorkspaceGrid({
  children,
  ids,
  resizable = false,
  gap = 12,
  padding = 0,
  viewport,
}: WorkspaceGridProps) {
  const items = Children.toArray(children);
  const idKey = ids ? ids.join(',') : `#${items.length}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: idKey is the stable projection of items/ids; depending on those directly rebuilds every render and re-runs the sync effect forever
  const nodeIds = useMemo(() => items.map((_, i) => asNodeId(ids?.[i] ?? `lk-ws-${i}`)), [idKey]);

  // One store for the component's lifetime: a tile's dragged extent lives in
  // its node, so rebuilding the store on every add or close would silently
  // reset every pane.
  const storeRef = useRef<Store | null>(null);
  if (storeRef.current === null) {
    const store = new Store();
    store.registerNode(
      createNode({
        kind: 'zone',
        id: ZONE_ID,
        container: { strategyId: 'grid', config: { resizable, gap, padding } },
      }),
    );
    storeRef.current = store;
  }
  const store = storeRef.current;

  useLayoutEffect(() => {
    store.updateContainerConfig(ZONE_ID, { resizable, gap, padding });
  }, [store, resizable, gap, padding]);

  useLayoutEffect(() => {
    const present = new Set(store.getContainerView(ZONE_ID)?.childOrder ?? []);
    const wanted = new Set(nodeIds);
    for (const id of present) {
      if (!wanted.has(id)) store.unregisterNode(id);
    }
    for (const id of nodeIds) {
      if (present.has(id)) continue;
      store.registerNode(createNode({ kind: KIND, id, parentId: ZONE_ID, focus: true }));
      store.showNode(id);
    }
    store.setChildOrder(ZONE_ID, [...nodeIds]);
  }, [store, nodeIds]);

  const chrome = useMemo<ChromeMap>(() => {
    const byId = new Map<string, ReactNode>(nodeIds.map((id, i) => [id, items[i]]));
    return { [KIND]: ({ node }) => byId.get(node.id) ?? null };
  }, [nodeIds, items]);

  return (
    <Provider store={store}>
      <StrategyRegistryProvider strategies={STRATEGIES}>
        <Container
          parentId={ZONE_ID}
          chrome={chrome}
          className="lk-workspace-grid windease-zone"
          affordances={resizable}
          viewport={viewport}
        />
      </StrategyRegistryProvider>
    </Provider>
  );
}
