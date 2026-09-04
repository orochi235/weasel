import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { asNodeId, createNode, Store, stripStrategy } from 'windease';
import { type ChromeMap, Container, Provider, StrategyRegistryProvider } from 'windease/react';

const ZONE_ID = asNodeId('lk-trial-body');
const SIDEBAR_ID = asNodeId('lk-trial-sidebar');
const CONTENT_ID = asNodeId('lk-trial-content');
const STRATEGIES = { strip: stripStrategy as never };

/** Props for `<TrialBody>`. */
export interface TrialBodyProps {
  /** The sidebar region's sections. */
  sidebar: ReactNode;
  /** The instrument's own output. */
  children: ReactNode;
  /** Extra class on the content pane — `Trial` marks a canvas instrument's
   *  well flush. */
  contentClassName?: string;
  /** The sidebar's current extent in pixels. Omit for an unpersisted lab: the
   *  seam still works, its result just does not outlive the mount. */
  width?: number;
  /** Where the sidebar starts before anyone drags it. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** How little the instrument may be squeezed to. Reported as the seam's
   *  reachable maximum, so the drag stops there rather than clamping silently. */
  contentMinWidth?: number;
  /** Fires through the drag, not on release: the pane is already there. */
  onWidthChange?: (width: number) => void;
  /**
   * Fixed extent. Omit in an app — the strip measures its own box. Supply it
   * where nothing measures, notably jsdom, or both panes lay out at zero.
   */
  viewport?: { w: number; h: number };
}

/**
 * A trial's sidebar and content as a two-pane strip with a draggable seam.
 *
 * The seam is `stripStrategy`'s own resize affordance, so it arrives as a
 * `role="separator"` carrying the reachable range, operable by pointer and by
 * arrows / Home / End, and clamped against the content pane's floor rather
 * than against the sidebar's alone.
 */
export function TrialBody({
  sidebar,
  children,
  contentClassName,
  width,
  defaultWidth = 320,
  minWidth = 140,
  maxWidth = 720,
  contentMinWidth = 160,
  onWidthChange,
  viewport,
}: TrialBodyProps) {
  // The cross-axis half of every size hint below is inert: a horizontal strip
  // stretches its panes to the container's height and never reads `h`.
  const storeRef = useRef<Store | null>(null);
  if (storeRef.current === null) {
    const store = new Store();
    store.registerNode(
      createNode({
        kind: 'zone',
        id: ZONE_ID,
        container: { strategyId: 'strip', config: { axis: 'x', resizable: true } },
      }),
    );
    store.registerNode(
      createNode({
        kind: 'sidebar',
        id: SIDEBAR_ID,
        parentId: ZONE_ID,
        meta: { title: 'Sidebar' },
        placement: { size: { w: width ?? defaultWidth } },
        hints: { minSize: { w: minWidth, h: 0 }, maxSize: { w: maxWidth, h: 0 } },
      }),
    );
    store.registerNode(
      createNode({
        kind: 'content',
        id: CONTENT_ID,
        parentId: ZONE_ID,
        meta: { title: 'Content' },
        hints: { minSize: { w: contentMinWidth, h: 0 } },
      }),
    );
    store.showNode(SIDEBAR_ID);
    store.showNode(CONTENT_ID);
    storeRef.current = store;
  }
  const store = storeRef.current;

  // What the store last held, so the placement event can tell a drag from the
  // echo of our own write and a controlled `width` does not fight the seam.
  const widthRef = useRef(width ?? defaultWidth);

  useEffect(() => {
    store.setHints(SIDEBAR_ID, {
      minSize: { w: minWidth, h: 0 },
      maxSize: { w: maxWidth, h: 0 },
    });
    store.setHints(CONTENT_ID, { minSize: { w: contentMinWidth, h: 0 } });
  }, [store, minWidth, maxWidth, contentMinWidth]);

  useEffect(() => {
    if (width === undefined || width === widthRef.current) return;
    widthRef.current = width;
    store.patchPlacement(SIDEBAR_ID, { size: { w: width } });
  }, [store, width]);

  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;
  useEffect(
    () =>
      store.events.on('node.placementChanged', () => {
        const next = (store.getPlacement(SIDEBAR_ID)?.size as { w?: number } | undefined)?.w;
        if (typeof next !== 'number' || next === widthRef.current) return;
        widthRef.current = next;
        onWidthChangeRef.current?.(next);
      }),
    [store],
  );

  const chrome = useMemo<ChromeMap>(
    () => ({
      sidebar: () => <div className="lk-trial__sidebar">{sidebar}</div>,
      content: () => (
        <div
          className={
            contentClassName ? `lk-trial__content ${contentClassName}` : 'lk-trial__content'
          }
        >
          {children}
        </div>
      ),
    }),
    [sidebar, children, contentClassName],
  );

  return (
    <Provider store={store}>
      <StrategyRegistryProvider strategies={STRATEGIES}>
        <Container
          parentId={ZONE_ID}
          chrome={chrome}
          className="lk-trial__panes windease-zone"
          affordances
          viewport={viewport}
        />
      </StrategyRegistryProvider>
    </Provider>
  );
}
