import { PATH_Z } from '../commands';
import type { Path, PolygonPath } from '../path';
import { countPathAnchors } from './anchors';
import { anchorRange, carryCorners } from './cornerCarry';
import { withoutCorners } from './cornerSpec';
import { splitSubpaths } from './splitSubpaths';

interface Placed { sub: PolygonPath; first: number; count: number }

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
  const closed: Placed[] = [];
  const open: Placed[] = [];
  if (path.commands.length > 0) {
    let first = 0;
    for (const sub of splitSubpaths(path)) {
      const count = countPathAnchors(sub);
      (endsInZ(sub) ? closed : open).push({ sub, first, count });
      first += count;
    }
  }
  const join = (placed: Placed[]): PolygonPath | null => {
    if (placed.length === 0) return null;
    const subs = placed.map((p) => p.sub);
    const commands = new Uint8Array(subs.reduce((n, s) => n + s.commands.length, 0));
    const coords = new Float32Array(subs.reduce((n, s) => n + s.coords.length, 0));
    let ci = 0, xi = 0;
    for (const s of subs) {
      commands.set(s.commands, ci);
      coords.set(s.coords, xi);
      ci += s.commands.length;
      xi += s.coords.length;
    }
    const joined = { ...withoutCorners(path), commands, coords };
    if (!path.corners) return joined;
    const sources = new Int32Array(placed.reduce((n, p) => n + p.count, 0));
    let at = 0;
    for (const p of placed) { sources.set(anchorRange(p.first, p.count), at); at += p.count; }
    return carryCorners(path, joined, sources);
  };
  return { closed: join(closed), open: join(open) };
}
