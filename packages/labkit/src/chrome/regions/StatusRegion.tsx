import { StatusBar, StatusBarItem, StatusBarSpacer } from '@weasel-js/ui';
import { Fragment, type ReactNode } from 'react';
import type { RegionContribution, StatusReadout, TrialChromeContext } from '../types';

/** Props for `<StatusRegion>`. */
export interface StatusRegionProps<TCtx = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's readouts to lay out; the lab's footer is `footer`. */
  region?: string;
}

/** Lays a bar's readouts out. The first one marked `end`, and every one after
 *  it, sits at the far end. */
export function StatusRegion<TCtx = TrialChromeContext>({
  contributions,
  ctx,
  region = 'status',
}: StatusRegionProps<TCtx>) {
  if (contributions.length === 0) return null;
  let spaced = false;
  return (
    <StatusBar divided>
      {contributions.map((c) => {
        let body: ReactNode;
        let title: string | undefined;
        if (c.render) body = c.render(ctx);
        else if (c.region === region && c.item) {
          const item = c.item as StatusReadout;
          body = item.text;
          title = item.title;
        } else return null;
        const spacer = c.end && !spaced;
        if (spacer) spaced = true;
        return (
          <Fragment key={c.id}>
            {spacer && <StatusBarSpacer />}
            <StatusBarItem title={title}>{body}</StatusBarItem>
          </Fragment>
        );
      })}
    </StatusBar>
  );
}
