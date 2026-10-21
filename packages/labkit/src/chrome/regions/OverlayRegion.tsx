import { Fragment } from 'react';
import { contributionsIn, useLabChromeContext } from '../LabChrome';
import type { LabContribution } from '../labTypes';

/** Props for `<OverlayRegion>`. */
export interface OverlayRegionProps {
  /** The lab's whole contribution list; the `overlay` ones render here. */
  contributions: readonly LabContribution[];
}

function OverlayItems({ items }: { items: readonly LabContribution[] }) {
  const ctx = useLabChromeContext();
  return (
    <>
      {items.map((c) => (
        <Fragment key={c.id}>{c.render?.(ctx)}</Fragment>
      ))}
    </>
  );
}

/** The lab's overlay contributions, over the trials and inside the lab's
 *  surface, so a contribution can paint into its buffers and portal into its
 *  container. Each one lays itself out; the region adds no box. */
export function OverlayRegion({ contributions }: OverlayRegionProps) {
  const items = contributionsIn(contributions, 'overlay');
  return items.length === 0 ? null : <OverlayItems items={items} />;
}
