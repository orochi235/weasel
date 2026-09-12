/**
 * The `Path` ↔ `polygon-clipping` MultiPolygon adapter lives in
 * `@weasel-js/geom/booleans`. Core's `Path` is structurally its `GeomPath`, so
 * this module is the kit-typed address for the same functions.
 */
import {
  pathToMultiPolygon as geomPathToMultiPolygon,
  multiPolygonToPath as geomMultiPolygonToPath,
  type MultiPolygon,
  type PathToMultiPolygonOptions,
} from '@weasel-js/geom/booleans';
import type { Path, PolygonPath } from './types';

export type { Pair, Ring, Polygon, MultiPolygon, PathToMultiPolygonOptions } from '@weasel-js/geom/booleans';

/** Convert a `Path` to a `MultiPolygon` suitable for `polygon-clipping`. */
export function pathToMultiPolygon(path: Path, opts: PathToMultiPolygonOptions = {}): MultiPolygon {
  return geomPathToMultiPolygon(path, opts);
}

/** Convert a `MultiPolygon` to a `PolygonPath` with `fillRule: 'nonzero'`. */
export function multiPolygonToPath(mp: MultiPolygon): PolygonPath {
  return geomMultiPolygonToPath(mp);
}
