import { transformPath, type Affine, type Path } from '@weasel-js/geom';
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
  /** The region every one of `clips` covers. */
  common(clips: readonly Path[]): Path;
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
    let clips: Path[] | null = null;
    for (let i = 0; i < all.length; i++) {
      const clip = clipIn(look, all[i]!, node);
      if (clip === null) continue;
      if (!q.clipAdmits(clip, node, pose, derived)) return false;
      if (q.intersectClips === true) (clips ??= []).push(clip);
    }
    return clips === null || clips.length < 2 || q.clipAdmits(look.common(clips), node, pose, derived);
  }

  // `clips` are the clips met so far, in the frame `query` asks in.
  const outermostFirst = [...parents].reverse();
  const from = (i: number, query: PickQuery<TPose>, clips: readonly Path[]): boolean => {
    if (i === outermostFirst.length) {
      return query.hits(node, pose, derived, inherited)
        && (clips.length < 2 || query.clipAdmits(look.common(clips), node, pose, derived));
    }
    const ancestor = outermostFirst[i]!;
    const clip = clipIn(look, ancestor, node);
    const keep = query.intersectClips === true;
    const admits = (asked: PickQuery<TPose>): boolean => clip === null || asked.clipAdmits(clip, node, pose, derived);
    const met = keep && clip !== null ? [...clips, clip] : clips;
    if (admits(query) && from(i + 1, query, met)) return true;
    for (const m of look.copiesOf(ancestor)) {
      const inCopy = query.inCopy?.(m);
      if (inCopy === undefined || !admits(inCopy)) continue;
      // The clips above the copy are in the frame it is drawn into; the query has moved to its source.
      const carried = keep ? clips.map((c) => transformPath(c, m)) : clips;
      if (from(i + 1, inCopy, keep && clip !== null ? [...carried, clip] : carried)) return true;
    }
    return false;
  };
  return from(0, q, []);
}

/** `ancestor`'s clip carried into `node`'s plane, or null when it clips nothing. */
function clipIn<TPose>(look: ReachLookups<TPose>, ancestor: PickCandidate<TPose>, node: PickCandidate<TPose>): Path | null {
  const clip = look.clipOf(ancestor);
  return clip === null ? null : look.carry(clip, ancestor.layer, node.layer);
}
