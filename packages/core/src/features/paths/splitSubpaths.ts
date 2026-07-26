/**
 * Split a `PolygonPath` at each `M` command, returning one `PolygonPath` per
 * subpath. Inverse-ish of compound-path construction: a multi-region
 * (compound) path becomes N independent paths.
 *
 * `fillRule` is propagated unchanged to every output. Even-odd compound paths
 * with interior "holes" lose the hole semantics — each subpath becomes its
 * own filled region. (Same behavior as Illustrator's Release Compound Path.)
 *
 * If the input has zero `M` commands (which would already be malformed) the
 * input is returned wrapped in a single-element array. A path with exactly
 * one subpath is also returned as a single-element array — a trivial pass.
 */

import { PATH_M, PATH_CMD_LENGTHS, type PolygonPath } from './types';

export function splitSubpaths(path: PolygonPath): PolygonPath[] {
  const { commands, coords, fillRule } = path;
  const out: PolygonPath[] = [];

  // Walk the command stream, tracking the (cmdStart, coordStart) of the
  // active subpath. On each subsequent `M`, slice out the previous subpath.
  let cmdStart = 0;
  let coordStart = 0;
  let coordCursor = 0;

  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    if (c === PATH_M && i > cmdStart) {
      out.push({
        kind: 'polygon',
        commands: commands.slice(cmdStart, i),
        coords: coords.slice(coordStart, coordCursor),
        fillRule,
      });
      cmdStart = i;
      coordStart = coordCursor;
    }
    coordCursor += PATH_CMD_LENGTHS[c];
  }

  out.push({
    kind: 'polygon',
    commands: commands.slice(cmdStart),
    coords: coords.slice(coordStart),
    fillRule,
  });

  return out;
}
