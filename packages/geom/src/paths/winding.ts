/**
 * Contour orientation: which way a path winds, and the same path wound the
 * other way. Under `'nonzero'` two overlapping contours fill their overlap
 * only when they wind the same way, so composing shapes from different
 * sources into one compound path first needs them to agree.
 */

import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, forEachSegment } from '../commands';
import type { Path, PolygonPath } from '../path';

// Three-point Gauss-Legendre: exact for polynomials up to degree 5, and the
// Green's-theorem integrand of a cubic is degree 5.
const GL_T = [0.5 - Math.sqrt(15) / 10, 0.5, 0.5 + Math.sqrt(15) / 10];
const GL_W = [5 / 18, 8 / 18, 5 / 18];

/**
 * Signed area enclosed by `path`, summed over its contours. Positive for a
 * contour that turns clockwise on a y-down screen (the shoelace sign), so a
 * hole wound against its outer contour subtracts. An open contour counts as
 * closed by a straight edge back to its start, the way a fill closes it.
 * Curved segments are integrated exactly, not through their control polygon.
 * A `RectPath` has no direction and counts as positive.
 */
export function pathSignedArea(path: Path): number {
  if (path.kind === 'rect') return path.width * path.height;
  const { commands, coords } = path;
  let twice = 0;
  let startX = 0, startY = 0;
  let open = false;
  let endX = 0, endY = 0;
  const close = () => {
    if (open) twice += endX * startY - startX * endY;
    open = false;
  };
  forEachSegment(commands, coords, (cmd, ci, px, py) => {
    if (cmd === PATH_M) {
      close();
      startX = endX = coords[ci];
      startY = endY = coords[ci + 1];
      open = true;
      return;
    }
    if (cmd === PATH_Z) { close(); endX = startX; endY = startY; return; }
    if (!open) { startX = px; startY = py; open = true; }
    if (cmd === PATH_L) {
      endX = coords[ci]; endY = coords[ci + 1];
      twice += px * endY - endX * py;
      return;
    }
    const cubic = cmd === PATH_C;
    const x1 = coords[ci], y1 = coords[ci + 1];
    const x2 = coords[ci + 2], y2 = coords[ci + 3];
    const x3 = cubic ? coords[ci + 4] : x2, y3 = cubic ? coords[ci + 5] : y2;
    for (let k = 0; k < 3; k++) {
      const t = GL_T[k], u = 1 - t;
      let x: number, y: number, dx: number, dy: number;
      if (cubic) {
        x = u * u * u * px + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
        y = u * u * u * py + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
        dx = 3 * (u * u * (x1 - px) + 2 * u * t * (x2 - x1) + t * t * (x3 - x2));
        dy = 3 * (u * u * (y1 - py) + 2 * u * t * (y2 - y1) + t * t * (y3 - y2));
      } else {
        x = u * u * px + 2 * u * t * x1 + t * t * x2;
        y = u * u * py + 2 * u * t * y1 + t * t * y2;
        dx = 2 * (u * (x1 - px) + t * (x2 - x1));
        dy = 2 * (u * (y1 - py) + t * (y2 - y1));
      }
      twice += GL_W[k] * (x * dy - y * dx);
    }
    endX = x3; endY = y3;
  });
  close();
  return twice / 2;
}

interface Segment {
  cmd: number;
  /** Control points followed by the end point, as the command stores them. */
  args: number[];
  fromX: number;
  fromY: number;
}

/**
 * `path` with every contour traversed backwards: same region, same curves,
 * opposite winding. A closed contour keeps its starting point; an open one
 * starts from where it used to end.
 */
export function reversePath(path: PolygonPath): PolygonPath {
  const cmds: number[] = [];
  const out: number[] = [];
  let segs: Segment[] = [];
  let sx = 0, sy = 0;
  let started = false;

  const flush = (closed: boolean) => {
    if (!started) return;
    const last = segs[segs.length - 1];
    const ex = last ? last.args[last.args.length - 2] : sx;
    const ey = last ? last.args[last.args.length - 1] : sy;
    if (closed) {
      cmds.push(PATH_M); out.push(sx, sy);
      if (ex !== sx || ey !== sy) { cmds.push(PATH_L); out.push(ex, ey); }
    } else {
      cmds.push(PATH_M); out.push(ex, ey);
    }
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      cmds.push(s.cmd);
      if (s.cmd === PATH_C) out.push(s.args[2], s.args[3], s.args[0], s.args[1]);
      else if (s.cmd === PATH_Q) out.push(s.args[0], s.args[1]);
      out.push(s.fromX, s.fromY);
    }
    if (closed) cmds.push(PATH_Z);
    segs = [];
    started = false;
  };

  const { commands, coords } = path;
  forEachSegment(commands, coords, (cmd, ci, px, py) => {
    if (cmd === PATH_M) {
      flush(false);
      sx = coords[ci]; sy = coords[ci + 1];
      started = true;
      return;
    }
    if (cmd === PATH_Z) { flush(true); return; }
    if (!started) { sx = px; sy = py; started = true; }
    const n = cmd === PATH_C ? 6 : cmd === PATH_Q ? 4 : 2;
    segs.push({ cmd, args: Array.from(coords.subarray(ci, ci + n)), fromX: px, fromY: py });
  });
  flush(false);

  return {
    kind: 'polygon',
    commands: new Uint8Array(cmds),
    coords: new Float32Array(out),
    fillRule: path.fillRule,
  };
}
