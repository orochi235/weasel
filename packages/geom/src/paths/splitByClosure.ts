import { PATH_Z } from '../commands';
import type { Path, PolygonPath } from '../path';
import { splitSubpaths } from './splitSubpaths';

const endsInZ = (sub: PolygonPath): boolean => sub.commands[sub.commands.length - 1] === PATH_Z;

/** Whether any subpath of `path` lacks the `Z` that closes it. */
export function hasOpenSubpath(path: Path): boolean {
  return path.kind === 'polygon' && path.commands.length > 0
    && splitSubpaths(path).some((sub) => !endsInZ(sub));
}

/**
 * `path` as two paths: the subpaths a `Z` closes, and those left open, each in
 * the order `path` holds them and with its fill rules. A side with no subpaths
 * is `null`. A fill that does not close an open subpath covers `closed` alone.
 */
export function splitByClosure(
  path: PolygonPath,
): { closed: PolygonPath | null; open: PolygonPath | null } {
  const closed: PolygonPath[] = [];
  const open: PolygonPath[] = [];
  if (path.commands.length > 0) {
    for (const sub of splitSubpaths(path)) (endsInZ(sub) ? closed : open).push(sub);
  }
  const join = (subs: PolygonPath[]): PolygonPath | null => {
    if (subs.length === 0) return null;
    const commands = new Uint8Array(subs.reduce((n, s) => n + s.commands.length, 0));
    const coords = new Float32Array(subs.reduce((n, s) => n + s.coords.length, 0));
    let ci = 0, xi = 0;
    for (const s of subs) {
      commands.set(s.commands, ci);
      coords.set(s.coords, xi);
      ci += s.commands.length;
      xi += s.coords.length;
    }
    return { ...path, commands, coords };
  };
  return { closed: join(closed), open: join(open) };
}
