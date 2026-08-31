import type { ReactNode } from 'react';
import { useState } from 'react';
import type { SidebarSection, TrialChromeContext, TrialContribution } from '../types';

/** Props for `<SidebarRegion>`. */
export interface SidebarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

function Section({
  title,
  defaultCollapsed,
  onUndock,
  children,
}: {
  title: string;
  defaultCollapsed: boolean;
  onUndock?: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <section className="lk-sidebar-section">
      <div className="lk-sidebar-section__bar">
        <button
          type="button"
          className="lk-sidebar-section__head"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
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

/** Lays a trial's `sidebar` contributions out as titled, collapsible sections.
 *  A section the trial has torn out is not rendered here — `Trial` portals its
 *  body into the workspace instead. */
export function SidebarRegion({ contributions, ctx }: SidebarRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <>
      {contributions.map((c) => {
        if (c.render) return <div key={c.id}>{c.render(ctx)}</div>;
        if (c.region !== 'sidebar' || !c.item) return null;
        if (ctx.undockedPanels.includes(c.id)) return null;
        const item = c.item as SidebarSection;
        return (
          <Section
            key={c.id}
            title={item.title}
            defaultCollapsed={item.defaultCollapsed ?? false}
            onUndock={
              item.undockable === false
                ? undefined
                : () => ctx.undockPanel(c.id, item.undockAs ?? 'tile')
            }
          >
            {item.body}
          </Section>
        );
      })}
    </>
  );
}
