import { StatusBar } from '../../primitives/StatusBar';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<StatusRegion>`. */
export interface StatusRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

/** Lays a trial's `status` contributions out as readouts. */
export function StatusRegion({ contributions, ctx }: StatusRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <StatusBar>
      {contributions.map((c) => {
        if (c.render)
          return (
            <StatusBar.Section key={c.id} end={c.end}>
              {c.render(ctx)}
            </StatusBar.Section>
          );
        if (c.region !== 'status' || !c.item) return null;
        return (
          <StatusBar.Section key={c.id} end={c.end}>
            <span title={c.item.title}>{c.item.text}</span>
          </StatusBar.Section>
        );
      })}
    </StatusBar>
  );
}
