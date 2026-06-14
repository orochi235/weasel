import { ControlPanel } from '../controls/ControlPanel';
import { Sidebar } from '../primitives/Sidebar';
import type { WorkspaceSidebarContext } from './slotTypes';

export interface DefaultSidebarProps {
  ctx: WorkspaceSidebarContext;
}

export function DefaultSidebar({ ctx }: DefaultSidebarProps) {
  if (ctx.configFields.length === 0) {
    return (
      <Sidebar title={ctx.instrumentName}>
        <div className="lk-sidebar__placeholder">{ctx.instrumentName} has no config fields.</div>
      </Sidebar>
    );
  }
  return (
    <Sidebar title={ctx.instrumentName}>
      <ControlPanel
        fields={ctx.configFields}
        config={ctx.config as Record<string, unknown>}
        setConfig={(key, value) => ctx.setConfig(key as string, value)}
      />
    </Sidebar>
  );
}
