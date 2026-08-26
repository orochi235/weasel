import { useState } from 'react';
import { ControlPanel } from '../controls/ControlPanel';
import { Sidebar } from '../primitives/Sidebar';
import type { TrialSidebarContext } from './slotTypes';

/** Props for `<DefaultSidebar>`. */
export interface DefaultSidebarProps {
  ctx: TrialSidebarContext;
}

/** The sidebar a trial renders when no `sidebar` slot is supplied: a
 *  control panel over the instrument's config schema. */
export function DefaultSidebar({ ctx }: DefaultSidebarProps) {
  // `Sidebar` leaves collapse to its caller, and inside a trial the default
  // sidebar is that caller. Local state: which panel is folded is a view
  // preference, not part of the trial the lab persists.
  const [collapsed, setCollapsed] = useState(false);
  const toggle = () => setCollapsed((c) => !c);

  if (ctx.configFields.length === 0) {
    return (
      <Sidebar title={ctx.instrumentName} collapsed={collapsed} onToggle={toggle}>
        <div className="lk-sidebar__placeholder">{ctx.instrumentName} has no config fields.</div>
      </Sidebar>
    );
  }
  return (
    <Sidebar title={ctx.instrumentName} collapsed={collapsed} onToggle={toggle}>
      <ControlPanel
        fields={ctx.configFields}
        config={ctx.config as Record<string, unknown>}
        setConfig={(key, value) => ctx.setConfig(key as string, value)}
      />
    </Sidebar>
  );
}
