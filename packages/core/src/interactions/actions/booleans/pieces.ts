import {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDividePieces,
  pathCropPieces,
  type BooleanPiece,
} from '@weasel-js/geom/booleans';
import type { Path, PolygonPath } from '@weasel-js/geom';
import type { BooleanOp } from './booleans';

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

/** Run `op` over `paths`, back to front, dropping empty results. */
export function booleanPieces(op: BooleanOp, paths: Path[]): ResultPiece[] {
  const top = paths.length - 1;
  const whole = (path: PolygonPath): ResultPiece[] => [{ path, source: top }];
  let pieces: ResultPiece[];
  switch (op) {
    case 'union':     pieces = whole(pathUnion(...paths)); break;
    case 'intersect': pieces = whole(pathIntersect(...paths)); break;
    case 'exclude':   pieces = whole(pathExclude(...paths)); break;
    case 'subtract': {
      // Illustrator "Minus Front": back − union(everything in front).
      const front = paths.length === 2 ? paths[1]! : pathUnion(...paths.slice(1));
      pieces = whole(pathSubtract(paths[0]!, front));
      break;
    }
    case 'divide':    pieces = bySource(pathDividePieces(...paths)); break;
    // Illustrator "Crop": every source below the topmost, clipped to it; the
    // topmost is consumed as the mask.
    case 'crop':      pieces = bySource(pathCropPieces(...paths)); break;
  }
  return pieces.filter((p) => p.path.commands.length > 0);
}
