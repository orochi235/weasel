/**
 * SVG-style command-stream encoding — geom's canonical copy. `Path` in
 * @weasel-js/core wraps this with `kind` + `fillRule`. Codes lifted from
 * features/paths/types.ts; Spec 2 re-points that file to re-export these.
 */
export const PATH_M = 0; // moveTo
export const PATH_L = 1; // lineTo
export const PATH_C = 2; // cubic bezier
export const PATH_Q = 3; // quadratic bezier
export const PATH_Z = 4; // close subpath

/** Float coords consumed by each command, indexed by command code. */
export const PATH_CMD_LENGTHS: readonly number[] = [2, 2, 6, 4, 0];

/**
 * Visit each command with its coord offset and the pen position BEFORE the
 * command consumes its coords (the segment start). The callback receives
 * (cmd, coordIndex, penX, penY). The pen advances to the command's last
 * coord pair afterward (Z leaves the pen unchanged).
 */
export function forEachSegment(
  commands: ArrayLike<number>,
  coords: ArrayLike<number>,
  visit: (cmd: number, coordIndex: number, penX: number, penY: number) => void,
): void {
  let ci = 0;
  let px = 0, py = 0;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    visit(cmd, ci, px, py);
    const len = PATH_CMD_LENGTHS[cmd];
    if (len > 0) {
      px = coords[ci + len - 2];
      py = coords[ci + len - 1];
      ci += len;
    }
  }
}
