import { StatusBar } from '../primitives/StatusBar';
import type { WorkspaceStatusBarContext } from './slotTypes';

export interface DefaultStatusBarProps {
  ctx: WorkspaceStatusBarContext;
}

export function DefaultStatusBar({ ctx }: DefaultStatusBarProps) {
  return (
    <StatusBar>
      <StatusBar.Section>{ctx.instrumentName}</StatusBar.Section>
      <StatusBar.Section>{Math.round(ctx.zoom * 100)}%</StatusBar.Section>
    </StatusBar>
  );
}
