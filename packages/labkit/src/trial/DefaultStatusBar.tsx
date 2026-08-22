import { StatusBar } from '../primitives/StatusBar';
import { formatZoom } from '../ui/format';
import type { TrialStatusBarContext } from './slotTypes';

/** Props for `<DefaultStatusBar>`. */
export interface DefaultStatusBarProps {
  ctx: TrialStatusBarContext;
}

/** The status bar a trial renders when no `statusBar` slot is supplied:
 *  the instrument's name and the current zoom. */
export function DefaultStatusBar({ ctx }: DefaultStatusBarProps) {
  return (
    <StatusBar>
      <StatusBar.Section>{ctx.instrumentName}</StatusBar.Section>
      <StatusBar.Section>{formatZoom(ctx.zoom)}</StatusBar.Section>
    </StatusBar>
  );
}
