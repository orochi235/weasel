/** Point-vs-path hit-testing lives in `@weasel-js/geom`; re-exported by name so
 *  the paths feature keeps its existing import address. */
export {
  pointInPath,
  strokeHitTest,
  type PointInPathOptions,
  type StrokeHitTestOptions,
} from '@weasel-js/geom';
