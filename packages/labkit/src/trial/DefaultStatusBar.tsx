import { StatusBar } from '../primitives/StatusBar';
import { formatZoom } from '../ui/format';
import type { TrialStatusBarContext } from './slotTypes';

/** Props for `<DefaultStatusBar>`. */
export interface DefaultStatusBarProps {
  ctx: TrialStatusBarContext;
}

/** The status bar a trial renders when no `statusBar` slot is supplied:
 *  the instrument's name, and the zoom when the trial's view has one. */
export function DefaultStatusBar({ ctx }: DefaultStatusBarProps) {
  return (
    <StatusBar>
      <StatusBar.Section>{ctx.instrumentName}</StatusBar.Section>
      {ctx.zoom === null ? null : <StatusBar.Section>{formatZoom(ctx.zoom)}</StatusBar.Section>}
    </StatusBar>
  );
}
