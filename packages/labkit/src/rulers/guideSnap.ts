import {
  createBareSnapSession,
  DEFAULT_SNAP_PX,
  gatherSnapCandidates,
  resolvedSnapMarks,
  resolveHolding,
  type SnapDep,
  type SnapMods,
  type SnapSource,
  snapSourcesFor,
  type View,
} from '@weasel-js/core';
import { resolveSnap } from '@weasel-js/geom/nd';
import type { Point } from '../instrument/types';

/** Snapping with no mode held. */
export const FREE_SNAP: SnapMods = { suspend: false, constrain: false };

const PLANE = {
  at: [0, 0],
  dirs: [
    [1, 0],
    [0, 1],
  ],
};

/**
 * A `snap` dep for a camera with no scene, built on core's gather and resolve:
 * a `point` gesture lands on what `sources` offer within reach of the pointer,
 * measured through `view`; any other gesture lands where it is. Points are in
 * the camera's world.
 */
export function createPointSnapDep(
  sources: readonly SnapSource[],
  view: () => View | null,
): SnapDep {
  return {
    begin(req) {
      const asked = snapSourcesFor(sources, req.gesture);
      if (req.gesture !== 'point' || asked.length === 0) return createBareSnapSession(req);
      const exclude = req.exclude ?? req.ids ?? [];
      return {
        at(p: Point, mods: SnapMods) {
          const unsnapped = { point: p, held: false, marks: [] };
          const v = view();
          if (mods.suspend || !v) return unsnapped;
          const scale = Math.min(Math.abs(v.scale.x), Math.abs(v.scale.y));
          const probe = { id: 'pointer', at: p, role: 'pointer' as const };
          const candidates = gatherSnapCandidates(
            asked,
            [probe],
            (_source, offered, reachPx) => ({
              gesture: 'point',
              probes: offered,
              delta0: { x: 0, y: 0 },
              exclude,
              reachWorld: (px) => px / scale,
              reachPx,
            }),
            { toVec: (q) => [q.x, q.y], reachPx: DEFAULT_SNAP_PX },
          );
          const res = resolveHolding(
            candidates,
            (kept) =>
              resolveSnap({
                probes: [{ id: probe.id, at: [p.x, p.y], role: probe.role }],
                input: PLANE,
                delta0: [0, 0],
                candidates: kept,
                toScreen: ([x = 0, y = 0]) => [(x - v.x) * v.scale.x, (y - v.y) * v.scale.y],
              }),
            (d) => ({ x: d[0] ?? 0, y: d[1] ?? 0 }),
          );
          const delta = { x: res.delta[0] ?? 0, y: res.delta[1] ?? 0 };
          return {
            point: { x: p.x + delta.x, y: p.y + delta.y },
            held: res.members.length > 0,
            marks: resolvedSnapMarks(res.satisfied, delta),
          };
        },
        angle: (theta) => ({ theta, marks: [] }),
        end: () => {},
      };
    },
  };
}
