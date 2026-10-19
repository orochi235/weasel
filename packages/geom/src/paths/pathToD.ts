/**
 * `pathToD` — a weasel `Path` as an SVG `d=` string, the inverse of
 * `pathFromD`. `RectPath` lowers to `M h v h Z`; `PolygonPath` walks the
 * (commands, coords) arrays, one SVG command per kit command, with corner
 * shapes expanded into the geometry they draw.
 *
 * Absolute commands only; numbers are rounded to 6 decimals.
 */

import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import type { Path } from '../path';
import { resolveCorners } from './corners';

const num = (n: number): string => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '0');

/** `path` as SVG path data. */
export function pathToD(given: Path): string {
  const path = resolveCorners(given);
  if (path.kind === 'rect') {
    const { x, y, width, height } = path;
    return `M${num(x)} ${num(y)}h${num(width)}v${num(height)}h${num(-width)}Z`;
  }
  const cmds = path.commands;
  const xs = path.coords;
  const out: string[] = [];
  let ci = 0;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    if (c === PATH_M) {
      out.push(`M${num(xs[ci])} ${num(xs[ci + 1])}`);
      ci += 2;
    } else if (c === PATH_L) {
      out.push(`L${num(xs[ci])} ${num(xs[ci + 1])}`);
      ci += 2;
    } else if (c === PATH_C) {
      out.push(
        `C${num(xs[ci])} ${num(xs[ci + 1])} ${num(xs[ci + 2])} ${num(xs[ci + 3])} `
        + `${num(xs[ci + 4])} ${num(xs[ci + 5])}`,
      );
      ci += 6;
    } else if (c === PATH_Q) {
      out.push(`Q${num(xs[ci])} ${num(xs[ci + 1])} ${num(xs[ci + 2])} ${num(xs[ci + 3])}`);
      ci += 4;
    } else if (c === PATH_Z) {
      out.push('Z');
    }
  }
  return out.join('');
}
