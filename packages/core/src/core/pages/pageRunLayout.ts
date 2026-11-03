import type { LayoutStrategy } from '../../layout/types';
import type { RectPose } from '../scene/types';
import { layoutPages } from './pages';

/** Registry key for {@link pageRunLayout}'s strategy. */
export const PAGE_RUN = 'core:pageRun';

/**
 * The page run's layout: its page children in child order, placed by
 * `layoutPages` from the run's own corner, with the direction, gap and align
 * its `pageRun` field states. A child that is not a page, such as a connector
 * following content on two pages, is left where it is. Nothing is dropped
 * into the run by a drag; page order changes through the page edits.
 */
export const PAGE_RUN_LAYOUT: LayoutStrategy<RectPose> = {
  childPoses(container, children) {
    const pages = children.filter((c) => c.node?.page !== undefined);
    const placed = layoutPages(
      pages.map((c) => ({ id: c.id, width: c.pose.width, height: c.pose.height })),
      { ...container.node?.pageRun, origin: { x: container.bounds.x, y: container.bounds.y } },
    );
    return new Map(placed.map((p, i) => [p.id, { ...pages[i]!.pose, x: p.x, y: p.y }]));
  },
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
  commitDrop: () => [],
  snap: { pickTarget: () => null },
};

/** The strategy every page run declares. One value, so it serializes under {@link PAGE_RUN}. */
export function pageRunLayout(): LayoutStrategy<RectPose> {
  return PAGE_RUN_LAYOUT;
}
