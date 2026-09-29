import { isPathLike } from 'interactions/actions/resize/autoPoseDescriptor';
import { boundsOfPath, translatePath, type Path } from '@weasel-js/geom';

/**
 * How a snap reads and moves a pose that doesn't expose `{x,y}` directly
 * (Path, polygon, etc.): `getOrigin` gives the point a snap strategy rounds,
 * and `translate` moves the pose by the resulting delta.
 */
export interface OriginProjection<TPose> {
  getOrigin(pose: TPose): { x: number; y: number };
  translate(pose: TPose, dx: number, dy: number): TPose;
}

/** Identity projection for `TPose extends { x; y }`. */
export const RECT_ORIGIN_PROJECTION: OriginProjection<{ x: number; y: number }> = {
  getOrigin: (p) => ({ x: p.x, y: p.y }),
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
};

/** Per-call dispatch: routes Path-shaped poses to the path origin/translate
 *  helpers and everything else to `RECT_ORIGIN_PROJECTION`. The default for
 *  `snap` and the snap strategies, so consumers with Path TPose don't have to
 *  thread `pathOriginProjection` explicitly. */
export const AUTO_ORIGIN_PROJECTION: OriginProjection<unknown> = {
  getOrigin: (p) => {
    if (isPathLike(p)) {
      const b = boundsOfPath(p as Path);
      return { x: b.x, y: b.y };
    }
    const r = p as { x: number; y: number };
    return { x: r.x, y: r.y };
  },
  translate: (p, dx, dy) => {
    if (isPathLike(p)) return translatePath(p as Path, dx, dy);
    const r = p as { x: number; y: number };
    return { ...r, x: r.x + dx, y: r.y + dy };
  },
};
