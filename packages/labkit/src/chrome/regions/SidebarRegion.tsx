import type { AppearanceProps } from '@weasel-js/ui/appearance';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { ReactNode, Ref } from 'react';
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

/** A section's undock or dock control, for the trailing edge of its bar. */
export function DockButton({
  title,
  dock,
  onPress,
}: {
  title: string;
  dock: boolean;
  onPress: () => void;
}) {
  const label = `${dock ? 'Dock' : 'Undock'} ${title}`;
  return (
    <button
      type="button"
      className="lk-sidebar-section__dock"
      aria-label={label}
      title={label}
      onClick={onPress}
    >
      {dock ? '⇤' : '⧉'}
    </button>
  );
}

/** One titled section: its bar, and its body while it is open. Given no
 *  `onCollapsedChange`, it does not fold. */
export function Section({
  title,
  collapsed = false,
  onCollapsedChange,
  trailing,
  actions,
  fill,
  children,
  barRef,
  ...appearance
}: AppearanceProps & {
  title: string;
  barRef?: Ref<HTMLDivElement>;
  actions?: ReactNode;
  trailing?: ReactNode;
  fill?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  children: ReactNode;
}) {
  return (
    <SidebarPanel
      {...appearance}
      className="lk-sidebar-section"
      headerClassName="lk-sidebar-section__bar"
      titleClassName="lk-sidebar-section__head"
      bodyClassName="lk-sidebar-section__body"
      headerRef={barRef}
      title={title}
      collapsed={collapsed}
      onToggleCollapse={onCollapsedChange && (() => onCollapsedChange(!collapsed))}
      actions={actions && !collapsed ? actions : undefined}
      trailing={trailing}
      fill={fill}
    >
      {children}
    </SidebarPanel>
  );
}

/** A docked section's undock control, or nothing where the context offers no tear-out. */
export function undockButton(ctx: SidebarSlotContext, id: string, item: SidebarSection): ReactNode {
  const { undockPanel } = ctx;
  if (!undockPanel || item.undockable === false) return undefined;
  return (
    <DockButton
      title={item.title}
      dock={false}
      onPress={() => undockPanel(id, item.undockAs ?? 'tile')}
    />
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
            stance={item.stance}
            grade={item.grade}
            emphasis={item.emphasis}
            tint={item.tint}
            actions={item.actions}
            fill={item.fill}
            collapsed={ctx.collapsedSections[c.id] ?? item.defaultCollapsed ?? false}
            onCollapsedChange={(next) => ctx.setSectionCollapsed(c.id, next)}
            trailing={undockButton(ctx, c.id, item)}
          >
            {item.body}
          </Section>
        );
      })}
    </>
  );
}
