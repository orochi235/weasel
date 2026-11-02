import {
  type LengthSpan, type LengthTable, type Path, anchorAtLength, lengthAtAnchor, resolveCornersWithSources,
} from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from './resolveTrim';
import { polylineTable } from './windowPolylines';

/**
 * The pen-order lengths of `path` that `trim` draws, measured as the ribbon
 * measures them: along the corner-resolved path, anchors in authored
 * numbering. Null when it draws nothing; no trim is the whole path.
 */
export function trimSpan(path: Path, trim: StrokeTrim | undefined): LengthSpan | null {
  return resolveTrim(pathTable(path), trim);
}

/**
 * `span`, measured along `from`, restated along `onto` by anchor position:
 * for a path carried through a transform after its trim was measured. The two
 * must share their anchors, one subpath and command for another, as a
 * transformed copy does. Null when the restated span is empty.
 */
export function spanOnPath(span: LengthSpan, from: Path, onto: Path): LengthSpan | null {
  if (onto === from) return span;
  const a = pathTable(from);
  const b = pathTable(onto);
  const lo = lengthAtAnchor(b, anchorAtLength(a, span.from));
  const hi = lengthAtAnchor(b, anchorAtLength(a, span.to));
  return lo < hi ? { from: lo, to: hi } : null;
}

function pathTable(path: Path): LengthTable {
  if (path.kind === 'rect') return polylineTable(extractPolylines(path));
  const { path: resolved, anchorSources } = resolveCornersWithSources(path);
  return polylineTable(extractPolylines(resolved), anchorSources);
}
