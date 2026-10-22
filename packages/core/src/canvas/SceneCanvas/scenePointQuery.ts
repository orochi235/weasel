import { applyToPoint, meanScale, pathContainsPoint } from '@weasel-js/geom';
import type { PickQuery } from 'canvas/pickWalk';
import { findShapeInk, shapeCoversPoint } from 'canvas/NodeShape';
import { toPlane } from 'core/viewport/parallax';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { poseContains, poseContainsRotated } from './poseGeometry';

/** The point query `<SceneCanvas>`'s default pick asks: a world point with
 *  `pickTolerancePx` of screen slop, refined to the painter's ink when
 *  `shapePicking` is on. */
export function scenePointQuery<TPose>(
  d: PoseDescriptor<unknown>,
  shapePicking: boolean,
  pickTolerancePx: number,
): (px: number, py: number, s: { x: number; y: number }) => PickQuery<TPose> {
  // `s` makes the slop a screen distance, so the grab zone stays the same
  // apparent thickness at any zoom and on every axis. A `{ px }` stroke's
  // reach is on screen too, and joins the slop there.
  const pointQuery = (px: number, py: number, s: { x: number; y: number }): PickQuery<TPose> => {
    const scale = meanScale(s);
    const tolerance = { px: pickTolerancePx, scale: s };
    return {
      hits: (n, pose, derived, inherited) => {
        // The pre-filter has to be at least as generous as the refinement
        // that follows it, or it rejects points the refinement would have
        // claimed. A stroke reaches past the pose box by `outset` — a whole
        // stroke width for an outer align — on top of the pointer slop.
        const ink = shapePicking ? findShapeInk(n as never, pose, { scale, inherited }) : null;
        // A derived node's pose is a placeholder — typically zero-sized at
        // the origin — so its own box rejects every point the path covers.
        // The path is the region to test instead, and `poseContains` already
        // reads a path-like pose as one.
        const slop = { ...tolerance, px: tolerance.px + (ink?.outsetPx ?? 0), reach: ink?.outset ?? 0 };
        const admitted = derived
          ? poseContains(derived as never, px, py, slop, d as PoseDescriptor<unknown>)
          : poseContainsRotated(pose, px, py, slop, d as PoseDescriptor<unknown>);
        if (!admitted) return false;
        // `shapeCoversPoint` narrows the rect to the ink the painter actually
        // lays down (and answers `true` for painters that have no silhouette,
        // so nothing becomes unpickable).
        return !shapePicking
          || shapeCoversPoint(n as never, pose, px, py, {
            tolerance, scale, derivedPath: derived, inherited,
          });
      },
      clipAdmits: (clip) => pathContainsPoint(clip, px, py),
      inPlane: (m) => {
        const p = toPlane(m, { x: px, y: py });
        return pointQuery(p.x, p.y, { x: s.x / m.scale.x, y: s.y / m.scale.y });
      },
      inCopy: (m) => {
        const [x, y] = applyToPoint(m, px, py);
        const k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
        return pointQuery(x, y, { x: s.x / k, y: s.y / k });
      },
    };
  };
  return pointQuery;
}
