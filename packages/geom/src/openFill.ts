import type { PathOpenFill, PolygonPath } from './path';

let fallback: PathOpenFill = 'close';

/** Set whether a fill closes an open subpath, for every path that names no
 *  `openFill` of its own. Starts at `'close'`. */
export function setDefaultOpenFill(rule: PathOpenFill): void {
  fallback = rule;
}

/** The rule a path with no `openFill` of its own follows. */
export function defaultOpenFill(): PathOpenFill {
  return fallback;
}

/** Whether `path`'s open subpaths fill, each closed by a straight edge back to
 *  its start. What painting, area, and the filled-region hit tests all ask. */
export function fillsOpenSubpaths(path: PolygonPath): boolean {
  return (path.openFill ?? fallback) === 'close';
}
