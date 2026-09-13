import { StatusBar } from '../../primitives/StatusBar';
import type { RegionContribution, StatusReadout, TrialChromeContext } from '../types';

/** Props for `<StatusRegion>`. */
export interface StatusRegionProps<TCtx = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's readouts to lay out; the lab's footer is `footer`. */
  region?: string;
}

/** Lays a bar's readouts out. */
export function StatusRegion<TCtx = TrialChromeContext>({
  contributions,
  ctx,
  region = 'status',
}: StatusRegionProps<TCtx>) {
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
        if (c.region !== region || !c.item) return null;
        const item = c.item as StatusReadout;
        return (
          <StatusBar.Section key={c.id} end={c.end}>
            <span title={item.title}>{item.text}</span>
          </StatusBar.Section>
        );
      })}
    </StatusBar>
  );
}
