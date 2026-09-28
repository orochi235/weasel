/** Path-vs-rect and path-vs-polygon hit-testing lives in `@weasel-js/geom`;
 *  re-exported by name so the paths feature keeps its existing import address. */
export {
  pathContainsPoint,
  pathContainsRect,
  pathIntersectsRect,
  pathContainsPolygon,
  pathIntersectsPolygon,
  polygonContainsPath,
  polygonIntersectsPath,
} from '@weasel-js/geom';
