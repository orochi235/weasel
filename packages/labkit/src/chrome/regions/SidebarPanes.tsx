import { getOwn } from '@weasel-js/registry';
import { type RefCallback, useCallback, useMemo, useState } from 'react';
import { asNodeId, stripStrategy } from 'windease';
import { Panel, Provider, StrategyRegistryProvider, Zone } from 'windease/react';
import type {
  RegionContribution,
  SidebarSection,
  SidebarSlotContext,
  TrialChromeContext,
} from '../types';
import { inLayoutOrder } from './groupsOf';
import { Section, type SidebarRegionProps, sectionProps, undockButton } from './SidebarRegion';

const STRATEGIES = { strip: stripStrategy as never };
const CONFIG = { axis: 'y', resizable: true, fill: true };
/** How short a drag may make an open section. */
const FLOOR = 96;
const UNCAPPED = 1e6;
/** How far past its bar a seam drags a folded section before the section opens. */
const UNFOLD_SLOP = 4;
/** A section bar's height until one is on the page to measure. */
const BAR = 32;

const FREE = {};

/**
 * The section bars' height, and the ref each bar takes. A bar is watched from the commit that mounts it to the one
 * that removes it: windease remounts panels on renders of its own, and an observer left on a removed bar reports
 * it shrinking to nothing, which Chrome raises as a ResizeObserver loop error.
 */
function useBarHeight(): [number, RefCallback<HTMLDivElement>] {
  const [bar, setBar] = useState(BAR);
  const [observer] = useState(() =>
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver((entries) => {
          const h = Math.round(entries.at(-1)?.target.getBoundingClientRect().height ?? 0);
          if (h) setBar(h);
        }),
  );
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const h = Math.round(el.getBoundingClientRect().height);
      if (h) setBar(h);
      observer?.observe(el);
      return () => observer?.unobserve(el);
    },
    [observer],
  );
  return [bar, ref];
}

/** One contribution as a pane of the stack. */
function Pane<TCtx extends SidebarSlotContext>({
  contribution: c,
  ctx,
  order,
  bar,
  barRef,
  collapsed,
  fills,
  height,
  onHeight,
  openNext,
}: {
  contribution: RegionContribution<TCtx>;
  ctx: TCtx;
  order: number;
  bar: number;
  barRef: RefCallback<HTMLDivElement>;
  collapsed: boolean;
  /** Takes the height the other panes leave, whatever a seam last gave it. */
  fills: boolean;
  height: number | undefined;
  onHeight: (height: number) => void;
  /** Opens the folded section after this one, when this one fills: the height its seam gives up has to go there. */
  openNext: (() => void) | undefined;
}) {
  const id = asNodeId(`lk-pane-${c.id}`);
  const h = c.render
    ? undefined
    : collapsed
      ? bar
      : fills || height === undefined
        ? undefined
        : Math.max(FLOOR, height);
  // Held steady between renders: the preset reconciles a new object into the store.
  const placement = useMemo(() => ({ size: h === undefined ? {} : { h } }), [h]);
  // A folded pane may grow, so a seam beside it can drag it open; its placement holds it at its bar until then.
  const hints = useMemo(
    () => ({ minSize: { w: 0, h: collapsed ? bar : FLOOR }, maxSize: { w: 0, h: UNCAPPED } }),
    [collapsed, bar],
  );
  const item = c.item as SidebarSection | undefined;
  // Names the pane, and through it the seam under it.
  const meta = useMemo(() => ({ title: item?.title }), [item?.title]);
  if (c.render || !item) {
    return (
      <Panel id={id} order={order} placement={FREE} hints={hints}>
        <div className="lk-sidebar-panes__free">{c.render?.(ctx)}</div>
      </Panel>
    );
  }
  return (
    <Panel
      id={id}
      order={order}
      meta={meta}
      placement={placement}
      hints={hints}
      onPlacementChange={(next) => {
        const dragged = (next.size as { h?: number } | undefined)?.h;
        if (typeof dragged !== 'number') return;
        if (collapsed) {
          if (dragged <= bar + UNFOLD_SLOP) return;
          ctx.setSectionCollapsed(c.id, false);
          onHeight(dragged);
        } else {
          // Kept for the filling pane too: it reads its height again once another pane takes over filling.
          if (dragged !== height) onHeight(dragged);
          if (fills) openNext?.();
        }
      }}
    >
      <Section
        barRef={barRef}
        {...sectionProps(item)}
        collapsed={collapsed}
        onCollapsedChange={(next) => ctx.setSectionCollapsed(c.id, next)}
        trailing={undockButton(ctx, c.id, item)}
      >
        {item.body}
      </Section>
    </Panel>
  );
}

/** Props for `<SidebarPanes>`. */
export interface SidebarPanesProps<TCtx extends SidebarSlotContext = TrialChromeContext>
  extends SidebarRegionProps<TCtx> {
  /** The height in pixels a seam has given each section, by contribution id. */
  heights?: Readonly<Record<string, number>>;
  /** Fires through a seam's drag with every height, the dragged one changed. */
  onHeightsChange?: (heights: Record<string, number>) => void;
  /**
   * Fixed extent. Omit in an app — the stack measures its own box. Supply it
   * where nothing measures, notably jsdom, or every pane lays out at zero.
   */
  viewport?: { w: number; h: number };
}

/**
 * Lays a region's sections out as a stack of panes that share the height of the
 * pane holding them, with a draggable seam between each two. A section's bar
 * stays put and its body scrolls under it; a folded section is as tall as its
 * bar. The first open section that fills, else the last open one, takes whatever height the others leave.
 */
export function SidebarPanes<TCtx extends SidebarSlotContext = TrialChromeContext>({
  contributions,
  ctx,
  region = 'sidebar',
  heights = {},
  onHeightsChange,
  viewport,
}: SidebarPanesProps<TCtx>) {
  // Measured as it changes: a density switch resizes the bars without rendering this.
  const [bar, barRef] = useBarHeight();

  const shown = inLayoutOrder(contributions).filter(
    (c: RegionContribution<TCtx>) =>
      c.render || (c.region === region && c.item && !ctx.undockedPanels?.includes(c.id)),
  );
  if (shown.length === 0) return null;
  const folded = (c: RegionContribution<TCtx>) =>
    getOwn(ctx.collapsedSections, c.id) ?? (c.item as SidebarSection).defaultCollapsed ?? false;
  const open = shown.filter((c) => !c.render && !folded(c));
  const filler = (open.find((c) => (c.item as SidebarSection).fill) ?? open.at(-1))?.id;
  const foldedAfter = (order: number): (() => void) | undefined => {
    const next = shown[order + 1];
    return next && !next.render && folded(next)
      ? () => ctx.setSectionCollapsed(next.id, false)
      : undefined;
  };

  return (
    <div className="lk-sidebar-panes">
      <Provider>
        <StrategyRegistryProvider strategies={STRATEGIES}>
          <Zone
            id={asNodeId(`lk-panes-${region}`)}
            strategyId="strip"
            config={CONFIG}
            className="lk-sidebar-panes__zone windease-zone"
            affordances
            viewport={viewport}
          >
            {shown.map((c, order) => (
              <Pane
                key={c.id}
                contribution={c}
                ctx={ctx}
                order={order}
                bar={bar}
                barRef={barRef}
                collapsed={!c.render && folded(c)}
                fills={c.id === filler}
                height={getOwn(heights, c.id)}
                onHeight={(h) => onHeightsChange?.({ ...heights, [c.id]: h })}
                openNext={foldedAfter(order)}
              />
            ))}
          </Zone>
        </StrategyRegistryProvider>
      </Provider>
    </div>
  );
}
