import { forEachSegment, PATH_M, PATH_Z } from '../commands';
import type { PolygonPath } from '../path';
import { anchorRange, carryCorners } from './cornerCarry';
import { withoutCorners } from './cornerSpec';

/** Split a path into one path per subpath, cutting at each `M`. A path with a
 *  single subpath comes back as a one-element array. `fillRule` is propagated
 *  unchanged, so even-odd compound paths with interior "holes" lose the hole
 *  semantics — each subpath becomes its own filled region. Each subpath keeps
 *  the corner specs of its own anchors. */
export function splitSubpaths(path: PolygonPath): PolygonPath[] {
  const { commands, coords } = path;
  const bare = withoutCorners(path);
  const out: PolygonPath[] = [];

  // Walk the command stream, tracking the (cmdStart, coordStart) of the
  // active subpath. On each subsequent `M`, slice out the previous subpath.
  let cmdStart = 0;
  let coordStart = 0;
  let anchorStart = 0;
  let anchors = 0;

  const emit = (end: number, coordEnd: number) => {
    const sub = { ...bare, commands: commands.slice(cmdStart, end), coords: coords.slice(coordStart, coordEnd) };
    const count = anchors - anchorStart;
    out.push(path.corners ? carryCorners(path, sub, anchorRange(anchorStart, count)) : sub);
    anchorStart = anchors;
  };

  forEachSegment(commands, coords, (cmd, ci, _px, _py, i) => {
    if (cmd === PATH_M && i > cmdStart) {
      emit(i, ci);
      cmdStart = i;
      coordStart = ci;
    }
    if (cmd !== PATH_Z) anchors++;
  });

  emit(commands.length, coords.length);

  return out;
}
