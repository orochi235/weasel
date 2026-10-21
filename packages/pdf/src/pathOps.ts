import {
  fillsOpenSubpaths,
  forEachSegment,
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type Path,
  resolveCorners,
} from '@weasel-js/geom';
import type { ContentStream } from './content';

interface Contour {
  ops: [string, number[]][];
  closed: boolean;
}

/**
 * Writes a path's construction operators. `'closed'` leaves out contours with no `Z`,
 * for a fill that does not close open ones.
 */
export function pathOps(out: ContentStream, path: Path, which: 'all' | 'closed'): void {
  if (path.kind === 'rect') {
    out.op('re', path.x, path.y, path.width, path.height);
    return;
  }
  const { commands, coords } = resolveCorners(path);
  const contours: Contour[] = [];
  let cur: Contour | undefined;
  forEachSegment(commands, coords, (cmd, ci, px, py, _i, opens) => {
    if (cmd === PATH_M || opens || !cur) {
      cur = { ops: [], closed: false };
      contours.push(cur);
      if (cmd === PATH_M) {
        cur.ops.push(['m', [coords[ci], coords[ci + 1]]]);
        return;
      }
      cur.ops.push(['m', [px, py]]);
    }
    if (cmd === PATH_L) cur.ops.push(['l', [coords[ci], coords[ci + 1]]]);
    else if (cmd === PATH_C) cur.ops.push(['c', Array.from({ length: 6 }, (_, k) => coords[ci + k])]);
    else if (cmd === PATH_Q) {
      const [qx, qy, x, y] = [coords[ci], coords[ci + 1], coords[ci + 2], coords[ci + 3]];
      cur.ops.push(['c', [px + ((qx - px) * 2) / 3, py + ((qy - py) * 2) / 3, x + ((qx - x) * 2) / 3, y + ((qy - y) * 2) / 3, x, y]]);
    } else if (cmd === PATH_Z) {
      cur.ops.push(['h', []]);
      cur.closed = true;
      cur = undefined;
    }
  });
  for (const c of contours) {
    if (which === 'closed' && !c.closed) continue;
    for (const [op, args] of c.ops) out.op(op, ...args);
  }
}

/** Writes the region a fill of `path` covers, which a clip covers too, and answers whether it is even-odd. */
export function fillPathOps(out: ContentStream, path: Path): boolean {
  const closeOpen = path.kind === 'rect' || fillsOpenSubpaths(path);
  pathOps(out, path, closeOpen ? 'all' : 'closed');
  return path.kind === 'polygon' && path.fillRule === 'evenodd';
}
