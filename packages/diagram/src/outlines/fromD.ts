import { pathFromD, transformPath } from '@weasel-js/geom';
import type { Bounds, OutlineDef, Size } from './types';

const unitMatrix = (b: Bounds): [number, number, number, number, number, number] =>
  [b.width, 0, 0, b.height, b.x, b.y];

/** An outline from SVG path data in a unit square — `(0, 0)` the box's
 *  top-left, `(1, 1)` its bottom-right — stretched over each node's bounds.
 *  `content` is in the same unit square. */
export function outlineFromD(d: string, opts: { detail?: string; content?: Bounds } = {}): OutlineDef {
  const path = pathFromD(d);
  const detail = opts.detail === undefined ? undefined : pathFromD(opts.detail);
  const unit = opts.content ?? { x: 0, y: 0, width: 1, height: 1 };
  return {
    path: (b) => transformPath(path, unitMatrix(b)),
    ...(detail ? { detail: (b: Bounds) => transformPath(detail, unitMatrix(b)) } : {}),
    content: (b) => ({
      x: b.x + unit.x * b.width,
      y: b.y + unit.y * b.height,
      width: unit.width * b.width,
      height: unit.height * b.height,
    }),
    boxForContent: (c: Size) => ({ width: c.width / unit.width, height: c.height / unit.height }),
  };
}
