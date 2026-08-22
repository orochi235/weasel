import { StatusBar } from '../primitives/StatusBar';
import { formatZoom } from '../ui/format';
import type { WorkspaceStatusBarContext } from './slotTypes';

/** Props for `<DefaultStatusBar>`. */
export interface DefaultStatusBarProps {
  ctx: WorkspaceStatusBarContext;
}

/** The status bar a workspace renders when no `statusBar` slot is supplied:
 *  the instrument's name and the current zoom. */
export function DefaultStatusBar({ ctx }: DefaultStatusBarProps) {
  return (
    <StatusBar>
      <StatusBar.Section>{ctx.instrumentName}</StatusBar.Section>
      <StatusBar.Section>{formatZoom(ctx.zoom)}</StatusBar.Section>
    </StatusBar>
  );
}
