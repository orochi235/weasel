/** Bezier flattening lives in `@weasel-js/geom`; re-exported by name so the
 *  paths feature keeps its existing import address. */
export {
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubic,
  flattenQuadratic,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
} from '@weasel-js/geom';
