import { forEachSegment, PATH_M, PATH_Z } from '../commands';
import type { PolygonPath } from '../path';
import { anchorRange, carryCorners } from './cornerCarry';
import { withoutCorners } from './cornerSpec';

/** Split a path into one path per subpath, cutting at each `M` and at each
 *  drawing command that opens a subpath without one, which gets the `M` it
 *  implies. A path with a single subpath comes back as a one-element array.
 *  `fillRule` is propagated unchanged, so even-odd compound paths with
 *  interior "holes" lose the hole semantics — each subpath becomes its own
 *  filled region. Each subpath keeps the corner specs of its own anchors. */
export function splitSubpaths(path: PolygonPath): PolygonPath[] {
  return placeSubpaths(path).map((p) => p.sub);
}

/** {@link splitSubpaths}, each subpath with `sources`: for each of its anchor
 *  commands, the anchor command of `path` it came from, or -1 for an added `M`. */
export function placeSubpaths(path: PolygonPath): { sub: PolygonPath; sources: Int32Array }[] {
  const { commands, coords } = path;
  const bare = withoutCorners(path);
  const out: { sub: PolygonPath; sources: Int32Array }[] = [];

  // Walk the command stream, tracking the (cmdStart, coordStart) of the
  // active subpath. On each subsequent `M`, slice out the previous subpath.
  let cmdStart = 0;
  let coordStart = 0;
  let anchorStart = 0;
  let anchors = 0;
  let pen: [number, number] | null = null;

  const emit = (end: number, coordEnd: number) => {
    let cmds = commands.slice(cmdStart, end);
    let xs = coords.slice(coordStart, coordEnd);
    let sources = anchorRange(anchorStart, anchors - anchorStart);
    if (pen) {
      cmds = Uint8Array.of(PATH_M, ...cmds);
      xs = Float32Array.of(pen[0], pen[1], ...xs);
      sources = Int32Array.of(-1, ...sources);
    }
    const sub = { ...bare, commands: cmds, coords: xs };
    out.push({ sub: path.corners ? carryCorners(path, sub, sources) : sub, sources });
    anchorStart = anchors;
  };

  forEachSegment(commands, coords, (cmd, ci, px, py, i, opens) => {
    if ((cmd === PATH_M || opens) && i > cmdStart) {
      emit(i, ci);
      cmdStart = i;
      coordStart = ci;
      pen = opens ? [px, py] : null;
    }
    if (cmd !== PATH_Z) anchors++;
  });

  emit(commands.length, coords.length);

  return out;
}
