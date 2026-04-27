import { Sidebar } from '../primitives/Sidebar';
import type { WorkspaceSidebarContext } from './slotTypes';

export interface DefaultSidebarProps {
  ctx: WorkspaceSidebarContext;
}

export function DefaultSidebar({ ctx }: DefaultSidebarProps) {
  return (
    <Sidebar title={ctx.instrumentName}>
      <div className="lk-sidebar__placeholder">
        {ctx.instrumentName} controls (coming in Plan 4)
      </div>
    </Sidebar>
  );
}
