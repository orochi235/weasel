import { boundsOfPath } from './bounds';
import { translatePath } from './transform';
import type { Path } from './types';
import type { OriginProjection } from 'interactions/gestures/shared/strategies/grid';

/**
 * `OriginProjection` for `Path` poses. The "origin" is the top-left of the
 * path's AABB; `translate` shifts every coord by the requested delta. Pair
 * with `gridSnapStrategy` to grid-snap a Path's bounds top-left:
 *
 *     gridSnapStrategy<Path>(20, { origin: pathOriginProjection })
 */
export const pathOriginProjection: OriginProjection<Path> = {
  getOrigin: (path) => {
    const b = boundsOfPath(path);
    return { x: b.x, y: b.y };
  },
  translate: translatePath,
};
