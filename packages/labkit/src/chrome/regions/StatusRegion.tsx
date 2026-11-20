import { Bar } from '@weasel-js/ui/components/Bar';
import { Fragment, type ReactNode } from 'react';
import type { RegionContribution, StatusReadout, TrialChromeContext } from '../types';
import { groupsOf } from './groupsOf';

/** Props for `<StatusRegion>`. */
export interface StatusRegionProps<TCtx = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's readouts to lay out; the lab's footer is `footer`. */
  region?: string;
  className?: string;
}

/** Lays a bar's readouts out, grouped by their `group`. Groups marked `end`
 *  sit past one spacer at the far end. */
export function StatusRegion<TCtx = TrialChromeContext>({
  contributions,
  ctx,
  region = 'status',
  className,
}: StatusRegionProps<TCtx>) {
  if (contributions.length === 0) return null;
  const shows = (c: RegionContribution<NoInfer<TCtx>>): boolean =>
    !!c.render || (c.region === region && !!c.item);
  const groups = groupsOf(contributions);
  const firstEnd = groups
    .filter((g) => g.end)
    .flatMap((g) => g.entries)
    .find(shows);
  return (
    <Bar framed="status" divided className={className}>
      {groups
        .flatMap((g) => g.entries)
        .map((c) => {
          let body: ReactNode;
          let title: string | undefined;
          if (c.render) body = c.render(ctx);
          else if (c.region === region && c.item) {
            const item = c.item as StatusReadout;
            body = item.text;
            title = item.title;
          } else return null;
          const spacer = c === firstEnd;
          return (
            <Fragment key={c.id}>
              {spacer && <Bar.Spacer />}
              <Bar.Readout title={title}>{body}</Bar.Readout>
            </Fragment>
          );
        })}
    </Bar>
  );
}
