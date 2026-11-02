import { type CurveSpan, type Path, curveSpan, pathLengthTable } from '@weasel-js/geom';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from './resolveTrim';

/**
 * Where `trim` cuts `path`, as curve positions on its corner-resolved
 * outline: resolved once, by exact arc length, so every reader cuts its own
 * flattening at the same points, and a copy carried through a transform
 * command for command takes the positions as they are. Null when it draws
 * nothing; no trim is the whole path.
 */
export function trimSpan(path: Path, trim: StrokeTrim | undefined): CurveSpan | null {
  const table = pathLengthTable(path);
  const span = resolveTrim(table, trim);
  return span && curveSpan(table, span);
}
