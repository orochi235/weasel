import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<SidebarRegion>`. */
export interface SidebarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

function Section({
  title,
  defaultCollapsed,
  children,
}: {
  title: string;
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <section className="lk-sidebar-section">
      <button
        type="button"
        className="lk-sidebar-section__head"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        {title}
      </button>
      {collapsed ? null : <div className="lk-sidebar-section__body">{children}</div>}
    </section>
  );
}

/** Lays a trial's `sidebar` contributions out as titled, collapsible sections. */
export function SidebarRegion({ contributions, ctx }: SidebarRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <>
      {contributions.map((c) => {
        if (c.render) return <div key={c.id}>{c.render(ctx)}</div>;
        if (c.region !== 'sidebar' || !c.item) return null;
        return (
          <Section
            key={c.id}
            title={c.item.title}
            defaultCollapsed={c.item.defaultCollapsed ?? false}
          >
            {c.item.body}
          </Section>
        );
      })}
    </>
  );
}
