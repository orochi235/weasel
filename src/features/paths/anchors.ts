/**
 * Counts the path anchors used by the per-anchor coloring surface. An
 * "anchor" is the destination point of a path command: M, L, C, Q each
 * contribute one (the (x, y) where the pen ends up); Z contributes none
 * (it closes back to the subpath's first M). RectPath has four implicit
 * anchors — the corners — matching its M/L/L/L/Z stroke tessellation.
 *
 * Consumers use this to size their per-anchor color array; the renderer
 * uses it to validate the array length in dev builds.
 */

import { PATH_C, PATH_L, PATH_M, PATH_Q, type Path } from './types';

export function countPathAnchors(path: Path): number {
  if (path.kind === 'rect') return 4;
  const cmds = path.commands;
  let n = 0;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    if (c === PATH_M || c === PATH_L || c === PATH_C || c === PATH_Q) n++;
  }
  return n;
}
