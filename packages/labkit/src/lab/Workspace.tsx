import { Children, type ReactNode, useCallback, useMemo } from 'react';
import { asNodeId, floatingStrategy, gridStrategy, type NodeId } from 'windease';
import { Container, DragProvider, Provider, StrategyRegistryProvider } from 'windease/react';
import { createTileChrome, FloatingPanels, type PanelDescriptor } from './tileChrome';
import {
  panelNodeId,
  type TrialLayout,
  useLayoutReport,
  useSurfaceRetile,
  useTileSync,
  useWorkspaceStore,
  ZONE_ID,
} from './workspaceStore';

export type { PanelDescriptor } from './tileChrome';
export type { TrialLayout } from './workspaceStore';

const STRATEGIES = { grid: gridStrategy as never, floating: floatingStrategy as never };

/** Props for `Workspace`. */
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
  /** Draggable seams between tiles. Off by default. */
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
   *  floating zone above it. The body is portaled in by the trial that owns
   *  it, so all this renders is the frame and the host. */
  panels?: readonly PanelDescriptor[];
  /**
   * Whether a tile can open in a `<Lightbox>` — shown large over the page from
   * the expand button in its corner — without being remounted. On by default;
   * `false` turns it off for every tile, and a function decides per tile id.
   */
  lightbox?: boolean | ((id: string) => boolean);
  /**
   * Whether a double-click on a tile's content also opens its lightbox. Off by
   * default, since most content has its own use for a double-click; give it
   * to a tile whose content has none, such as an image, with a function of
   * the tile id.
   */
  expandOnDoubleClick?: boolean | ((id: string) => boolean);
  /**
   * Fixed tiling extent. Omit in an app — the grid measures its own box. Supply
   * it where nothing measures, notably jsdom: at a zero measurement the grid
   * renders no tiles at all.
   */
  viewport?: { w: number; h: number };
}

/**
 * Auto-balanced tiling of trials, `ceil(sqrt(n))` columns wide.
 *
 * Tiles are absolutely positioned at the rects `gridStrategy` computes, not
 * laid out by CSS — `windease/styles.css` (folded into
 * `@weasel-js/labkit/styles.css`) carries the rules that positioning depends on.
 *
 * `panels` are undocked sidebar sections. Either way this renders only the
 * frame and an empty host: the section's content is portaled in by the trial
 * that owns it, which is what keeps a torn-out section inside its trial's
 * React tree.
 */
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
  lightbox = true,
  expandOnDoubleClick = false,
}: WorkspaceProps) {
  const items = Children.toArray(children);
  const tilePanels = useMemo(() => (panels ?? []).filter((p) => p.as === 'tile'), [panels]);
  const floatPanels = useMemo(() => (panels ?? []).filter((p) => p.as === 'floating'), [panels]);
  // Identity has to be stable while the id *contents* are unchanged: the sync
  // effect keys off it, and a fresh array every render would re-register
  // every tile forever.
  const idKey = JSON.stringify([
    ...items.map((_, i) => ids?.[i] ?? `lk-ws-${i}`),
    ...tilePanels.map((p) => panelNodeId(p.key)),
  ]);
  const nodeIds = useMemo(() => (JSON.parse(idKey) as string[]).map(asNodeId), [idKey]);

  const store = useWorkspaceStore(resizable, gap, padding);
  useTileSync(store, nodeIds, layout);
  useSurfaceRetile(store, nodeIds);
  useLayoutReport(store, onLayoutChange);

  const commitOrder = useCallback(
    (nextIds: NodeId[]) => onReorder?.(nextIds.map(String)),
    [onReorder],
  );

  const chrome = useMemo(
    () =>
      createTileChrome({ nodeIds, items, tilePanels, reorderable, lightbox, expandOnDoubleClick }),
    [nodeIds, items, reorderable, tilePanels, lightbox, expandOnDoubleClick],
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
        {/* Always present, so a floating panel arriving or leaving cannot
            remount the grid. The floating layer insets against this box; without
            one it insets against the page and lands over the lab header. */}
        <div className="lk-workspace-host">
          {reorderable ? <DragProvider>{grid}</DragProvider> : grid}
          <FloatingPanels panels={floatPanels} />
        </div>
      </StrategyRegistryProvider>
    </Provider>
  );
}
