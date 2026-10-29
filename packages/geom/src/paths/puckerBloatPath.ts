/**
 * Pucker or bloat a path: pull its anchors toward the center of its bounds
 * and push its handles away, or the reverse.
 */
import type { Path } from '../path';
import { boundsOfPath } from './bounds';
import { cubicContoursToPath, pathToCubicContours } from './cubicContours';

/** How far a path is puckered or bloated. */
export interface PuckerBloatPathOptions {
  /**
   * A fraction of each handle's distance from the center. Positive bloats:
   * handles move that far away from the center, anchors half as far toward
   * it, so segments bulge outward. Negative puckers: handles move toward the
   * center and anchors away, so the anchors become spikes.
   */
  amount: number;
}

/**
 * `path` puckered or bloated about the center of its bounds. A straight
 * segment moves as a curve with its handles a third of the way along from
 * each end. An `amount` of zero answers `path` itself.
 */
export function puckerBloatPath(path: Path, opts: PuckerBloatPathOptions): Path {
  const { amount } = opts;
  if (!(amount !== 0 && Number.isFinite(amount))) return path;
  const b = boundsOfPath(path);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const handle = (x: number, y: number): [number, number] => [x + (x - cx) * amount, y + (y - cy) * amount];
  const anchor = (x: number, y: number): [number, number] => [x - (x - cx) * amount / 2, y - (y - cy) * amount / 2];
  const contours = pathToCubicContours(path).map(({ segs, closed }) => ({
    closed,
    segs: segs.map(({ c }) => ({
      c: [...anchor(c[0], c[1]), ...handle(c[2], c[3]), ...handle(c[4], c[5]), ...anchor(c[6], c[7])] as typeof c,
      line: false,
    })),
  }));
  return cubicContoursToPath(contours, path.kind === 'polygon' ? path.fillRule : 'nonzero');
}
