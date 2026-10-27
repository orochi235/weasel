import { pathUnion, pathIntersect, pathSubtract, pathExclude } from '@weasel-js/geom/booleans';
import type { Path, PolygonPath } from '@weasel-js/geom';

/** The booleans that make one shape of their operands: the Pathfinder's four
 *  shape modes, and what a boolean group can be set to. */
export type BooleanShapeOp = 'union' | 'intersect' | 'subtract' | 'exclude';

/**
 * `op` over `paths`, given back to front, as one path. Subtract is
 * Illustrator's "Minus Front": the backmost less everything in front of it.
 * Curves are kept where an operand has them.
 */
export function booleanOfPaths(op: BooleanShapeOp, paths: readonly Path[]): PolygonPath {
  switch (op) {
    case 'union': return pathUnion(...paths);
    case 'intersect': return pathIntersect(...paths);
    case 'exclude': return pathExclude(...paths);
    case 'subtract': {
      const front = paths.length === 2 ? paths[1]! : pathUnion(...paths.slice(1));
      return pathSubtract(paths[0]!, front);
    }
  }
}
