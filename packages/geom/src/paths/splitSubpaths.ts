import { forEachSegment, PATH_M } from '../commands';
import type { PolygonPath } from '../path';

/** Split a path into one path per subpath, cutting at each `M`. A path with a
 *  single subpath comes back as a one-element array. `fillRule` is propagated
 *  unchanged, so even-odd compound paths with interior "holes" lose the hole
 *  semantics — each subpath becomes its own filled region. */
export function splitSubpaths(path: PolygonPath): PolygonPath[] {
  const { commands, coords } = path;
  const out: PolygonPath[] = [];

  // Walk the command stream, tracking the (cmdStart, coordStart) of the
  // active subpath. On each subsequent `M`, slice out the previous subpath.
  let cmdStart = 0;
  let coordStart = 0;

  forEachSegment(commands, coords, (cmd, ci, _px, _py, i) => {
    if (cmd !== PATH_M || i <= cmdStart) return;
    out.push({ ...path, commands: commands.slice(cmdStart, i), coords: coords.slice(coordStart, ci) });
    cmdStart = i;
    coordStart = ci;
  });

  out.push({ ...path, commands: commands.slice(cmdStart), coords: coords.slice(coordStart) });

  return out;
}
