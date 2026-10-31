/**
 * `@weasel-js/geom/tessellate` — paths to triangle meshes and polylines. The
 * fill tessellator needs `earcut`, which geom takes as an optional peer; the
 * polyline half does not.
 *
 * @packageDocumentation
 */
export { tessellate, type TessellateOptions } from './tessellate';
export { MAX_EVENODD_RESOLVE_WORK } from './crossings';
export { extractPolylines, type Polyline, type ExtractOptions } from './polyline';
export { trimPolyline } from './trim';
export { anchorParamsBetween } from './anchorParams';
export type { Mesh } from './mesh';
