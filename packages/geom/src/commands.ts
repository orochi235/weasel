/**
 * SVG-style command-stream encoding — the kit's single declaration of the path
 * opcodes. `Path` in @weasel-js/core wraps this with `kind` + `fillRule`.
 *
 * The codes index a `Uint8Array` command stream whose coords live in a
 * parallel float array, so a code declared anywhere but `PATH_COMMANDS` makes
 * every walker that doesn't know it misread the coord stream from that command
 * on — silently, for every path. Derive, never restate.
 */

/** Opcode table: command code and the float coords it consumes. */
export const PATH_COMMANDS = {
  /** moveTo — opens a new subpath. */
  M: { code: 0, coords: 2 },
  /** Straight segment from the pen to the next coord pair. */
  L: { code: 1, coords: 2 },
  /** Cubic bezier: two control points then the endpoint. */
  C: { code: 2, coords: 6 },
  /** Quadratic bezier: one control point then the endpoint. */
  Q: { code: 3, coords: 4 },
  /** Close the current subpath back to its start. Consumes no coords and
   *  leaves the pen where it is. */
  Z: { code: 4, coords: 0 },
} as const;

/** Mnemonic of a declared command (`'M' | 'L' | …`). */
export type PathCommandName = keyof typeof PATH_COMMANDS;
/** Numeric code of a declared command. */
export type PathCommandCode = (typeof PATH_COMMANDS)[PathCommandName]['code'];

export const PATH_M = PATH_COMMANDS.M.code;
export const PATH_L = PATH_COMMANDS.L.code;
export const PATH_C = PATH_COMMANDS.C.code;
export const PATH_Q = PATH_COMMANDS.Q.code;
export const PATH_Z = PATH_COMMANDS.Z.code;

/** Float coords consumed by each command, indexed by command code. */
export const PATH_CMD_LENGTHS: readonly number[] = buildCmdLengths();

function buildCmdLengths(): number[] {
  const lengths: number[] = [];
  for (const { code, coords } of Object.values(PATH_COMMANDS)) lengths[code] = coords;
  return lengths;
}

/** Float coords consumed by the command with this code. */
export function pathCommandCoordCount(cmd: number): number {
  return PATH_CMD_LENGTHS[cmd];
}

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
    const len = pathCommandCoordCount(cmd);
    if (len > 0) {
      px = coords[ci + len - 2];
      py = coords[ci + len - 1];
      ci += len;
    }
  }
}
