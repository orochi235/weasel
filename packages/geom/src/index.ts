/** @weasel-js/geom — pure 2D geometry kernel: scalars, affines, curves, the
 *  `Path` command stream and the math over it, and easing curves. Curve
 *  representations, tessellation and booleans live in subpaths.
 *
 * @packageDocumentation
 */
export { clamp, cross, dot, sub, len2, sign, approxEq, EPS } from './scalar';
export { normalizeZoom, ZOOM_FLOOR, type View } from './view';
export { identity, translate, scale, rotate, multiply, invert, applyToPoint, boxToBox, rotateAboutPoint, type Affine } from './affine';
export { boundsOfCoords, unionBox, boxContainsPoint, boxContainsBox, rectToContour, type Box, type Rect } from './box';
export { PATH_COMMANDS, PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, pathCommandCoordCount, forEachSegment, type PathCommandName, type PathCommandCode } from './commands';
export {
  cubicEvalAt, quadraticEvalAt, elevateQuadraticToCubic, cubicBounds, cubicAxisExtremaTs,
  splitCubicAt, splitQuadraticAt, splitLineAt,
  type LineCoords, type QuadraticCoords, type CubicCoords,
} from './curve';
export { nearestOnLine, nearestOnQuadratic, nearestOnCubic, nearestOnPath, type CurveNearest, type PathNearest } from './nearest';
export { lineShape, type TrackShape, type TrackShapeKind, type TrackStation, type TrackNearest, type TrackNearestOptions } from './track/shape';
export { arcShape, type ArcTrackSpec, type ArcTrackShape } from './track/arc';
export { ellipseShape, type EllipseTrackSpec, type EllipseTrackShape } from './track/ellipse';
export { pathShape, type PathTrackShape } from './track/path';
export { trackRun, type TrackRun, type TrackPlace, type TrackSide, type TrackRunOptions } from './track/run';
export { trackShapeD } from './track/pathData';
export {
  placeAlongRun, runLength, runPlaces, runStationAt,
  type PlaceAlongRunOptions, type RunAlign, type RunOrder, type RunPlace, type RunSpot,
} from './track/place';
export { PORT_REACH, portControls, portCurvePoints } from './portCurve2';
export {
  DEFAULT_FLATTEN_TOLERANCE, flattenCubic, flattenQuadratic,
  flattenCubicWithArcLen, flattenQuadraticWithArcLen,
} from './flatten';
export { pointInPolygon, segmentsCross, pointSegmentDist2 } from './polyline';
export type { Path, PolygonPath, RectPath, PathFillRule, PathOpenFill } from './path';
export { defaultOpenFill, fillsOpenSubpaths, setDefaultOpenFill } from './openFill';
export {
  PathBuilder, rectPath, asPolygonPath, polylineFromPoints, polygonFromPoints,
  ellipsePath, regularPolygonPath, starPath, linePath,
} from './paths/builder';
export { boundsOfPath } from './paths/bounds';
export {
  cornerCuts, cornerFrameAt, cornerFrames, remapPerAnchor, resolveCorners,
  resolveCornersWithSources, type CornerCut, type CornerFrame, type ResolvedCorners,
} from './paths/corners';
export {
  CORNER_RESTORE_TOLERANCE, cornerTraces, keepCorners, restoreCorners, type CornerTrace,
} from './paths/cornerRestore';
export { offsetCornerTraces } from './paths/cornerOffset';
export {
  compactCorners, cornerAt, cornerSpecAt, hasCorners, lerpCorners, scaleCorners, withCorner,
  withoutCorners, type CornerSpec,
} from './paths/cornerSpec';
export {
  CORNER_FIT_TOLERANCE, CORNER_KEYWORDS, cornerCenter, cornerKeywordOf, cornerShapeK, cornerShapePieces,
  cornerShapePoint, isCornerShape, nextCornerShape, type CornerKeyword, type CornerPiece, type CornerShape,
  type CornerShapeFrame,
} from './paths/cornerShape';
export { unionBoundsPath } from './paths/unionBoundsPath';
export { translatePath, scalePathToBounds } from './paths/transform';
export { transformPath } from './paths/transformPath';
export { composePath, decomposePath } from './paths/compose';
export { splitSubpaths } from './paths/splitSubpaths';
export { hasOpenSubpath, splitByClosure } from './paths/splitByClosure';
export { pathSignedArea, reversePath } from './paths/winding';
export { pathFromD } from './paths/pathFromD';
export { pathToD } from './paths/pathToD';
export { pointAlongPath, type PathStation, type PointAlongPathOptions } from './paths/pathAt';
export { measurePath, type MeasurePathOptions, type PathMeasure, type PathNearestStation } from './paths/pathMeasure';
export {
  pathToCubicContours, cubicContoursToPath, type CubicContour, type CubicSegment,
} from './paths/cubicContours';
export { blendPaths, prepareBlend, type BlendPathsOptions, type PathBlend } from './paths/blendPaths';
export { bendAlongPath, type BendAlongPathOptions } from './paths/bendAlongPath';
export {
  repeatAlongPath, stationsAlongPath, type RepeatAlongPathOptions, type RepeatStation,
} from './paths/repeatAlongPath';
export { pathDistanceToPoint } from './paths/pathDistance';
export { intersectSegments, type SegmentCrossing } from './intersect/segmentIntersections';
export { pathSegments, type PathSegment } from './intersect/pathSegments';
export { pathCrossings, type PathCrossing, type PathStop } from './intersect/pathCrossings';
export {
  createPathSnapIndex, findPathSnap, findPathSnaps, PATH_SNAP_KINDS,
  type PathSnapHit, type PathSnapIndex, type PathSnapKind, type PathSnapQuery, type PathSnapTarget,
  type StaticPathSnapKind,
} from './snap/pathSnap';
export { trimPathAt, type TrimPathOptions, type TrimResult } from './paths/trimPath';
export { pathAwayFromAnchors, type PathAwayFromAnchors } from './paths/pathAwayFromAnchors';
export {
  extendToMeet, lengthenOpenEnd, openEndRay, openPathEnds, type ExtendToMeetOptions, type OpenPathEnd,
} from './paths/extendPath';
export {
  lengthenPathEnd, lengthToward, openEndAt, pathEndAnchorIndex, pathEndFrame,
  type LengthenMode, type PathEndFrame,
} from './paths/lengthenPathEnd';
export { cubicPointAt, splitCubicAtT, type Point } from './paths/cubicMath';
export { fitCubicThroughDeletion } from './paths/spanFit';
export { schneiderFit, fitCubicWithTangents } from './paths/schneiderFit';
export { simplifyPath, simplifySpan, simplifySubpath, type SimplifyPathOptions } from './paths/simplifyPath';
export { growRegion, type GrowRegionOptions } from './paths/growRegion';
export { mergeRegion, type MergeRegionOptions } from './paths/mergeRegion';
export { simplifyAnchorsAt } from './paths/simplifyAnchors';
export { resamplePath, type ResamplePathOptions } from './paths/resamplePath';
export { addExtremaAnchors, segmentExtremaTs } from './paths/extremaAnchors';
export {
  anchorsWhere, cornerAnchors, everyNthAnchor, growAnchorSelection, invertAnchorSelection,
  shrinkAnchorSelection, smoothAnchors,
} from './paths/anchorSelection';
export {
  averageAnchorsAt, closestOpenEnds, joinAnchorsAt, joinSubpathEnds, subpathEndAt,
  type AverageAxis, type JoinOptions, type SubpathEnd,
} from './paths/joinAnchors';
export {
  SPIRO_KINDS, isSpiroKind, solveSpiro, type SpiroKind, type SpiroPoint, type SpiroSegment,
} from './paths/spiro';
export {
  spiroContoursFromControl, spiroContoursOf, spiroControlPath, spiroToPath,
  type SpiroContour, type SpiroPath, type SpiroToPathOptions,
} from './paths/spiroPath';
export {
  eulerAngleAt, eulerCurvatureAt, eulerCurvatureDerivativesAt, eulerPointAt, fitEulerSegment, placeEulerSegment,
  type EulerFit, type EulerSegment,
} from './paths/eulerSpiral';
export {
  pointInPath, strokeHitTest,
  pathContainsPoint, pathContainsRect, pathIntersectsRect,
  pathContainsPolygon, pathIntersectsPolygon,
  polygonContainsPath, polygonIntersectsPath,
  type PointInPathOptions, type PolygonIntersectsPathOptions, type StrokeHitTestOptions,
} from './pathHitTest';
export { transformCoords } from './affine';
export { fitAffine } from './affineFit';
export { circlePath, squarePath, rectMarkerPath, roundRectPath } from './paths/markers';
export {
  countPathAnchors, pathToAnchors, anchorsToPath, isAnchorSmooth, segmentEnds, isStraightSegment,
  nearestSegmentT, type PenAnchor,
} from './paths/anchors';
export { mat3, type GlMat3 } from './glMat3';
export { viewToMat3 } from './viewToMat3';
export { placeRect, clampRectWithin, type Placement, type PlacementSide, type PlacementAlign, type PlaceRectOptions, type PlacedRect } from './place';
export {
  linear, easeIn, easeOut, easeInOut,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeInQuart, easeOutQuart, easeInOutQuart,
  easeInQuint, easeOutQuint, easeInOutQuint,
  easeInSine, easeOutSine, easeInOutSine,
  easeInExpo, easeOutExpo, easeInOutExpo,
  easeInCirc, easeOutCirc, easeInOutCirc,
  easeInBack, easeOutBack, easeInOutBack,
  easeInElastic, easeOutElastic, easeInOutElastic,
  easeInBounce, easeOutBounce, easeInOutBounce,
  EASINGS, SPRING_PRESETS,
  type EasingFn, type EasingName, type SpringPreset, type SpringPresetName,
} from './easings';
export { cubicBezierEasing, resolveEasing, type BezierEasing, type EasingSpec } from './easingSpec';
export { meanScale } from './meanScale';
export { pxExtent, scaleDelta, screenAngleOf, standoff, withinPxBox, withinPxRadius, type Scale2 } from './pxExtent';
export { poseRotationOf, rotatePathAround, type PoseRotation } from './poseRotation';
export {
  poseFrameOf, poseFrameInverseOf, poseLinearOf, pathThroughPoseFrame, type FramedBox, type PoseLinear,
} from './poseFrame';
export {
  anchorAt, anchorCount, anchorsInRect, deleteAnchorsAt, editAnchorSet, flatAnchorIndex, insertAnchorOnSegment,
  locateAnchor, moveHandleTo, openSubpathAt, segmentAt, translateAnchorBy,
  type AnchorRect, type AnchorSet, type SegmentHit,
} from './paths/anchorEdits';
export { anchorsUnderBrush } from './paths/anchorBrush';
export {
  anchorSymmetries, anchorSymmetry, moveHandleSymmetric, translateAnchorsSymmetric, type AnchorSymmetry,
} from './paths/anchorSymmetry';
export { bendSegment, type BendGrip } from './paths/bendSegment';
export { smudgePath, type SmudgePathOptions } from './paths/smudgePath';
export { handleAlongItsAngle, handleAtItsLength, makeHandlesSymmetric, retractHandles } from './paths/handleEdits';
export {
  measureAnchorPath, softFalloff, softSelectionBand, softSelectionWeights,
  type AnchorPathMeasure, type AnchorSubpathMeasure, type MeasureAnchorPathOptions, type SegmentMeasure,
  type SoftFalloff,
} from './paths/softSelection';
export {
  combTeeth, cubicCurvatureAt, cubicCurvatureSource, cubicDerivativeAt, curvatureComb,
  type CombTooth, type CurvatureCombOptions, type CurvatureSource, type SegmentComb,
} from './paths/curvature';
export {
  balanceFactorToward, equalizeSegmentHandles, handleBalances, scaleSegmentHandles, type HandleBalance,
} from './paths/balanceHandles';
export { harmonizeAnchors } from './paths/harmonize';
export { editAnchorSetTracked, remapPointValues, type PointOrigin } from './paths/anchorOrigins';
export { anchorOriginsOf, remapAnchorValues } from './paths/anchorValues';
export {
  anchorsBefore, conflictingConstraints, constrainPathEdit, constraintAnchors, constraintApplies, constraintFits,
  mapConstraintAnchors,
  constrainPathsEdit, pathAnchorPoints, remapConstraints, segmentBetween, solveConstraints, solvePathConstraints,
  unsatisfiedConstraints, withAnchorPoints, CONSTRAINT_TOLERANCE,
  type AnchorPair, type ConflictingConstraintsOptions, type ConstrainPathEditOptions, type ConstrainedPathEdit,
  type ConstrainedPathsEdit, type ConstraintPoint, type HandleRef, type PathLink, type PathsEditItem,
  type PathConstraint, type PathConstraintKind, type SolveConstraintsOptions, type SolveConstraintsResult,
  type SolvePathConstraintsResult, type UnsatisfiedConstraintsOptions,
} from './constraints';
export {
  directionMarks, flatIndexesAfterReverse, reverseSubpaths, setSubpathStart, subpathsOfAnchors,
  type DirectionMark,
} from './paths/pathStructure';
export {
  convertSegments, isSegmentStraight, segmentsBetweenAnchors, type SegmentRef, type SegmentType,
} from './paths/segmentType';
export {
  ANCHOR_FIELDS, readAnchorFields, writeAnchorField,
  type AnchorField, type AnchorFieldValues, type NumberEntry,
} from './paths/anchorFields';
export { nearestPathAnchor, reverseAnchors, type PathAnchorHit } from './paths/nearestAnchor';
export { pathInPoseFrame, pathInWorld, worldEditToStorage, type PathInWorldPose } from './paths/pathInWorld';
export {
  reviveTypedArrays, tagTypedArray, tagTypedArrays, typedArrayReplacer, untagTypedArray,
  TYPED_ARRAY_CONSTRUCTORS, type NumberTypedArray, type TaggedTypedArray, type TypedArrayTag,
} from './typedArrayJson';
