import type { Path } from '@weasel-js/core/math';
import { pathFromD, transformPath } from '@weasel-js/geom';
import type { Bounds, OutlineDef } from './types';

/** Parse unit-square path data, reporting each command that does not parse and a path that draws nothing.
 *  Returns whether it reported anything, beside the path. */
export function parseUnitD(d: string, onProblem?: (message: string) => void): { path: Path; ok: boolean } {
  let ok = true;
  const path = pathFromD(d, (message) => {
    ok = false;
    onProblem?.(message);
  });
  if (path.kind === 'polygon' && path.commands.length === 0) {
    ok = false;
    onProblem?.('it draws nothing');
  }
  return { path, ok };
}

const strictD = (d: string, what: string): Path => parseUnitD(d, (message) => {
  throw new Error(`outlineFromD: ${what} ${JSON.stringify(d)} does not parse or draws nothing: ${message}`);
}).path;

const unitMatrix = (b: Bounds): [number, number, number, number, number, number] =>
  [b.width, 0, 0, b.height, b.x, b.y];

/** An outline from SVG path data in a unit square — `(0, 0)` the box's
 *  top-left, `(1, 1)` its bottom-right — stretched over each node's bounds.
 *  `content` is in the same unit square. Throws on path data that does not parse or draws nothing, and on a
 *  `content` with no area. */
export function outlineFromD(d: string, opts: { detail?: string; content?: Bounds } = {}): OutlineDef {
  const path = strictD(d, 'path data');
  const detail = opts.detail === undefined ? undefined : strictD(opts.detail, 'detail');
  const unit = opts.content ?? { x: 0, y: 0, width: 1, height: 1 };
  if (!(unit.width > 0 && unit.height > 0 && Number.isFinite(unit.width) && Number.isFinite(unit.height))) {
    throw new RangeError(`outlineFromD: content must have a finite, positive width and height, not ${unit.width}×${unit.height}`);
  }
  return {
    path: (b) => transformPath(path, unitMatrix(b)),
    ...(detail ? { detail: (b: Bounds) => transformPath(detail, unitMatrix(b)) } : {}),
    content: (b) => ({
      x: b.x + unit.x * b.width,
      y: b.y + unit.y * b.height,
      width: unit.width * b.width,
      height: unit.height * b.height,
    }),
    boxForContent: (c: Pick<Bounds, 'width' | 'height'>) => ({ width: c.width / unit.width, height: c.height / unit.height }),
  };
}
