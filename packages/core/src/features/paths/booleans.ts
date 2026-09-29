/**
 * Polygon-boolean operations on `Path` values. The kernel lives in
 * `@weasel-js/geom/booleans`; re-exported by name (never `export *`, which
 * esbuild cannot enumerate across a package boundary).
 *
 * Core declares `polygon-clipping` even though nothing here imports it: geom
 * takes it as an optional peer, and core is what supplies it.
 */
export {
  pathUnion, pathIntersect, pathSubtract, pathExclude, pathDivide, pathCrop,
} from '@weasel-js/geom/booleans';
