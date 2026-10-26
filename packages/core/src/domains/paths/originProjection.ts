import { boundsOfPath, translatePath, type Path } from '@weasel-js/geom';
import type { OriginProjection } from 'interactions/gestures/shared/originProjection';

/**
 * `OriginProjection` for `Path` poses. The "origin" is the top-left of the
 * path's AABB; `translate` shifts every coord by the requested delta. It is
 * where a snap session puts a Path's `origin` probe, so a grid source snaps a
 * Path's bounds top-left.
 */
export const pathOriginProjection: OriginProjection<Path> = {
  getOrigin: (path) => {
    const b = boundsOfPath(path);
    return { x: b.x, y: b.y };
  },
  translate: translatePath,
};
