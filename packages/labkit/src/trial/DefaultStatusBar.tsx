import { StatusBar } from '../primitives/StatusBar';
import { formatZoom } from '../ui/format';
import type { TrialStatusBarContext } from './slotTypes';

/** Props for `<DefaultStatusBar>`. */
export interface DefaultStatusBarProps {
  ctx: TrialStatusBarContext;
}

/** The status bar a trial renders when no `statusBar` slot is supplied: the
 *  zoom, when the trial's view has one. The instrument's name is not repeated
 *  here — the title bar carries the trial's identity. */
export function DefaultStatusBar({ ctx }: DefaultStatusBarProps) {
  return (
    <StatusBar>
      {ctx.zoom === null ? null : <StatusBar.Section>{formatZoom(ctx.zoom)}</StatusBar.Section>}
    </StatusBar>
  );
}
