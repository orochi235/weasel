import {
  pathDividePieces,
  pathCropPieces,
  pathTrim,
  pathMerge,
  type BooleanPiece,
} from '@weasel-js/geom/booleans';
import type { Path, PolygonPath } from '@weasel-js/geom';
import type { BooleanOp } from './booleans';
import { booleanOfPaths } from 'core/geometry/booleanOfPaths';

/** One result path, and the operand it stands in for: an index into the
 *  operands, back to front. */
export interface ResultPiece {
  path: PolygonPath;
  source: number;
}

/** A piece stands in for the topmost input left in it. */
function bySource(pieces: BooleanPiece[]): ResultPiece[] {
  return pieces.map((p) => ({ path: p.path, source: p.sources[p.sources.length - 1]! }));
}

/** Run `op` over `paths`, back to front, dropping empty results. `mergeKey`
 *  answers alike for the paths a Merge unites. */
export function booleanPieces(op: BooleanOp, paths: Path[], mergeKey: (index: number) => unknown): ResultPiece[] {
  const top = paths.length - 1;
  const whole = (path: PolygonPath): ResultPiece[] => [{ path, source: top }];
  let pieces: ResultPiece[];
  switch (op) {
    case 'union':
    case 'intersect':
    case 'exclude':
    case 'subtract':  pieces = whole(booleanOfPaths(op, paths)); break;
    case 'divide':    pieces = bySource(pathDividePieces(...paths)); break;
    // Illustrator "Crop": every source below the topmost, clipped to it; the
    // topmost is consumed as the mask.
    case 'crop':      pieces = bySource(pathCropPieces(...paths)); break;
    case 'trim':      pieces = bySource(pathTrim(...paths)); break;
    case 'merge':     pieces = bySource(pathMerge(paths, mergeKey)); break;
  }
  return pieces.filter((p) => p.path.commands.length > 0);
}
