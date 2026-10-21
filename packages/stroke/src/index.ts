/**
 * @weasel-js/stroke — a stroke as geometry: the ribbon mesh a renderer draws,
 * the marker heads that cap it, and the region its ink covers as a path.
 * Paths come from `@weasel-js/geom` and the `Stroke` itself from
 * `@weasel-js/paint`; nothing here knows about a scene graph, a renderer or
 * React.
 *
 * @packageDocumentation
 */

export { tessellateStroke, resolveStrokeWidth } from './tessellate/stroke';
export type { StrokeOptions } from './tessellate/stroke';
export { dashLength, splitForDash } from './tessellate/dash';
export { populatePolylineWidths, widestStrokeWidth } from './tessellate/vertexWidths';
export { nibWidthScale } from './tessellate/nib';
export type { WidthScale } from './tessellate/vertexWidths';
export { trimInSpace } from './tessellate/insets';
export type { InsetLength, MeasuredLength } from './tessellate/insets';
export {
  screenSpaceKey, strokeSpaceOf, metricKey, polylineIntoMetric, polylineOutOfMetric, sameMetric,
  worldWidthInMetric, worldWidthInMetricAlongWorld, coordsOutOfMetric, metricKeepsRects, rectIntoMetric,
} from './tessellate/metric';
export type { StrokeMetric, ScreenSpace, StrokeSpaces } from './tessellate/metric';

export { markerRegistry, markerGeneration, registerMarker, getMarker, listMarkers } from './strokeMarkers';
export type { MarkerCtx, MarkerEntry, MarkerPaint } from './strokeMarkers';
export { BUILTIN_MARKERS } from './strokeMarkerShapes';
export { markerInset, markerKeyOf, resolveMarkerSize, strokeInsets } from './markerInset';
export { markerSites } from './markerSites';
export type { MarkerSite, MarkerSiteRequest } from './markerSites';
export { markerHeads, markerReadsKey, markerReach } from './markerHeads';
export type { MarkerHead } from './markerHeads';

export { strokeEdgeNear } from './strokeEdge';
export type { StrokeEdgeHit, StrokeEdgeOptions, StrokeSide } from './strokeEdge';
export { strokeToPath } from './strokeToPath';
export type { StrokeToPathOptions } from './strokeToPath';
export { offsetPath } from './offsetPath';
export type { OffsetPathOptions } from './offsetPath';
