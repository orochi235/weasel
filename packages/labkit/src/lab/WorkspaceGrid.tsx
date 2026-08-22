import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { asNodeId, createNode, gridStrategy, type NodeId, Store } from 'windease';
import {
  type ChromeMap,
  Container,
  DragHandle,
  DragProvider,
  Provider,
  StrategyRegistryProvider,
} from 'windease/react';

const ZONE_ID = asNodeId('lk-workspaces');
const STRATEGIES = { grid: gridStrategy as never };
const KIND = 'workspace';

/** A tile's persisted extent, keyed by the id its caller gave it. Grid resizes
 *  write `span`; `size` is here because a strategy swap would write that. */
export type WorkspaceLayout = Record<
  string,
  { size?: { w?: number; h?: number }; span?: { cols?: number; rows?: number } }
>;

export interface WorkspaceGridProps {
  children: ReactNode;
  /**
   * Stable id per child, positionally matched. Supply these whenever a tile
   * can be closed from the middle: without them a tile is identified by its
   * position, so closing one shifts every id after it and the panes inherit
   * each other's dragged extents. `layout` and `reorderable` both key off
   * these, so neither means much without them.
   */
  ids?: readonly string[];
  /** Draggable seams between tiles. Off by default — an even tiling is the
   *  behavior every existing caller has. */
  resizable?: boolean;
  /** Let a tile be dragged to a new position. Off by default. The grid never
   *  reorders `children` itself: it reports the order a drop would produce and
   *  the caller commits it. */
  reorderable?: boolean;
  /** The full id list a drop would produce, in its new order. */
  onReorder?: (ids: string[]) => void;
  /** Extents from a previous session, applied to tiles as they register. */
  layout?: WorkspaceLayout;
  /** Fires when a tile's extent changes. Persist it and hand it back as
   *  `layout` to make a resize survive a reload. */
  onLayoutChange?: (layout: WorkspaceLayout) => void;
  gap?: number;
  padding?: number;
  /**
   * Fixed tiling extent. Omit in an app — the grid measures its own box. Supply
   * it where nothing measures, notably jsdom: at a zero measurement the grid
   * renders no tiles at all.
   */
  viewport?: { w: number; h: number };
}

function extentOf(store: Store, id: NodeId): WorkspaceLayout[string] | null {
  const p = store.getNode(id)?.membership?.placement as WorkspaceLayout[string] | undefined;
  if (!p) return null;
  const out: WorkspaceLayout[string] = {};
  if (p.size) out.size = p.size;
  if (p.span) out.span = p.span;
  return Object.keys(out).length > 0 ? out : null;
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
  reorderable = false,
  onReorder,
  layout,
  onLayoutChange,
  gap = 12,
  padding = 0,
  viewport,
}: WorkspaceGridProps) {
  const items = Children.toArray(children);
  const idKey = ids ? ids.join(',') : `#${items.length}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: idKey is the stable projection of items/ids; depending on those directly rebuilds every render and re-runs the sync effect forever
  const nodeIds = useMemo(() => items.map((_, i) => asNodeId(ids?.[i] ?? `lk-ws-${i}`)), [idKey]);

  // Held in refs rather than depended on: a fresh object each render would
  // re-run the sync effect, and only a newly registered tile reads `layout`.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

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
      const saved = layoutRef.current?.[id];
      if (saved) store.patchPlacement(id, saved);
    }
    store.setChildOrder(ZONE_ID, [...nodeIds]);
  }, [store, nodeIds]);

  useEffect(() => {
    if (!onLayoutChange) return;
    return store.events.on('node.placementChanged', () => {
      const next: WorkspaceLayout = {};
      for (const child of store.getChildren(ZONE_ID)) {
        const extent = extentOf(store, child.id);
        if (extent) next[child.id] = extent;
      }
      onLayoutChangeRef.current?.(next);
    });
  }, [store, onLayoutChange]);

  const commitOrder = useCallback(
    (nextIds: NodeId[]) => onReorder?.(nextIds.map(String)),
    [onReorder],
  );

  const chrome = useMemo<ChromeMap>(() => {
    const byId = new Map<string, ReactNode>(nodeIds.map((id, i) => [id, items[i]]));
    return {
      [KIND]: ({ node }) => {
        const content = byId.get(node.id) ?? null;
        if (!reorderable) return content;
        // A tile is full of controls, so the whole thing can't be the handle.
        return (
          <div className="lk-workspace-tile">
            <DragHandle nodeId={node.id} className="lk-workspace-tile__grip">
              <span className="lk-workspace-tile__grip-dots" aria-hidden="true" />
            </DragHandle>
            <div className="lk-workspace-tile__body">{content}</div>
          </div>
        );
      },
    };
  }, [nodeIds, items, reorderable]);

  const grid = (
    <Container
      parentId={ZONE_ID}
      chrome={chrome}
      className="lk-workspace-grid windease-zone"
      affordances={resizable}
      viewport={viewport}
      onChildOrderChange={reorderable ? commitOrder : undefined}
    />
  );

  return (
    <Provider store={store}>
      <StrategyRegistryProvider strategies={STRATEGIES}>
        {reorderable ? <DragProvider>{grid}</DragProvider> : grid}
      </StrategyRegistryProvider>
    </Provider>
  );
}
