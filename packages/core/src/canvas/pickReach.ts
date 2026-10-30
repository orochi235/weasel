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
 * copy an ancestor draws of it. `parentsOf` answers innermost first.
 *
 * A copy is the clipped content transformed, so the query is carried into the
 * copy's source frame before the copying container's own clip is asked, and
 * every clip below it is asked in that frame too.
 *
 * `parentsOf` is called only when the answer needs it — always when
 * `copying` says some container in the walk draws copies, otherwise only
 * after the node hits as authored.
 */
export function reaches<TPose>(
  node: PickCandidate<TPose>,
  pose: TPose,
  derived: Path | null | undefined,
  inherited: InheritedPaint | undefined,
  q: PickQuery<TPose>,
  parentsOf: (node: PickCandidate<TPose>) => readonly PickCandidate<TPose>[],
  copying: boolean,
  look: ReachLookups<TPose>,
): boolean {
  const parents = copying && q.inCopy !== undefined ? parentsOf(node) : null;
  if (parents === null || !parents.some((a) => look.copiesOf(a).length > 0)) {
    if (!q.hits(node, pose, derived, inherited)) return false;
    const all = parents ?? parentsOf(node);
    for (let i = 0; i < all.length; i++) if (!admitsIn(look, q, all[i]!, node, pose, derived)) return false;
    return true;
  }

  const admits = (query: PickQuery<TPose>, ancestor: PickCandidate<TPose>): boolean =>
    admitsIn(look, query, ancestor, node, pose, derived);
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

/** Whether `ancestor`'s clip, carried into `node`'s plane, leaves `query` anything of it. */
function admitsIn<TPose>(
  look: ReachLookups<TPose>,
  query: PickQuery<TPose>,
  ancestor: PickCandidate<TPose>,
  node: PickCandidate<TPose>,
  pose: TPose,
  derived: Path | null | undefined,
): boolean {
  const clip = look.clipOf(ancestor);
  return clip === null
    || query.clipAdmits(look.carry(clip, ancestor.layer, node.layer), node, pose, derived);
}
