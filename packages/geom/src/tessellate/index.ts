/**
 * `@weasel-js/geom/tessellate` — paths to triangle meshes and polylines. The
 * fill tessellator needs `earcut`, which geom takes as an optional peer; the
 * polyline half does not.
 */
export { tessellate, type TessellateOptions } from './tessellate';
export { extractPolylines, type Polyline, type ExtractOptions } from './polyline';
export { trimPolyline } from './trim';
export type { Mesh } from './mesh';
