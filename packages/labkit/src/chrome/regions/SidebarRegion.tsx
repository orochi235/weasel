import type { ReactNode } from 'react';
import type {
  RegionContribution,
  SidebarSection,
  SidebarSlotContext,
  TrialChromeContext,
} from '../types';

/** Props for `<SidebarRegion>`. */
export interface SidebarRegionProps<TCtx extends SidebarSlotContext = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's items to lay out. */
  region?: string;
}

function Section({
  title,
  collapsed,
  onCollapsedChange,
  onUndock,
  children,
}: {
  title: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onUndock?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="lk-sidebar-section">
      <div className="lk-sidebar-section__bar">
        <button
          type="button"
          className="lk-sidebar-section__head"
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {title}
        </button>
        {onUndock ? (
          <button
            type="button"
            className="lk-sidebar-section__undock"
            aria-label={`Undock ${title}`}
            title={`Undock ${title}`}
            onClick={onUndock}
          >
            ⧉
          </button>
        ) : null}
      </div>
      {collapsed ? null : <div className="lk-sidebar-section__body">{children}</div>}
    </section>
  );
}

/** Lays `sidebar` contributions out as titled, collapsible sections — a
 *  trial's, or the lab's. A section the trial has torn out is not rendered
 *  here — `Trial` portals its body into the workspace instead. A context with
 *  no `undockPanel` offers no tear-out. */
export function SidebarRegion<TCtx extends SidebarSlotContext = TrialChromeContext>({
  contributions,
  ctx,
  region = 'sidebar',
}: SidebarRegionProps<TCtx>) {
  if (contributions.length === 0) return null;
  return (
    <>
      {contributions.map((c) => {
        if (c.render) return <div key={c.id}>{c.render(ctx)}</div>;
        if (c.region !== region || !c.item) return null;
        if (ctx.undockedPanels?.includes(c.id)) return null;
        const item = c.item as SidebarSection;
        return (
          <Section
            key={c.id}
            title={item.title}
            collapsed={ctx.collapsedSections[c.id] ?? item.defaultCollapsed ?? false}
            onCollapsedChange={(next) => ctx.setSectionCollapsed(c.id, next)}
            onUndock={
              ctx.undockPanel && item.undockable !== false
                ? () => ctx.undockPanel?.(c.id, item.undockAs ?? 'tile')
                : undefined
            }
          >
            {item.body}
          </Section>
        );
      })}
    </>
  );
}
