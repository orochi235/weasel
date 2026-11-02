import {
  type LengthTable, type Path, anchorAtLength, lengthAtAnchor, resolveCornersWithSources,
} from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from './resolveTrim';
import { polylineTable } from './windowPolylines';

/**
 * The pen-order lengths of `path` that `trim` draws, measured as the ribbon
 * measures them: along the corner-resolved path, anchors in authored
 * numbering. Null when it draws nothing; no trim is the whole path.
 *
 * With `drawn`, the span is restated on it by anchor position: for `path`
 * carried through a transform after the trim was measured, so the lengths
 * returned run along `drawn`. The two must share their anchors.
 */
export function trimSpan(path: Path, trim: StrokeTrim | undefined, drawn?: Path): { from: number; to: number } | null {
  const table = pathTable(path);
  const span = resolveTrim(table, trim);
  if (!span || drawn === undefined || drawn === path) return span;
  const on = pathTable(drawn);
  const from = lengthAtAnchor(on, anchorAtLength(table, span.from));
  const to = lengthAtAnchor(on, anchorAtLength(table, span.to));
  return from < to ? { from, to } : null;
}

function pathTable(path: Path): LengthTable {
  if (path.kind === 'rect') return polylineTable(extractPolylines(path));
  const { path: resolved, anchorSources } = resolveCornersWithSources(path);
  return polylineTable(extractPolylines(resolved), anchorSources);
}
