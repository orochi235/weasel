import type { Affine, Path } from '@weasel-js/geom';
import type { PickCandidate, PickQuery } from './pickWalk';
import type { InheritedPaint } from 'core/scene/inheritedPaint';

/** What {@link reaches} needs from the walk, each memoized per walk there. */
export interface ReachLookups<TPose> {
  /** An ancestor's own clip, or null. */
  clipOf(ancestor: PickCandidate<TPose>): Path | null;
  /** The maps from world into the source frame of each copy `ancestor` draws:
   *  the inverses of its `copiesFromPose`. Empty when it draws none. */
  copiesOf(ancestor: PickCandidate<TPose>): readonly Affine[];
  /** A clip carried from its container's plane into the node's. */
  carry(clip: Path, fromLayer: string | undefined, toLayer: string | undefined): Path;
}

/**
 * Whether `q` lands on `node` anywhere it is painted: as authored, or in any
 * copy an ancestor draws of it. `parents` is innermost first.
 *
 * A copy is the clipped content transformed, so the query is carried into the
 * copy's source frame before the copying container's own clip is asked, and
 * every clip below it is asked in that frame too.
 *
 * `parents` is called only when the answer needs it — always when
 * `copying` says some container in the walk draws copies, otherwise only
 * after the node hits as authored.
 */
export function reaches<TPose>(
  node: PickCandidate<TPose>,
  pose: TPose,
  derived: Path | null | undefined,
  inherited: InheritedPaint | undefined,
  q: PickQuery<TPose>,
  parentsOf: () => readonly PickCandidate<TPose>[],
  copying: boolean,
  look: ReachLookups<TPose>,
): boolean {
  const admits = (query: PickQuery<TPose>, ancestor: PickCandidate<TPose>): boolean => {
    const clip = look.clipOf(ancestor);
    return clip === null
      || query.clipAdmits(look.carry(clip, ancestor.layer, node.layer), node, pose, derived);
  };

  const parents = copying && q.inCopy !== undefined ? parentsOf() : null;
  if (parents === null || !parents.some((a) => look.copiesOf(a).length > 0)) {
    if (!q.hits(node, pose, derived, inherited)) return false;
    return (parents ?? parentsOf()).every((a) => admits(q, a));
  }

  const outermostFirst = [...parents].reverse();
  const from = (i: number, query: PickQuery<TPose>): boolean => {
    if (i === outermostFirst.length) return query.hits(node, pose, derived, inherited);
    const ancestor = outermostFirst[i];
    if (admits(query, ancestor) && from(i + 1, query)) return true;
    for (const m of look.copiesOf(ancestor)) {
      const inCopy = query.inCopy?.(m);
      if (inCopy !== undefined && admits(inCopy, ancestor) && from(i + 1, inCopy)) return true;
    }
    return false;
  };
  return from(0, q);
}
