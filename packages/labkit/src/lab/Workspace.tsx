import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { asNodeId, createNode, floatingStrategy, gridStrategy, type NodeId, Store } from 'windease';
import {
  type ChromeMap,
  Container,
  DragProvider,
  Provider,
  StrategyRegistryProvider,
} from 'windease/react';

import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { TrialDragContext } from '../trial/TrialDragContext';
import { usePanelHosts } from './panelHost';

const ZONE_ID = asNodeId('lk-workspace');
const STRATEGIES = { grid: gridStrategy as never, floating: floatingStrategy as never };
const FLOAT_ZONE_ID = asNodeId('lk-workspace-floating');
const PANEL_KIND = 'panel';
const KIND = 'trial';

/** A tile's persisted extent, keyed by the id its caller gave it. Grid resizes
 *  write `span`; `size` is here because a strategy swap would write that. */
export type TrialLayout = Record<
  string,
  { size?: { w?: number; h?: number }; span?: { cols?: number; rows?: number } }
>;

export interface WorkspaceProps {
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
  layout?: TrialLayout;
  /** Fires when a tile's extent changes. Persist it and hand it back as
   *  `layout` to make a resize survive a reload. */
  onLayoutChange?: (layout: TrialLayout) => void;
  gap?: number;
  padding?: number;
  /** Undocked sidebar panels to render alongside the trials. A `'tile'` panel
   *  joins the grid as a peer of the trials; a `'floating'` one goes into the
   *  floating zone above it. The body is portalled in by the trial that owns
   *  it, so all this renders is the frame and the host. */
  panels?: readonly PanelDescriptor[];
  /**
   * Fixed tiling extent. Omit in an app — the grid measures its own box. Supply
   * it where nothing measures, notably jsdom: at a zero measurement the grid
   * renders no tiles at all.
   */
  viewport?: { w: number; h: number };
}

function extentOf(store: Store, id: NodeId): TrialLayout[string] | null {
  const p = store.getNode(id)?.membership?.placement as TrialLayout[string] | undefined;
  if (!p) return null;
  const out: TrialLayout[string] = {};
  if (p.size) out.size = p.size;
  if (p.span) out.span = p.span;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Auto-balanced tiling of trials, `ceil(sqrt(n))` columns wide.
 *
 * Tiles are absolutely positioned at the rects `gridStrategy` computes, not
 * laid out by CSS — `windease/styles.css` (folded into
 * `@weasel-js/labkit/styles.css`) carries the rules that positioning depends on.
 *
 * `panels` are undocked sidebar sections. A `'tile'` panel is registered as a
 * peer of the trials under `PANEL_KIND`, so the grid places and resizes it like
 * one; a `'floating'` panel goes in the overlay above. Either way this renders
 * only the frame and an empty host: the section's content is portalled in by
 * the trial that owns it, which is what keeps a torn-out section inside its
 * trial's React tree instead of rebuilding it as a sibling.
 */

/** The frame an undocked panel gets: a box, and the host element its trial
 *  portals into. The title and the dock control come through the portal with
 *  the body — the workspace knows a panel's key, not what is in it. */
function PanelFrame({ panel, floating = false }: { panel: PanelDescriptor; floating?: boolean }) {
  const hosts = usePanelHosts();
  return (
    <div className={floating ? 'lk-panel-tile lk-panel-tile--floating' : 'lk-panel-tile'}>
      <div className="lk-panel-tile__body" ref={(el) => hosts?.set(panel.key, el)} />
    </div>
  );
}

/** One undocked panel, as the workspace needs to know it. */
export interface PanelDescriptor {
  /** Stable key; also the portal host key the owning trial writes into. */
  key: string;
  title: string;
  as: 'tile' | 'floating';
}

export function Workspace({
  children,
  ids,
  panels,
  resizable = false,
  reorderable = false,
  onReorder,
  layout,
  onLayoutChange,
  gap = 12,
  padding = 0,
  viewport,
}: WorkspaceProps) {
  const items = Children.toArray(children);
  const tilePanels = useMemo(() => (panels ?? []).filter((p) => p.as === 'tile'), [panels]);
  const floatPanels = useMemo(() => (panels ?? []).filter((p) => p.as === 'floating'), [panels]);
  // Identity has to be stable while the id *contents* are unchanged: the sync
  // effect below keys off it, and a fresh array every render would re-register
  // every tile forever. A ref keyed on the joined ids says that directly, where
  // a `useMemo` on the same key can only say it by suppressing both linters.
  const wantedIds = [
    ...items.map((_, i) => ids?.[i] ?? `lk-ws-${i}`),
    ...tilePanels.map((p) => `lk-panel-${p.key}`),
  ];
  const idKey = wantedIds.join(',');
  const idKeyRef = useRef<string | null>(null);
  const nodeIdsRef = useRef<NodeId[]>([]);
  if (idKeyRef.current !== idKey) {
    idKeyRef.current = idKey;
    nodeIdsRef.current = wantedIds.map(asNodeId);
  }
  const nodeIds = nodeIdsRef.current;

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
    store.registerNode(
      createNode({
        kind: 'zone',
        id: FLOAT_ZONE_ID,
        container: { strategyId: 'floating', config: {} },
      }),
    );
    storeRef.current = store;
  }
  const store = storeRef.current;

  // A tile that only moves reports nothing to a ResizeObserver, and only this
  // component knows the grid moved one. Optional: a lab may own no surface.
  const surface = useSurfaceOptional();

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
      const kind = String(id).startsWith('lk-panel-') ? PANEL_KIND : KIND;
      store.registerNode(createNode({ kind, id, parentId: ZONE_ID, focus: true }));
      store.showNode(id);
      const saved = layoutRef.current?.[id];
      if (saved) store.patchPlacement(id, saved);
    }
    store.setChildOrder(ZONE_ID, [...nodeIds]);
  }, [store, nodeIds]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: nodeIds is the signal that the tile set changed — a re-tile moves tiles without resizing any — not a value this reads
  useEffect(() => {
    if (!surface) return;
    surface.invalidateRects();
    return store.events.on('node.placementChanged', () => surface.invalidateRects());
  }, [store, surface, nodeIds]);

  useEffect(() => {
    if (!onLayoutChange) return;
    return store.events.on('node.placementChanged', () => {
      const next: TrialLayout = {};
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
    const panelByNode = new Map<string, PanelDescriptor>(
      tilePanels.map((p) => [`lk-panel-${p.key}`, p]),
    );
    return {
      [PANEL_KIND]: ({ node }) => {
        const panel = panelByNode.get(String(node.id));
        if (!panel) return null;
        return <PanelFrame panel={panel} />;
      },
      [KIND]: ({ node }) => {
        const content = byId.get(node.id) ?? null;
        if (!reorderable) return content;
        return (
          // No grip strip: the trial's own title bar is the drag surface.
          <TrialDragContext.Provider value={{ nodeId: node.id }}>
            <div className="lk-trial-tile">{content}</div>
          </TrialDragContext.Provider>
        );
      },
    };
  }, [nodeIds, items, reorderable, tilePanels]);

  const floatingLayer =
    floatPanels.length === 0 ? null : (
      <div className="lk-workspace__floating">
        {floatPanels.map((p) => (
          <PanelFrame key={p.key} panel={p} floating />
        ))}
      </div>
    );

  const grid = (
    <Container
      parentId={ZONE_ID}
      chrome={chrome}
      className="lk-workspace windease-zone"
      affordances={resizable}
      viewport={viewport}
      onChildOrderChange={reorderable ? commitOrder : undefined}
    />
  );

  return (
    <Provider store={store}>
      <StrategyRegistryProvider strategies={STRATEGIES}>
        {floatingLayer ? (
          // The floating layer insets against the workspace, so it needs a
          // positioned box around both. Without one it insets against the page
          // and lands over the lab header.
          <div className="lk-workspace-host">
            {reorderable ? <DragProvider>{grid}</DragProvider> : grid}
            {floatingLayer}
          </div>
        ) : reorderable ? (
          <DragProvider>{grid}</DragProvider>
        ) : (
          grid
        )}
      </StrategyRegistryProvider>
    </Provider>
  );
}
