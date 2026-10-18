import type { SnapCandidate, Vec } from '@weasel-js/geom/nd';
import { distinct } from './marks';
import type { SnapCollect, SnapMark, SnapProbeAt, SnapSource, SourceCandidate } from './types';

/** What a candidate draws when the result meets it. */
export type SnapCandidateMark<P> = NonNullable<SourceCandidate<P>['mark']>;

/** How near `origin` a point target counts as on it, relative to its magnitude. */
const ORIGIN_EPS = 1e-9;

/** How `gatherSnapCandidates` reads a host's points. */
export interface GatherSnapOptions<P> {
  /** `p` as a resolver tuple. */
  toVec(p: P): Vec;
  /** The reach of a source that sets none, in screen px. */
  reachPx: number;
  /** Where the geometry being drawn starts: no point target on it is offered. */
  origin?: P;
}

/**
 * One frame's resolver candidates: each source is asked, through `ask`, about
 * the probes whose role it matches and the reach that applies to it (its
 * own `reachPx`, else `opts.reachPx`), and what it answers for a probe it was
 * not offered, or a point on `origin`, is dropped. Sources run in order, and
 * an earlier source, then an earlier yield, wins a full tie. The building
 * block of a host's own snap session over `resolveSnap`.
 */
export function gatherSnapCandidates<P>(
  sources: readonly SnapSource<P>[],
  probes: readonly SnapProbeAt<P>[],
  ask: (source: SnapSource<P>, offered: SnapProbeAt<P>[], reachPx: number) => SnapCollect<P>,
  opts: GatherSnapOptions<P>,
): SnapCandidate<SnapCandidateMark<P>>[] {
  const origin = opts.origin === undefined ? null : opts.toVec(opts.origin);
  const out: SnapCandidate<SnapCandidateMark<P>>[] = [];
  let order = 0;
  for (const source of sources) {
    const offered = probes.filter((q) => source.roles.includes(q.role));
    if (offered.length === 0) continue;
    const ids = new Set(offered.map((q) => q.id));
    const reachPx = source.reachPx ?? opts.reachPx;
    for (const c of source.collect(ask(source, offered, reachPx))) {
      if (!ids.has(c.probe)) continue;
      const at = opts.toVec(c.locus.at);
      if (origin && c.locus.dirs.length === 0 && same(at, origin)) continue;
      out.push({
        probe: c.probe, locus: { at, dirs: c.locus.dirs.map(opts.toVec) },
        ...(c.locus.span ? { span: c.locus.span } : {}),
        source: source.id, order: order++, tier: source.tier ?? 'target', reachPx,
        ...(c.required ? { required: true } : {}),
        ...(c.mark ? { mark: c.mark } : {}),
      });
    }
  }
  return out;
}

function same(a: Vec, b: Vec): boolean {
  const eps = ORIGIN_EPS * Math.max(1, ...b.map(Math.abs));
  return a.every((v, i) => Math.abs(v - b[i]) <= eps);
}

/** The marks of the candidates a result meets, with `delta` the resolved
 *  move, and repeats dropped so a target several probes meet is drawn once. */
export function resolvedSnapMarks<P>(
  satisfied: readonly { mark?: SnapCandidateMark<P> }[], delta: P,
): SnapMark<P>[] {
  return distinct(satisfied.flatMap((c) => marksOf(c.mark, delta)));
}

function marksOf<P>(mark: SnapCandidateMark<P> | undefined, delta: P): readonly SnapMark<P>[] {
  if (!mark) return [];
  const m = typeof mark === 'function' ? mark(delta) : mark;
  return 'kind' in m ? [m as SnapMark<P>] : (m as readonly SnapMark<P>[]);
}
