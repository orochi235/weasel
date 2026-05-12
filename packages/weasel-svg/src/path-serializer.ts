/**
 * Serialize a weasel `Path` to an SVG `d=` attribute string. `RectPath`
 * lowers to `M h v h Z`; `PolygonPath` walks the (commands, coords)
 * arrays, emitting one SVG command per kit command.
 *
 * Output uses absolute commands only and a small amount of whitespace
 * compression (no leading zeros stripped beyond what `Number.toString`
 * already does). Numbers are rounded to ~6 decimals via `trimNumber`.
 */

import {
  PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z,
  type Path,
} from '@orochi235/weasel';
import { trimNumber } from './transform';

/** Serialize a weasel `Path` to an SVG `d=` attribute string. */
export function serializePathD(path: Path): string {
  if (path.kind === 'rect') {
    const { x, y, width, height } = path;
    return `M${trimNumber(x)} ${trimNumber(y)}h${trimNumber(width)}v${trimNumber(height)}h${trimNumber(-width)}Z`;
  }
  const cmds = path.commands;
  const xs = path.coords;
  const out: string[] = [];
  let ci = 0;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    if (c === PATH_M) {
      out.push(`M${trimNumber(xs[ci])} ${trimNumber(xs[ci + 1])}`);
      ci += 2;
    } else if (c === PATH_L) {
      out.push(`L${trimNumber(xs[ci])} ${trimNumber(xs[ci + 1])}`);
      ci += 2;
    } else if (c === PATH_C) {
      out.push(
        `C${trimNumber(xs[ci])} ${trimNumber(xs[ci + 1])} ` +
        `${trimNumber(xs[ci + 2])} ${trimNumber(xs[ci + 3])} ` +
        `${trimNumber(xs[ci + 4])} ${trimNumber(xs[ci + 5])}`,
      );
      ci += 6;
    } else if (c === PATH_Q) {
      out.push(
        `Q${trimNumber(xs[ci])} ${trimNumber(xs[ci + 1])} ` +
        `${trimNumber(xs[ci + 2])} ${trimNumber(xs[ci + 3])}`,
      );
      ci += 4;
    } else if (c === PATH_Z) {
      out.push('Z');
    }
  }
  return out.join('');
}
