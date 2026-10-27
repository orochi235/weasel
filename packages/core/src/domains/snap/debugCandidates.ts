import { closestOnFlat, type SnapCandidate } from '@weasel-js/geom/nd';
import type { DebugSink } from '@weasel-js/routing';
import { fromPlane, type PlaneMap } from 'core/viewport/parallax';
import type { SnapProbeAt } from './types';
import type { Point } from '@weasel-js/geom';

/** Replaces the sink's snap records with one frame's candidates: where each
 *  would put its probe, accepted when the result meets it. Camera world. */
export function recordSnapCandidates(
  debug: DebugSink,
  candidates: readonly SnapCandidate<unknown>[],
  satisfied: readonly SnapCandidate<unknown>[],
  probes: readonly SnapProbeAt[],
  delta0: Point,
  plane: PlaneMap | null,
): void {
  debug.clearSnap();
  const met = new Set(satisfied);
  const at = new Map(probes.map((q) => [q.id, [q.at.x + delta0.x, q.at.y + delta0.y]]));
  for (const c of candidates) {
    const p = at.get(c.probe);
    if (!p) continue;
    const [x, y] = closestOnFlat(c.locus, p);
    debug.recordSnapCandidate(plane ? fromPlane(plane, { x, y }) : { x, y }, met.has(c));
  }
}
