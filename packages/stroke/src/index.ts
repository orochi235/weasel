/**
 * @weasel-js/stroke — a stroke as geometry: the ribbon mesh a renderer draws,
 * the marker heads that cap it, and the region its ink covers as a path.
 * Paths come from `@weasel-js/geom` and the `Stroke` itself from
 * `@weasel-js/paint`; nothing here knows about a scene graph, a renderer or
 * React.
 *
 * @packageDocumentation
 */

export { inkWidth, tessellateStroke, resolveStrokeWidth, ribbonAligns } from './tessellate/stroke';
export type { StrokeOptions } from './tessellate/stroke';
export { dashLength, splitForDash } from './tessellate/dash';
export { populatePolylineWidths, widestStrokeWidth } from './tessellate/vertexWidths';
export { nibWidthScale } from './tessellate/nib';
export type { WidthScale } from './tessellate/vertexWidths';
export { trimInSpace } from './tessellate/insets';
export { resolveTrim } from './trim/resolveTrim';
export { trimSpan } from './trim/trimSpan';
export { trimmedPath, trimmedRuns } from './trim/trimmedPath';
export { insetPath } from './trim/insetPath';
export type { TrimmedPath, TrimmedRun } from './trim/trimmedPath';
export { CLIP_CUT, CLIP_OPEN, CLIP_WHOLE, clipRibbon } from './trim/clipRibbon';
export type { ClipRibbon, ClipSubpath } from './trim/clipRibbon';
export { clipWindow } from './trim/clipWindow';
export type { ClipWindow } from './trim/clipWindow';
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
export { strokeAtScale } from './strokeAtScale';
export { markerSites } from './markerSites';
export type { MarkerSite, MarkerSiteInsets, MarkerSiteRequest } from './markerSites';
export {
  markerHeads, markerPlacementMap, markerPlacements, markerPolylines, markerReadsKey, markerReach, markerShape,
} from './markerHeads';
export type { MarkerHead, MarkerPlacement } from './markerHeads';

export { strokeEdgeNear } from './strokeEdge';
export type { StrokeEdgeHit, StrokeEdgeOptions, StrokeSide } from './strokeEdge';
export { strokeToPath } from './strokeToPath';
export type { StrokeToPathOptions } from './strokeToPath';
export { offsetPath } from './offsetPath';
export type { OffsetPathOptions } from './offsetPath';
