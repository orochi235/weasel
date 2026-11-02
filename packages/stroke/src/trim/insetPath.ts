import { type Path, pathLengthTable } from '@weasel-js/geom';
import { trimmedPath } from './trimmedPath';

/**
 * `path`, one open subpath, cut back `start` from its first point and `end`
 * from its last by exact arc length, curves split rather than flattened: the
 * shaft a writer strokes natively under heads the line stops short of. `null`
 * when the insets eat the whole line, which then draws no shaft.
 */
export function insetPath(path: Path, start: number, end: number): Path | null {
  if (!(start > 0) && !(end > 0)) return path;
  const total = pathLengthTable(path).total;
  if (Math.max(0, start) + Math.max(0, end) >= total) return null;
  return trimmedPath(path, { start: { length: Math.max(0, start) }, end: { length: total - Math.max(0, end) } })?.path ?? null;
}
