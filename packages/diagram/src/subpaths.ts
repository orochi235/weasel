import { PATH_CMD_LENGTHS, PATH_M, type Path } from '@weasel-js/geom';

/** Subpath `index` of `path` as a path of its own: the whole path for index 0
 *  of one with a single subpath, or of a shape with no commands; null past the last. */
export function subpathOf(path: Path, index: number): Path | null {
  if (path.kind !== 'polygon') return index === 0 ? path : null;
  const { commands, coords } = path;
  let seen = -1;
  let start = -1;
  let startCoord = 0;
  let coord = 0;
  for (let i = 0; i <= commands.length; i++) {
    const cmd = commands[i];
    if (i === commands.length || cmd === PATH_M) {
      if (seen === index) {
        if (start === 0 && i === commands.length) return path;
        return { kind: 'polygon', fillRule: path.fillRule, commands: commands.slice(start, i), coords: coords.slice(startCoord, coord) };
      }
      seen++;
      start = i;
      startCoord = coord;
    }
    if (cmd !== undefined) coord += PATH_CMD_LENGTHS[cmd] ?? 0;
  }
  return null;
}
