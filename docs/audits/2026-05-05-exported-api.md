# Weasel exported API surface

Generated 2026-05-05. Scanned 202 source files; 202 have exports.

## Index

- [src/animation/behaviors/momentum.ts](#src-animation-behaviors-momentum-ts) — `MomentumOptions`, `momentum`
- [src/animation/easings.ts](#src-animation-easings-ts) — `linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInQuint`, `easeOutQuint`, `easeInOutQuint`, `easeInSine`, `easeOutSine`, `easeInOutSine`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`, `easeInCirc`, `easeOutCirc`, `easeInOutCirc`, `easeInBack`, `easeOutBack`, `easeInOutBack`, `easeInElastic`, `easeOutElastic`, `easeInOutElastic`, `easeOutBounce`, `easeInBounce`, `easeInOutBounce`, `easeIn`, `easeOut`, `easeInOut`, `EASINGS`, `EasingName`, `SPRING_PRESETS`
- [src/animation/index.ts](#src-animation-index-ts) — `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInQuint`, `easeOutQuint`, `easeInOutQuint`, `easeInSine`, `easeOutSine`, `easeInOutSine`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`, `easeInCirc`, `easeOutCirc`, `easeInOutCirc`, `easeInBack`, `easeOutBack`, `easeInOutBack`, `easeInElastic`, `easeOutElastic`, `easeInOutElastic`, `easeInBounce`, `easeOutBounce`, `easeInOutBounce`, `EASINGS`, `EasingName`, `SPRING_PRESETS`, `useAnimator`, `tweenPose`, `springPose`, `TweenPoseOptions`, `SpringPoseOptions`, `momentum`, `MomentumOptions`
- [src/animation/poseHelpers.ts](#src-animation-posehelpers-ts) — `TweenPoseOptions`, `SpringPoseOptions`, `tweenPose`, `springPose`
- [src/animation/types.ts](#src-animation-types-ts) — `EasingFn`, `Interpolate`, `SpringPreset`, `SpringPresetName`, `AnimationHandle`, `TweenOptions`, `SpringOptions`, `DecayOptions`, `UseAnimatorOptions`, `Animator`
- [src/animation/useAnimator.ts](#src-animation-useanimator-ts) — `useAnimator`
- [src/animation/wrappers/animateLifecycle.ts](#src-animation-wrappers-animatelifecycle-ts) — `LifecycleAnimation`, `animateLifecycle`
- [src/animation/wrappers/animateOnSetPose.ts](#src-animation-wrappers-animateonsetpose-ts) — `AnimateOnSetPoseOptions`, `animateOnSetPose`
- [src/animation/wrappers/index.ts](#src-animation-wrappers-index-ts) — `animateOnSetPose`, `AnimateOnSetPoseOptions`, `animateLifecycle`, `LifecycleAnimation`
- [src/canvas/Canvas.tsx](#src-canvas-canvas-tsx) — `STANDARD_SLOTS`, `StandardSlotName`, `GridSlotConfig`, `SceneSlotConfig`, `SelectionOverlaySlotConfig`, `CustomLayerEntry`, `StandardSlotConfig`, `LayerSlotValue`, `LayersMap`, `CanvasSelectionMode`, `CanvasProps`, `DeleteGestureConfig`, `NudgeGestureConfig`, `DuplicateGestureConfig`, `UndoRedoGestureConfig`, `GesturesConfig`, `CanvasHelpers`, `Canvas`
- [src/canvas/SceneCanvas.tsx](#src-canvas-scenecanvas-tsx) — `SceneCanvasProps`, `SceneCanvas`
- [src/canvas/sceneAdapter.ts](#src-canvas-sceneadapter-ts) — `SceneAdapterSelection`, `SceneCanvasAdapter`, `SceneToAdapterOptions`, `sceneToAdapter`
- [src/core/adapters/arrayAdapter.ts](#src-core-adapters-arrayadapter-ts) — `ArrayAdapterConfig`, `ArrayAdapter`, `arrayAdapter`
- [src/core/adapters/types.ts](#src-core-adapters-types-ts) — `ClipboardSnapshot`, `SnapTarget`, `SceneAdapter`, `MoveAdapter`, `ResizeAdapter`, `RotateAdapter`, `AreaSelectAdapter`, `InsertAdapter`, `OrderedAdapter`
- [src/core/adapters/useArrayAdapter.ts](#src-core-adapters-usearrayadapter-ts) — `UseArrayAdapterOptions`, `useArrayAdapter`
- [src/core/applyOps.ts](#src-core-applyops-ts) — `applyOpsTo`, `dispatchApplyBatch`
- [src/core/history/history.ts](#src-core-history-history-ts) — `History`, `createHistory`
- [src/core/history/index.ts](#src-core-history-index-ts) — `createHistory`, `History`
- [src/core/layers/LayerRenderer.ts](#src-core-layers-layerrenderer-ts) — `LayerRenderer`
- [src/core/layers/render.ts](#src-core-layers-render-ts) — `RenderLayer`, `runLayers`
- [src/core/ops/create.ts](#src-core-ops-create-ts) — `InsertOp`, `createInsertOp`
- [src/core/ops/delete.ts](#src-core-ops-delete-ts) — `createDeleteOp`
- [src/core/ops/index.ts](#src-core-ops-index-ts) — `Op`, `applyOpsTo`, `dispatchApplyBatch`, `createTransformOp`, `createReparentOp`, `createInsertOp`, `InsertOp`, `createDeleteOp`, `createSetSelectionOp`, `createSetTextOp`, `createBringForwardOp`, `createSendBackwardOp`, `createBringToFrontOp`, `createSendToBackOp`, `createMoveToIndexOp`
- [src/core/ops/reorder/algorithms.ts](#src-core-ops-reorder-algorithms-ts) — `bringForward`, `sendBackward`, `bringToFront`, `sendToBack`, `moveToIndex`
- [src/core/ops/reorder/index.ts](#src-core-ops-reorder-index-ts) — `createBringForwardOp`, `createSendBackwardOp`, `createBringToFrontOp`, `createSendToBackOp`, `createMoveToIndexOp`
- [src/core/ops/reparent.ts](#src-core-ops-reparent-ts) — `createReparentOp`
- [src/core/ops/select.ts](#src-core-ops-select-ts) — `createSetSelectionOp`
- [src/core/ops/setText.ts](#src-core-ops-settext-ts) — `createSetTextOp`
- [src/core/ops/transform.ts](#src-core-ops-transform-ts) — `createTransformOp`
- [src/core/ops/types.ts](#src-core-ops-types-ts) — `Op`
- [src/core/paint.ts](#src-core-paint-ts) — `Paint`, `StrokeAlign`, `Stroke`, `alignedStrokeRect`, `Region`, `RenderFilledRegionOptions`, `applyPaint`, `applyStroke`, `renderFilledRegion`
- [src/core/scene/index.ts](#src-core-scene-index-ts) — `createScene`, `useScene`, `asNodeId`, `AddNodeSpec`, `ContainerNode`, `LayerRecord`, `LeafNode`, `Node`, `NodeId`, `RegisteredOp`, `Scene`, `SystemLayerRecord`, `SystemLayerSpec`, `UserLayerRecord`, `UseSceneOptions`
- [src/core/scene/scene.ts](#src-core-scene-scene-ts) — `createScene`
- [src/core/scene/types.ts](#src-core-scene-types-ts) — `NodeId`, `asNodeId`, `LeafNode`, `ContainerNode`, `Node`, `SystemLayerRecord`, `UserLayerRecord`, `LayerRecord`, `AddNodeSpec`, `RegisteredOp`, `SystemLayerSpec`, `UseSceneOptions`, `Scene`
- [src/core/scene/useScene.ts](#src-core-scene-usescene-ts) — `UseSceneTrivialOptions`, `useScene`
- [src/core/units.ts](#src-core-units-ts) — `Unit`, `UnitSystem`, `UnitValue`, `resolveUnit`, `formatUnit`, `IMPERIAL_INCHES`, `METRIC_MM`, `PIXELS`
- [src/debug/createDebugOverlayLayer.ts](#src-debug-createdebugoverlaylayer-ts) — `createDebugOverlayLayer`
- [src/debug/createDebugSink.ts](#src-debug-createdebugsink-ts) — `createDebugSink`
- [src/debug/defaultTheme.ts](#src-debug-defaulttheme-ts) — `DEFAULT_DEBUG_THEME`
- [src/debug/index.ts](#src-debug-index-ts) — `parseDebugFlags`, `createDebugSink`, `createDebugOverlayLayer`, `DEFAULT_DEBUG_THEME`, `DebugConfig`, `DebugFeature`, `DebugTheme`, `DebugSink`, `DebugSnapshot`, `HandleKind`, `HitShape`, `RecordedHitbox`, `RecordedHandle`, `RecordedBounds`, `RecordedOrigin`, `RecordedSnap`, `RecordedLayer`
- [src/debug/parseDebugFlags.ts](#src-debug-parsedebugflags-ts) — `parseDebugFlags`
- [src/debug/types.ts](#src-debug-types-ts) — `DebugConfig`, `DebugFeature`, `DebugTheme`, `HandleKind`, `HitShape`, `RecordedHitbox`, `RecordedHandle`, `RecordedBounds`, `RecordedOrigin`, `RecordedSnap`, `RecordedLayer`, `DebugSnapshot`, `DebugSink`
- [src/features/drag/dragGhost.ts](#src-features-drag-dragghost-ts) — `DragGhost`, `DragGhostOptions`, `createDragGhost`
- [src/features/drag/pointerDrag.ts](#src-features-drag-pointerdrag-ts) — `DragPayload`, `DragHandleOptions`, `useDragHandle`, `DropZoneOptions`, `useDropZone`
- [src/features/drag/thresholdDrag.ts](#src-features-drag-thresholddrag-ts) — `ThresholdDragOptions`, `ThresholdDragHandle`, `startThresholdDrag`
- [src/features/grid/cellHighlight.ts](#src-features-grid-cellhighlight-ts) — `CellHighlightLayerOpts`, `createCellHighlightLayer`
- [src/features/grid/index.ts](#src-features-grid-index-ts) — `roundToCell`
- [src/features/grid/layer.ts](#src-features-grid-layer-ts) — `GridLayerOpts`, `createGridLayer`
- [src/features/grid/useGridCellHover.ts](#src-features-grid-usegridcellhover-ts) — `UseGridCellHoverOptions`, `UseGridCellHoverReturn`, `useGridCellHover`
- [src/features/groups/children.ts](#src-features-groups-children-ts) — `CreateChildrenLayerOpts`, `createChildrenLayer`
- [src/features/groups/composePose.ts](#src-features-groups-composepose-ts) — `RectPose`, `PoseAdapter`, `composeWorldPose`, `composeRectPose`, `translateRectPose`, `rebaseLocalPose`, `decomposeRectPose`, `worldPoseLookup`
- [src/features/groups/index.ts](#src-features-groups-index-ts) — `Group`, `GroupAdapter`, `resolveToOutermostGroup`, `expandToLeaves`, `unionBounds`, `RectPose`, `withGroupOrdering`, `createCreateGroupOp`, `createDissolveGroupOp`, `createAddToGroupOp`, `createRemoveFromGroupOp`
- [src/features/groups/ops/addToGroup.ts](#src-features-groups-ops-addtogroup-ts) — `createAddToGroupOp`
- [src/features/groups/ops/createGroup.ts](#src-features-groups-ops-creategroup-ts) — `createCreateGroupOp`
- [src/features/groups/ops/dissolveGroup.ts](#src-features-groups-ops-dissolvegroup-ts) — `createDissolveGroupOp`
- [src/features/groups/ops/removeFromGroup.ts](#src-features-groups-ops-removefromgroup-ts) — `createRemoveFromGroupOp`
- [src/features/groups/orderedGroups.ts](#src-features-groups-orderedgroups-ts) — `withGroupOrdering`
- [src/features/groups/resolve.ts](#src-features-groups-resolve-ts) — `resolveToOutermostGroup`, `expandToLeaves`
- [src/features/groups/types.ts](#src-features-groups-types-ts) — `Group`, `GroupAdapter`
- [src/features/groups/unionBounds.ts](#src-features-groups-unionbounds-ts) — `RectPose`, `unionBounds`
- [src/features/paths/bounds.ts](#src-features-paths-bounds-ts) — `boundsOfPath`
- [src/features/paths/builder.ts](#src-features-paths-builder-ts) — `PathBuilder`, `rectPath`, `polygonFromPoints`
- [src/features/paths/canvas.ts](#src-features-paths-canvas-ts) — `traceToContext`
- [src/features/paths/compose.ts](#src-features-paths-compose-ts) — `composePath`, `decomposePath`
- [src/features/paths/flatten.ts](#src-features-paths-flatten-ts) — `DEFAULT_FLATTEN_TOLERANCE`, `flattenCubic`, `flattenQuadratic`
- [src/features/paths/hitTest.ts](#src-features-paths-hittest-ts) — `PointInPathOptions`, `pointInPath`
- [src/features/paths/index.ts](#src-features-paths-index-ts) — `PATH_C`, `PATH_L`, `PATH_M`, `PATH_Q`, `PATH_Z`, `PATH_CMD_LENGTHS`, `Path`, `PolygonPath`, `RectPath`, `PathFillRule`, `PathBuilder`, `polygonFromPoints`, `rectPath`, `boundsOfPath`, `pointInPath`, `PointInPathOptions`, `translatePath`, `translatePolygonInPlace`, `scalePathToBounds`, `traceToContext`, `createPathLayer`, `CreatePathLayerOpts`, `flattenCubic`, `flattenQuadratic`, `DEFAULT_FLATTEN_TOLERANCE`, `composePath`, `decomposePath`, `unionBoundsPath`, `pathPoseDescriptor`, `pathOriginProjection`, `createPenPreviewLayer`, `CreatePenPreviewLayerOptions`, `PenPreviewStyle`
- [src/features/paths/originProjection.ts](#src-features-paths-originprojection-ts) — `pathOriginProjection`
- [src/features/paths/pathLayer.ts](#src-features-paths-pathlayer-ts) — `CreatePathLayerOpts`, `createPathLayer`
- [src/features/paths/penPreviewLayer.ts](#src-features-paths-penpreviewlayer-ts) — `PenPreviewStyle`, `CreatePenPreviewLayerOptions`, `createPenPreviewLayer`
- [src/features/paths/poseDescriptor.ts](#src-features-paths-posedescriptor-ts) — `pathPoseDescriptor`
- [src/features/paths/transform.ts](#src-features-paths-transform-ts) — `translatePath`, `translatePolygonInPlace`, `scalePathToBounds`
- [src/features/paths/types.ts](#src-features-paths-types-ts) — `PATH_M`, `PATH_L`, `PATH_C`, `PATH_Q`, `PATH_Z`, `PATH_CMD_LENGTHS`, `PathFillRule`, `PolygonPath`, `RectPath`, `Path`
- [src/features/paths/unionBoundsPath.ts](#src-features-paths-unionboundspath-ts) — `unionBoundsPath`
- [src/features/patterns/index.ts](#src-features-patterns-index-ts) — `TilePatternOpts`, `createTilePattern`
- [src/features/patterns/patterns-builtin.ts](#src-features-patterns-patterns-builtin-ts) — `HatchParams`, `hatch`, `CrosshatchParams`, `crosshatch`, `DotsParams`, `dots`, `ChunksParams`, `chunks`
- [src/features/selection/overlay.ts](#src-features-selection-overlay-ts) — `ComposeSelectionPoseOpts`, `composeSelectionPose`, `SelectionOutlineLayerOpts`, `SelectionHandlesLayerOpts`, `SelectionOverlayLayerOpts`, `createSelectionOutlineLayer`, `createSelectionHandlesLayer`, `createSelectionOverlayLayer`
- [src/features/selection/useSelection.ts](#src-features-selection-useselection-ts) — `SelectionMode`, `SelectionExtendKey`, `SelectionApi`, `UseSelectionOptions`, `useSelection`
- [src/features/text/fitTextPose.ts](#src-features-text-fittextpose-ts) — `FitTextPoseOptions`, `fitTextPose`
- [src/features/text/hitTest.ts](#src-features-text-hittest-ts) — `PointInTextPoseOpts`, `pointInTextPose`, `caretIndexAt`
- [src/features/text/markdownText.ts](#src-features-text-markdowntext-ts) — `StyledRun`, `DEFAULT_SIZE_STEP`, `ParseMarkdownRunsOptions`, `parseMarkdownRuns`, `MeasureFn`, `PositionedRun`, `LayoutLine`, `LayoutResult`, `layoutMarkdown`, `MarkdownFontOptions`, `createMarkdownRenderer`
- [src/features/text/measureText.ts](#src-features-text-measuretext-ts) — `MeasuredText`, `measureText`
- [src/features/text/renderLabel.ts](#src-features-text-renderlabel-ts) — `TextRenderer`, `LabelOptions`, `renderLabel`, `defaultLabelTextRenderer`
- [src/features/text/textLayer.ts](#src-features-text-textlayer-ts) — `TextPose`, `CreateTextLayerOpts`, `createTextLayer`
- [src/features/text/textStyle.ts](#src-features-text-textstyle-ts) — `TextStyle`, `ResolvedTextStyle`, `DEFAULT_TEXT_STYLE`, `resolveTextStyle`, `fontString`
- [src/features/text/useTextEdit.ts](#src-features-text-usetextedit-ts) — `TextEditScreenPose`, `UseTextEditOptions`, `StartEditOptions`, `UseTextEditReturn`, `useTextEdit`
- [src/features/viewport/clampView.ts](#src-features-viewport-clampview-ts) — `ClampBounds`, `CanvasSize`, `clampView`
- [src/features/viewport/clientToCanvas.ts](#src-features-viewport-clienttocanvas-ts) — `clientToCanvas`
- [src/features/viewport/fitToBounds.ts](#src-features-viewport-fittobounds-ts) — `fitZoom`, `fitToBounds`
- [src/features/viewport/pixelDensity.ts](#src-features-viewport-pixeldensity-ts) — `SetupCanvasDprOptions`, `setupCanvasDpr`, `useFixedPixelRatio`
- [src/features/viewport/useAutoCenter.ts](#src-features-viewport-useautocenter-ts) — `computeFitView`, `useAutoCenter`
- [src/features/viewport/useCanvasSize.ts](#src-features-viewport-usecanvassize-ts) — `useCanvasSize`
- [src/features/viewport/useZoom.ts](#src-features-viewport-usezoom-ts) — `UseZoomOptions`, `UseZoomReturn`, `useZoom`
- [src/features/viewport/view.ts](#src-features-viewport-view-ts) — `View`, `viewToTransform`
- [src/features/viewport/viewTransform.ts](#src-features-viewport-viewtransform-ts) — `ViewTransform`, `worldToScreen`, `screenToWorld`
- [src/features/viewport/wheelHandler.ts](#src-features-viewport-wheelhandler-ts) — `WheelState`, `WheelInput`, `ZoomBounds`, `computeWheelAction`
- [src/features/viewport/zoomAt.ts](#src-features-viewport-zoomat-ts) — `ZoomClampOpts`, `zoomAt`
- [src/index.ts](#src-index-ts) — `setupCanvasDpr`, `useFixedPixelRatio`, `SetupCanvasDprOptions`, `zoomAt`, `ZoomClampOpts`, `clampView`, `ClampBounds`, `CanvasSize`, `useGridCellHover`, `UseGridCellHoverOptions`, `UseGridCellHoverReturn`, `useKeybinding`, `isEditableTarget`, `KeyBinding`, `clientToCanvas`, `usePointerGestures`, `PointerGestureBindings`, `UsePointerGesturesOptions`, `PointerGestureCallbackCtx`, `Canvas`, `SceneCanvas`, `SceneCanvasProps`, `sceneToAdapter`, `SceneCanvasAdapter`, `CanvasProps`, `CanvasHelpers`, `CanvasSelectionMode`, `StandardSlotName`, `CustomLayerEntry`, `GridSlotConfig`, `useSelection`, `SelectionApi`, `SelectionMode`, `SelectionExtendKey`, `UseSelectionOptions`, `createGridLayer`, `GridLayerOpts`, `createCellHighlightLayer`, `CellHighlightLayerOpts`, `createChildrenLayer`, `CreateChildrenLayerOpts`, `resolveUnit`, `formatUnit`, `IMPERIAL_INCHES`, `METRIC_MM`, `PIXELS`, `Unit`, `UnitSystem`, `UnitValue`, `composeSelectionPose`, `createSelectionOutlineLayer`, `createSelectionHandlesLayer`, `createSelectionOverlayLayer`, `ComposeSelectionPoseOpts`, `SelectionOutlineLayerOpts`, `SelectionHandlesLayerOpts`, `SelectionOverlayLayerOpts`, `DEFAULT_TEXT_STYLE`, `resolveTextStyle`, `fontString`, `TextStyle`, `ResolvedTextStyle`, `measureText`, `MeasuredText`, `createTextLayer`, `TextPose`, `CreateTextLayerOpts`, `pointInTextPose`, `caretIndexAt`, `fitTextPose`, `FitTextPoseOptions`, `PointInTextPoseOpts`, `useTextEdit`, `TextEditScreenPose`, `StartEditOptions`, `UseTextEditOptions`, `UseTextEditReturn`, `createTilePattern`, `TilePatternOpts`, `applyPaint`, `applyStroke`, `renderFilledRegion`, `Paint`, `Stroke`, `Region`, `RenderFilledRegionOptions`, `composeWorldPose`, `composeRectPose`, `decomposeRectPose`, `rebaseLocalPose`, `translateRectPose`, `worldPoseLookup`, `PoseAdapter`, `nestedGroupHitTester`, `NestedGroupHitOpts`, `NestedGroupHitTester`, `PATH_M`, `PATH_L`, `PATH_C`, `PATH_Q`, `PATH_Z`, `PATH_CMD_LENGTHS`, `PathBuilder`, `polygonFromPoints`, `rectPath`, `boundsOfPath`, `pointInPath`, `translatePath`, `translatePolygonInPlace`, `scalePathToBounds`, `traceToContext`, `createPathLayer`, `flattenCubic`, `flattenQuadratic`, `DEFAULT_FLATTEN_TOLERANCE`, `composePath`, `decomposePath`, `unionBoundsPath`, `pathPoseDescriptor`, `pathOriginProjection`, `createPenPreviewLayer`, `Path`, `PolygonPath`, `RectPath`, `PathFillRule`, `PointInPathOptions`, `CreatePathLayerOpts`, `CreatePenPreviewLayerOptions`, `PenPreviewStyle`, `constrainTo45`, `Group`, `GroupAdapter`, `resolveToOutermostGroup`, `expandToLeaves`, `unionBounds`, `RectPose`, `withGroupOrdering`, `arrayAdapter`, `ArrayAdapter`, `ArrayAdapterConfig`, `useArrayAdapter`, `UseArrayAdapterOptions`, `createScene`, `useScene`, `asNodeId`, `AddNodeSpec`, `ContainerNode`, `LayerRecord`, `LeafNode`, `SceneNode`, `NodeId`, `RegisteredOp`, `Scene`, `SystemLayerRecord`, `SystemLayerSpec`, `UserLayerRecord`, `UseSceneOptions`, `ModifierState`, `PointerState`, `GestureContext`, `SnapStrategy`, `GestureBehavior`, `BehaviorMoveResult`, `MoveBehavior`, `MoveOverlay`, `ResizeAnchor`, `ResizePose`, `ResizeProposed`, `ResizeMoveResult`, `ResizeBehavior`, `ResizeOverlay`, `RotatedPose`, `RotateProposed`, `RotateMoveResult`, `RotateBehavior`, `RotateOverlay`, `InsertProposed`, `InsertMoveResult`, `InsertBehavior`, `InsertOverlay`, `AreaSelectPose`, `AreaSelectProposed`, `AreaSelectMoveResult`, `AreaSelectBehavior`, `AreaSelectOverlay`, `ClipboardSnapshot`, `snap`, `gridSnapStrategy`, `pointToGridCell`, `RECT_ORIGIN_PROJECTION`, `OriginProjection`, `useMove`, `UseMoveOptions`, `MoveController`, `MoveStartArgs`, `MoveMoveArgs`, `useResize`, `RECT_POSE_DESCRIPTOR`, `cornerResizeHandles`, `hitCornerHandle`, `UseResizeOptions`, `ResizeController`, `PoseDescriptor`, `CornerHandle`, `useRotate`, `pointInRotatedRect`, `rotatedRectCorners`, `rectCorners`, `rotatePoint`, `aabbCenter`, `rotationHandle`, `hitRotationHandle`, `DEFAULT_ROTATION_HANDLE_DISTANCE`, `UseRotateOptions`, `RotateController`, `RotateStartArgs`, `RotateMoveArgs`, `RotateGeometry`, `RotationHandle`, `useInsert`, `UseInsertOptions`, `InsertController`, `useAreaSelect`, `useEditAnchors`, `hitAnchor`, `enumerateAnchors`, `withCoord`, `createAnchorEditOverlayLayer`, `UseEditAnchorsOptions`, `EditAnchorsController`, `EditAnchorsAdapter`, `EditAnchorsOverlay`, `EditAnchorsStartArgs`, `EditAnchorsMoveArgs`, `AnchorHit`, `PathAnchor`, `AnchorEditOverlayOpts`, `UseAreaSelectOptions`, `AreaSelectController`, `selectFromMarquee`, `useClipboardOps`, `useClipboard`, `UseClipboardOpsOptions`, `UseClipboardOpsReturn`, `ClipboardAdapter`, `UseClipboardOptions`, `UseClipboardReturn`, `useDelete`, `DeleteAdapter`, `UseDeleteOptions`, `UseDeleteReturn`, `useEscape`, `EscapeAdapter`, `UseEscapeOptions`, `UseEscapeReturn`, `useSelectAll`, `SelectAllAdapter`, `UseSelectAllOptions`, `UseSelectAllReturn`, `useDuplicate`, `DuplicateAdapter`, `UseDuplicateOptions`, `UseDuplicateReturn`, `useNudge`, `NudgeAdapter`, `NudgeDirection`, `UseNudgeOptions`, `UseNudgeReturn`, `useClone`, `cloneByAltDrag`, `UseCloneOptions`, `UseCloneReturn`, `ClonePose`, `CloneLayer`, `CloneBehavior`, `createBringForwardOp`, `createSendBackwardOp`, `createBringToFrontOp`, `createSendToBackOp`, `createMoveToIndexOp`, `useReorder`, `ReorderAdapter`, `UseReorderOptions`, `UseReorderReturn`, `useGroup`, `useUngroup`, `useNestedGroup`, `useNestedUngroup`, `GroupActionAdapter`, `UseGroupOptions`, `UseGroupReturn`, `UseUngroupOptions`, `UseUngroupReturn`, `NestedGroupActionAdapter`, `UseNestedGroupOptions`, `UseNestedGroupReturn`, `UseNestedUngroupOptions`, `UseNestedUngroupReturn`, `useUndoRedo`, `UndoRedoAdapter`, `UseUndoRedoOptions`, `UseUndoRedoReturn`
- [src/interactions/actions/clipboard/clipboard.ts](#src-interactions-actions-clipboard-clipboard-ts) — `ClipboardAdapter`, `UseClipboardOptions`, `UseClipboardReturn`, `useClipboard`
- [src/interactions/actions/clipboard/clipboardOps.ts](#src-interactions-actions-clipboard-clipboardops-ts) — `UseClipboardOpsOptions`, `UseClipboardOpsReturn`, `useClipboardOps`
- [src/interactions/actions/clipboard/index.ts](#src-interactions-actions-clipboard-index-ts) — `useClipboardOps`, `UseClipboardOpsOptions`, `UseClipboardOpsReturn`, `useClipboard`, `ClipboardAdapter`, `UseClipboardOptions`, `UseClipboardReturn`
- [src/interactions/actions/clipboard/types.ts](#src-interactions-actions-clipboard-types-ts) — `ClipboardSnapshot`
- [src/interactions/actions/delete/delete.ts](#src-interactions-actions-delete-delete-ts) — `DeleteAdapter`, `UseDeleteOptions`, `UseDeleteReturn`, `useDelete`
- [src/interactions/actions/delete/index.ts](#src-interactions-actions-delete-index-ts) — `useDelete`, `DeleteAdapter`, `UseDeleteOptions`, `UseDeleteReturn`
- [src/interactions/actions/duplicate/duplicate.ts](#src-interactions-actions-duplicate-duplicate-ts) — `DuplicateAdapter`, `UseDuplicateOptions`, `UseDuplicateReturn`, `useDuplicate`
- [src/interactions/actions/duplicate/index.ts](#src-interactions-actions-duplicate-index-ts) — `useDuplicate`, `DuplicateAdapter`, `UseDuplicateOptions`, `UseDuplicateReturn`
- [src/interactions/actions/escape/escape.ts](#src-interactions-actions-escape-escape-ts) — `EscapeAdapter`, `UseEscapeOptions`, `UseEscapeReturn`, `useEscape`
- [src/interactions/actions/escape/index.ts](#src-interactions-actions-escape-index-ts) — `useEscape`, `EscapeAdapter`, `UseEscapeOptions`, `UseEscapeReturn`
- [src/interactions/actions/group/group.ts](#src-interactions-actions-group-group-ts) — `GroupActionAdapter`, `UseGroupOptions`, `UseGroupReturn`, `useGroup`, `UseUngroupOptions`, `UseUngroupReturn`, `useUngroup`
- [src/interactions/actions/group/index.ts](#src-interactions-actions-group-index-ts) — `useGroup`, `useUngroup`, `GroupActionAdapter`, `UseGroupOptions`, `UseGroupReturn`, `UseUngroupOptions`, `UseUngroupReturn`, `useNestedGroup`, `useNestedUngroup`, `NestedGroupActionAdapter`, `UseNestedGroupOptions`, `UseNestedGroupReturn`, `UseNestedUngroupOptions`, `UseNestedUngroupReturn`
- [src/interactions/actions/group/nestedGroup.ts](#src-interactions-actions-group-nestedgroup-ts) — `NestedGroupActionAdapter`, `UseNestedGroupOptions`, `UseNestedGroupReturn`, `useNestedGroup`, `UseNestedUngroupOptions`, `UseNestedUngroupReturn`, `useNestedUngroup`
- [src/interactions/actions/nudge/index.ts](#src-interactions-actions-nudge-index-ts) — `useNudge`, `NudgeAdapter`, `NudgeDirection`, `UseNudgeOptions`, `UseNudgeReturn`
- [src/interactions/actions/nudge/nudge.ts](#src-interactions-actions-nudge-nudge-ts) — `NudgeDirection`, `NudgeAdapter`, `UseNudgeOptions`, `UseNudgeReturn`, `useNudge`
- [src/interactions/actions/reorder/index.ts](#src-interactions-actions-reorder-index-ts) — `useReorder`, `ReorderAdapter`, `UseReorderOptions`, `UseReorderReturn`
- [src/interactions/actions/reorder/reorder.ts](#src-interactions-actions-reorder-reorder-ts) — `ReorderAdapter`, `UseReorderOptions`, `UseReorderReturn`, `useReorder`
- [src/interactions/actions/select-all/index.ts](#src-interactions-actions-select-all-index-ts) — `useSelectAll`, `SelectAllAdapter`, `UseSelectAllOptions`, `UseSelectAllReturn`
- [src/interactions/actions/select-all/select-all.ts](#src-interactions-actions-select-all-select-all-ts) — `SelectAllAdapter`, `UseSelectAllOptions`, `UseSelectAllReturn`, `useSelectAll`
- [src/interactions/actions/undo-redo/index.ts](#src-interactions-actions-undo-redo-index-ts) — `useUndoRedo`, `UndoRedoAdapter`, `UseUndoRedoOptions`, `UseUndoRedoReturn`
- [src/interactions/actions/undo-redo/undoRedo.ts](#src-interactions-actions-undo-redo-undoredo-ts) — `UndoRedoAdapter`, `UseUndoRedoOptions`, `UseUndoRedoReturn`, `useUndoRedo`
- [src/interactions/actions/useKeybinding.ts](#src-interactions-actions-usekeybinding-ts) — `KeyBinding`, `isEditableTarget`, `useKeybinding`
- [src/interactions/gestures/area-select/areaSelect.ts](#src-interactions-gestures-area-select-areaselect-ts) — `UseAreaSelectOptions`, `AreaSelectController`, `useAreaSelect`
- [src/interactions/gestures/area-select/behaviors/index.ts](#src-interactions-gestures-area-select-behaviors-index-ts) — `selectFromMarquee`
- [src/interactions/gestures/area-select/behaviors/selectFromMarquee.ts](#src-interactions-gestures-area-select-behaviors-selectfrommarquee-ts) — `selectFromMarquee`
- [src/interactions/gestures/area-select/index.ts](#src-interactions-gestures-area-select-index-ts) — `useAreaSelect`, `UseAreaSelectOptions`, `AreaSelectController`
- [src/interactions/gestures/clone/behaviors/cloneByAltDrag.ts](#src-interactions-gestures-clone-behaviors-clonebyaltdrag-ts) — `cloneByAltDrag`
- [src/interactions/gestures/clone/behaviors/index.ts](#src-interactions-gestures-clone-behaviors-index-ts) — `cloneByAltDrag`
- [src/interactions/gestures/clone/clone.ts](#src-interactions-gestures-clone-clone-ts) — `UseCloneOptions`, `UseCloneReturn`, `useClone`
- [src/interactions/gestures/clone/index.ts](#src-interactions-gestures-clone-index-ts) — `useClone`, `UseCloneOptions`, `UseCloneReturn`, `cloneByAltDrag`
- [src/interactions/gestures/edit-anchors/editAnchors.ts](#src-interactions-gestures-edit-anchors-editanchors-ts) — `EditAnchorsAdapter`, `EditAnchorsOverlay`, `EditAnchorsStartArgs`, `EditAnchorsMoveArgs`, `UseEditAnchorsOptions`, `EditAnchorsController`, `useEditAnchors`
- [src/interactions/gestures/edit-anchors/geometry.ts](#src-interactions-gestures-edit-anchors-geometry-ts) — `PathAnchor`, `enumerateAnchors`, `withCoord`
- [src/interactions/gestures/edit-anchors/handles.ts](#src-interactions-gestures-edit-anchors-handles-ts) — `AnchorHit`, `hitAnchor`, `PathAnchor`
- [src/interactions/gestures/edit-anchors/index.ts](#src-interactions-gestures-edit-anchors-index-ts) — `useEditAnchors`, `UseEditAnchorsOptions`, `EditAnchorsController`, `EditAnchorsAdapter`, `EditAnchorsOverlay`, `EditAnchorsStartArgs`, `EditAnchorsMoveArgs`, `hitAnchor`, `AnchorHit`, `PathAnchor`, `enumerateAnchors`, `withCoord`, `createAnchorEditOverlayLayer`, `AnchorEditOverlayOpts`
- [src/interactions/gestures/edit-anchors/overlay.ts](#src-interactions-gestures-edit-anchors-overlay-ts) — `AnchorEditOverlayOpts`, `createAnchorEditOverlayLayer`
- [src/interactions/gestures/insert/behaviors/index.ts](#src-interactions-gestures-insert-behaviors-index-ts) — `snapToGrid`
- [src/interactions/gestures/insert/behaviors/snapToGrid.ts](#src-interactions-gestures-insert-behaviors-snaptogrid-ts) — `snapToGrid`
- [src/interactions/gestures/insert/index.ts](#src-interactions-gestures-insert-index-ts) — `useInsert`, `UseInsertOptions`, `InsertController`
- [src/interactions/gestures/insert/insert.ts](#src-interactions-gestures-insert-insert-ts) — `UseInsertOptions`, `InsertController`, `useInsert`
- [src/interactions/gestures/move/behaviors/index.ts](#src-interactions-gestures-move-behaviors-index-ts) — `snapToGrid`, `snapToContainer`, `snapBackOrDelete`
- [src/interactions/gestures/move/behaviors/snapBackOrDelete.ts](#src-interactions-gestures-move-behaviors-snapbackordelete-ts) — `snapBackOrDelete`
- [src/interactions/gestures/move/behaviors/snapToContainer.ts](#src-interactions-gestures-move-behaviors-snaptocontainer-ts) — `snapToContainer`
- [src/interactions/gestures/move/behaviors/snapToGrid.ts](#src-interactions-gestures-move-behaviors-snaptogrid-ts) — `snapToGrid`
- [src/interactions/gestures/move/index.ts](#src-interactions-gestures-move-index-ts) — `useMove`, `UseMoveOptions`, `MoveController`, `MoveStartArgs`, `MoveMoveArgs`, `snapToGrid`, `snapToContainer`, `snapBackOrDelete`
- [src/interactions/gestures/move/move.ts](#src-interactions-gestures-move-move-ts) — `UseMoveOptions`, `MoveStartArgs`, `MoveMoveArgs`, `MoveController`, `useMove`
- [src/interactions/gestures/resize/autoPoseDescriptor.ts](#src-interactions-gestures-resize-autoposedescriptor-ts) — `isPathLike`, `AUTO_POSE_DESCRIPTOR`
- [src/interactions/gestures/resize/behaviors/clampMinSize.ts](#src-interactions-gestures-resize-behaviors-clampminsize-ts) — `clampMinSize`
- [src/interactions/gestures/resize/behaviors/index.ts](#src-interactions-gestures-resize-behaviors-index-ts) — `clampMinSize`, `snapToGrid`
- [src/interactions/gestures/resize/behaviors/snapToGrid.ts](#src-interactions-gestures-resize-behaviors-snaptogrid-ts) — `snapToGrid`
- [src/interactions/gestures/resize/cornerHandles.ts](#src-interactions-gestures-resize-cornerhandles-ts) — `CornerHandle`, `cornerResizeHandles`, `hitCornerHandle`
- [src/interactions/gestures/resize/geometry.ts](#src-interactions-gestures-resize-geometry-ts) — `PoseDescriptor`, `aabbIntersectsRect`, `RECT_POSE_DESCRIPTOR`
- [src/interactions/gestures/resize/index.ts](#src-interactions-gestures-resize-index-ts) — `useResize`, `UseResizeOptions`, `ResizeController`, `RECT_POSE_DESCRIPTOR`, `PoseDescriptor`, `cornerResizeHandles`, `hitCornerHandle`, `CornerHandle`
- [src/interactions/gestures/resize/resize.ts](#src-interactions-gestures-resize-resize-ts) — `UseResizeOptions`, `ResizeController`, `useResize`
- [src/interactions/gestures/rotate/geometry.ts](#src-interactions-gestures-rotate-geometry-ts) — `aabbCenter`, `rotatePoint`, `rectCorners`, `rotatedRectCorners`, `pointInRotatedRect`
- [src/interactions/gestures/rotate/handle.ts](#src-interactions-gestures-rotate-handle-ts) — `DEFAULT_ROTATION_HANDLE_DISTANCE`, `RotationHandle`, `rotationHandle`, `hitRotationHandle`
- [src/interactions/gestures/rotate/index.ts](#src-interactions-gestures-rotate-index-ts) — `useRotate`, `UseRotateOptions`, `RotateController`, `RotateStartArgs`, `RotateMoveArgs`, `RotateGeometry`, `aabbCenter`, `rotatePoint`, `rectCorners`, `rotatedRectCorners`, `pointInRotatedRect`, `rotationHandle`, `hitRotationHandle`, `DEFAULT_ROTATION_HANDLE_DISTANCE`, `RotationHandle`
- [src/interactions/gestures/rotate/rotate.ts](#src-interactions-gestures-rotate-rotate-ts) — `RotateGeometry`, `RotateStartArgs`, `RotateMoveArgs`, `UseRotateOptions`, `RotateController`, `useRotate`, `ResizePose`
- [src/interactions/gestures/shared/index.ts](#src-interactions-gestures-shared-index-ts) — `snap`
- [src/interactions/gestures/shared/snap.ts](#src-interactions-gestures-shared-snap-ts) — `snap`
- [src/interactions/gestures/shared/strategies/grid.ts](#src-interactions-gestures-shared-strategies-grid-ts) — `OriginProjection`, `RECT_ORIGIN_PROJECTION`, `gridSnapStrategy`, `pointToGridCell`
- [src/interactions/gestures/shared/strategies/index.ts](#src-interactions-gestures-shared-strategies-index-ts) — `gridSnapStrategy`, `pointToGridCell`, `RECT_ORIGIN_PROJECTION`, `OriginProjection`
- [src/interactions/gestures/types.ts](#src-interactions-gestures-types-ts) — `ModifierState`, `PointerState`, `GestureContext`, `SnapStrategy`, `GestureBehavior`, `BehaviorMoveResult`, `MoveBehavior`, `MoveOverlay`, `ResizeAnchor`, `ResizePose`, `ResizeProposed`, `ResizeMoveResult`, `ResizeBehavior`, `ResizeOverlay`, `RotatedPose`, `RotateProposed`, `RotateMoveResult`, `RotateBehavior`, `RotateOverlay`, `InsertPoint`, `InsertProposed`, `InsertMoveResult`, `InsertBehavior`, `InsertOverlay`, `AreaSelectPose`, `AreaSelectProposed`, `AreaSelectMoveResult`, `AreaSelectBehavior`, `AreaSelectOverlay`, `ClonePose`, `CloneLayer`, `CloneBehavior`
- [src/interactions/hit/nestedGroupHit.ts](#src-interactions-hit-nestedgrouphit-ts) — `NestedGroupHitOpts`, `NestedGroupHitTester`, `nestedGroupHitTester`
- [src/interactions/usePointerGestures.ts](#src-interactions-usepointergestures-ts) — `PointerGestureBindings`, `PointerGestureCallbackCtx`, `UsePointerGesturesOptions`, `usePointerGestures`
- [src/layout/snaps.ts](#src-layout-snaps-ts) — `none`, `nearest`, `nearestWithin`, `containedThenNearest`, `cellAt`
- [src/layout/strategies/freeform.ts](#src-layout-strategies-freeform-ts) — `FreeformOptions`, `freeform`
- [src/layout/strategies/index.ts](#src-layout-strategies-index-ts) — `freeform`, `FreeformOptions`, `tileGrid`, `TileGridOptions`, `snapPoint`, `SnapPointOptions`
- [src/layout/strategies/snapPoint.ts](#src-layout-strategies-snappoint-ts) — `SnapPointOptions`, `snapPoint`
- [src/layout/strategies/tileGrid.ts](#src-layout-strategies-tilegrid-ts) — `TileGridOptions`, `tileGrid`
- [src/layout/types.ts](#src-layout-types-ts) — `ContainerBounds`, `LayoutChild`, `DropTarget`, `LayoutSnap`, `LayoutContainer`, `LayoutDragged`, `LayoutStrategy`
- [src/tools/builtin/hitExistingGate.ts](#src-tools-builtin-hitexistinggate-ts) — `applyHitExistingGate`
- [src/tools/builtin/index.ts](#src-tools-builtin-index-ts) — `useDeleteTool`, `UseDeleteToolOptions`, `useNudgeTool`, `UseNudgeToolOptions`, `useUndoRedoTool`, `UseUndoRedoToolOptions`, `useDuplicateTool`, `UseDuplicateToolOptions`, `useInsertTool`, `UseInsertToolOptions`, `useSelectTool`, `UseSelectToolOptions`, `AreaSelectOverlayStyle`, `MoveOverlayStyle`, `ResizeOverlayStyle`, `RotateOverlayStyle`, `pickTopMostHit`, `PickTopMostHitAdapter`, `applyHitExistingGate`, `useHandTool`, `useTextTool`, `UseTextToolOptions`, `useWheelZoomTool`, `WheelZoomToolOpts`, `useWheelPanTool`, `useKeyboardZoomTool`, `KeyboardZoomToolOpts`, `useUserPenTool`, `UseUserPenToolOptions`, `PenScratch`, `PenAnchor`, `PenSubpath`, `useEditAnchorsTool`, `UseEditAnchorsToolOptions`, `EditAnchorsScratch`, `useSelectWithAnchorEdit`, `UseSelectWithAnchorEditOptions`, `UseSelectWithAnchorEditReturn`, `SelectWithAnchorEditAdapter`, `SelectWithAnchorEditAnchorsOptions`, `useCloneTool`, `UseCloneToolOptions`, `CloneScratch`, `CloneOverlayItem`
- [src/tools/builtin/marquee.ts](#src-tools-builtin-marquee-ts) — `InsertOverlayStyle`, `drawMarquee`
- [src/tools/builtin/pickTopMostHit.ts](#src-tools-builtin-picktopmosthit-ts) — `PickTopMostHitAdapter`, `pickTopMostHit`
- [src/tools/builtin/testUtils.ts](#src-tools-builtin-testutils-ts) — `makeCtx`, `pe`
- [src/tools/builtin/useCloneTool.ts](#src-tools-builtin-useclonetool-ts) — `CloneOverlayItem`, `CloneScratch`, `UseCloneToolOptions`, `useCloneTool`
- [src/tools/builtin/useDeleteTool.ts](#src-tools-builtin-usedeletetool-ts) — `UseDeleteToolOptions`, `useDeleteTool`
- [src/tools/builtin/useDuplicateTool.ts](#src-tools-builtin-useduplicatetool-ts) — `UseDuplicateToolOptions`, `useDuplicateTool`
- [src/tools/builtin/useEditAnchorsTool.ts](#src-tools-builtin-useeditanchorstool-ts) — `EditAnchorsScratch`, `UseEditAnchorsToolOptions`, `useEditAnchorsTool`
- [src/tools/builtin/useHandTool.ts](#src-tools-builtin-usehandtool-ts) — `useHandTool`
- [src/tools/builtin/useInsertTool.ts](#src-tools-builtin-useinserttool-ts) — `InsertOverlayStyle`, `UseInsertToolOptions`, `useInsertTool`
- [src/tools/builtin/useKeyboardZoomTool.ts](#src-tools-builtin-usekeyboardzoomtool-ts) — `KeyboardZoomToolOpts`, `useKeyboardZoomTool`
- [src/tools/builtin/useNudgeTool.ts](#src-tools-builtin-usenudgetool-ts) — `UseNudgeToolOptions`, `useNudgeTool`
- [src/tools/builtin/useSelectTool.ts](#src-tools-builtin-useselecttool-ts) — `Bounds`, `AreaSelectOverlayStyle`, `MoveOverlayStyle`, `ResizeOverlayStyle`, `RotateOverlayStyle`, `UseSelectToolOptions`, `SelectScratch`, `useSelectTool`
- [src/tools/builtin/useSelectWithAnchorEdit.ts](#src-tools-builtin-useselectwithanchoredit-ts) — `SelectWithAnchorEditAdapter`, `SelectWithAnchorEditAnchorsOptions`, `UseSelectWithAnchorEditOptions`, `UseSelectWithAnchorEditReturn`, `useSelectWithAnchorEdit`
- [src/tools/builtin/useTextTool.ts](#src-tools-builtin-usetexttool-ts) — `UseTextToolOptions`, `useTextTool`
- [src/tools/builtin/useUndoRedoTool.ts](#src-tools-builtin-useundoredotool-ts) — `UseUndoRedoToolOptions`, `useUndoRedoTool`
- [src/tools/builtin/useUserPenTool.ts](#src-tools-builtin-useuserpentool-ts) — `PenAnchor`, `PenSubpath`, `PenScratch`, `UseUserPenToolOptions`, `useUserPenTool`
- [src/tools/builtin/useWheelPanTool.ts](#src-tools-builtin-usewheelpantool-ts) — `useWheelPanTool`
- [src/tools/builtin/useWheelZoomTool.ts](#src-tools-builtin-usewheelzoomtool-ts) — `WheelZoomToolOpts`, `useWheelZoomTool`
- [src/tools/defineTool.ts](#src-tools-definetool-ts) — `defineTool`
- [src/tools/dispatcher.ts](#src-tools-dispatcher-ts) — `ToolsDispatcherOptions`, `ToolsDispatcher`, `createToolsDispatcher`
- [src/tools/index.ts](#src-tools-index-ts) — `defineTool`, `useTools`, `UseToolsOptions`, `ToolsApi`, `useKeybindings`, `UseKeybindingsOptions`, `createToolsDispatcher`, `ToolsDispatcher`, `Tool`, `AnyTool`, `ToolCtx`, `ToolModifiers`, `ToolSlot`, `Decision`, `ModifierTrigger`, `PointerChannel`, `DragChannel`, `KeyboardChannel`, `WheelChannel`
- [src/tools/types.ts](#src-tools-types-ts) — `Decision`, `ToolModifiers`, `ToolCtx`, `PointerChannel`, `DragChannel`, `KeyboardChannel`, `WheelChannel`, `DblTapChannel`, `ModifierTrigger`, `ToolBounds`, `Tool`, `ToolSlot`, `AnyTool`
- [src/tools/useKeybindings.ts](#src-tools-usekeybindings-ts) — `UseKeybindingsOptions`, `useKeybindings`
- [src/tools/useTools.ts](#src-tools-usetools-ts) — `UseToolsOptions`, `ToolsApi`, `useTools`
- [src/util/constrainTo45.ts](#src-util-constrainto45-ts) — `constrainTo45`

---

## src/animation/behaviors/momentum.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `MomentumOptions` | interface | `{ animator, friction, threshold, velocitySampleMs, now }` |  |
| `MomentumOptions.animator` | field | `Animator` | Required: the per-Canvas animator that will own the decay. |
| `MomentumOptions.friction?` | field | `number` |  |
| `MomentumOptions.threshold?` | field | `number` |  |
| `MomentumOptions.velocitySampleMs?` | field | `number` | Sample window in ms for velocity computation. |
| `MomentumOptions.now?` | field | `() => number` | Optional clock override for tests. |
| `momentum` | function | `(opts: MomentumOptions) => MoveBehavior<TPose>` |  |
| `momentum.opts` | param | `opts: MomentumOptions` |  |

## src/animation/easings.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `linear` | function | `(t)` | compatibility with existing call sites. |
| `linear.t` | param | `t` |  |
| `easeInQuad` | function | `(t)` | Quadratic (degree 2) |
| `easeInQuad.t` | param | `t` |  |
| `easeOutQuad` | function | `(t)` |  |
| `easeOutQuad.t` | param | `t` |  |
| `easeInOutQuad` | function | `(t)` |  |
| `easeInOutQuad.t` | param | `t` |  |
| `easeInCubic` | function | `(t)` | Cubic (degree 3) |
| `easeInCubic.t` | param | `t` |  |
| `easeOutCubic` | function | `(t)` |  |
| `easeOutCubic.t` | param | `t` |  |
| `easeInOutCubic` | function | `(t)` |  |
| `easeInOutCubic.t` | param | `t` |  |
| `easeInQuart` | function | `(t)` | Quartic (degree 4) |
| `easeInQuart.t` | param | `t` |  |
| `easeOutQuart` | function | `(t)` |  |
| `easeOutQuart.t` | param | `t` |  |
| `easeInOutQuart` | function | `(t)` |  |
| `easeInOutQuart.t` | param | `t` |  |
| `easeInQuint` | function | `(t)` | Quintic (degree 5) |
| `easeInQuint.t` | param | `t` |  |
| `easeOutQuint` | function | `(t)` |  |
| `easeOutQuint.t` | param | `t` |  |
| `easeInOutQuint` | function | `(t)` |  |
| `easeInOutQuint.t` | param | `t` |  |
| `easeInSine` | function | `(t)` | --- Trigonometric / transcendental |
| `easeInSine.t` | param | `t` |  |
| `easeOutSine` | function | `(t)` |  |
| `easeOutSine.t` | param | `t` |  |
| `easeInOutSine` | function | `(t)` |  |
| `easeInOutSine.t` | param | `t` |  |
| `easeInExpo` | function | `(t)` |  |
| `easeInExpo.t` | param | `t` |  |
| `easeOutExpo` | function | `(t)` |  |
| `easeOutExpo.t` | param | `t` |  |
| `easeInOutExpo` | function | `(t)` |  |
| `easeInOutExpo.t` | param | `t` |  |
| `easeInCirc` | function | `(t)` |  |
| `easeInCirc.t` | param | `t` |  |
| `easeOutCirc` | function | `(t)` |  |
| `easeOutCirc.t` | param | `t` |  |
| `easeInOutCirc` | function | `(t)` |  |
| `easeInOutCirc.t` | param | `t` |  |
| `easeInBack` | function | `(t)` |  |
| `easeInBack.t` | param | `t` |  |
| `easeOutBack` | function | `(t)` |  |
| `easeOutBack.t` | param | `t` |  |
| `easeInOutBack` | function | `(t)` |  |
| `easeInOutBack.t` | param | `t` |  |
| `easeInElastic` | function | `(t)` |  |
| `easeInElastic.t` | param | `t` |  |
| `easeOutElastic` | function | `(t)` |  |
| `easeOutElastic.t` | param | `t` |  |
| `easeInOutElastic` | function | `(t)` |  |
| `easeInOutElastic.t` | param | `t` |  |
| `easeOutBounce` | function | `(t)` |  |
| `easeOutBounce.t` | param | `t` |  |
| `easeInBounce` | function | `(t)` |  |
| `easeInBounce.t` | param | `t` |  |
| `easeInOutBounce` | function | `(t)` |  |
| `easeInOutBounce.t` | param | `t` |  |
| `easeIn` | const | `easeInQuad` | `easeOut`/`easeInOut`; those resolve to the quadratic curve. |
| `easeOut` | const | `easeOutQuad` |  |
| `easeInOut` | const | `easeInOutQuad` |  |
| `EASINGS` | const | `{ linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeInQuart, easeOutQuart, ` | All easings in one bag — useful for demos / pickers. |
| `EasingName` | type | `keyof typeof EASINGS` |  |
| `SPRING_PRESETS` | const | `Record<SpringPresetName, SpringPreset>` |  |

## src/animation/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from './types'` | reexport-all | `*` |  |
| `linear` | reexport | `re-export from './easings'` |  |
| `easeIn` | reexport | `re-export from './easings'` |  |
| `easeOut` | reexport | `re-export from './easings'` |  |
| `easeInOut` | reexport | `re-export from './easings'` |  |
| `easeInQuad` | reexport | `re-export from './easings'` |  |
| `easeOutQuad` | reexport | `re-export from './easings'` |  |
| `easeInOutQuad` | reexport | `re-export from './easings'` |  |
| `easeInCubic` | reexport | `re-export from './easings'` |  |
| `easeOutCubic` | reexport | `re-export from './easings'` |  |
| `easeInOutCubic` | reexport | `re-export from './easings'` |  |
| `easeInQuart` | reexport | `re-export from './easings'` |  |
| `easeOutQuart` | reexport | `re-export from './easings'` |  |
| `easeInOutQuart` | reexport | `re-export from './easings'` |  |
| `easeInQuint` | reexport | `re-export from './easings'` |  |
| `easeOutQuint` | reexport | `re-export from './easings'` |  |
| `easeInOutQuint` | reexport | `re-export from './easings'` |  |
| `easeInSine` | reexport | `re-export from './easings'` |  |
| `easeOutSine` | reexport | `re-export from './easings'` |  |
| `easeInOutSine` | reexport | `re-export from './easings'` |  |
| `easeInExpo` | reexport | `re-export from './easings'` |  |
| `easeOutExpo` | reexport | `re-export from './easings'` |  |
| `easeInOutExpo` | reexport | `re-export from './easings'` |  |
| `easeInCirc` | reexport | `re-export from './easings'` |  |
| `easeOutCirc` | reexport | `re-export from './easings'` |  |
| `easeInOutCirc` | reexport | `re-export from './easings'` |  |
| `easeInBack` | reexport | `re-export from './easings'` |  |
| `easeOutBack` | reexport | `re-export from './easings'` |  |
| `easeInOutBack` | reexport | `re-export from './easings'` |  |
| `easeInElastic` | reexport | `re-export from './easings'` |  |
| `easeOutElastic` | reexport | `re-export from './easings'` |  |
| `easeInOutElastic` | reexport | `re-export from './easings'` |  |
| `easeInBounce` | reexport | `re-export from './easings'` |  |
| `easeOutBounce` | reexport | `re-export from './easings'` |  |
| `easeInOutBounce` | reexport | `re-export from './easings'` |  |
| `EASINGS` | reexport | `re-export from './easings'` |  |
| `EasingName` | reexport | `re-export from './easings'` |  |
| `SPRING_PRESETS` | reexport | `re-export from './easings'` |  |
| `useAnimator` | reexport | `re-export from './useAnimator'` |  |
| `tweenPose` | reexport | `re-export from './poseHelpers'` |  |
| `springPose` | reexport | `re-export from './poseHelpers'` |  |
| `TweenPoseOptions` | reexport | `re-export from './poseHelpers'` |  |
| `SpringPoseOptions` | reexport | `re-export from './poseHelpers'` |  |
| `* from './wrappers'` | reexport-all | `*` |  |
| `momentum` | reexport | `re-export from './behaviors/momentum'` |  |
| `MomentumOptions` | reexport | `re-export from './behaviors/momentum'` |  |

## src/animation/poseHelpers.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `TweenPoseOptions` | interface | `{ id, to, ms, easing, geometry, recordOp, opLabel, onDone }` |  |
| `TweenPoseOptions.id` | field | `string` |  |
| `TweenPoseOptions.to` | field | `TPose` |  |
| `TweenPoseOptions.ms` | field | `number` |  |
| `TweenPoseOptions.easing?` | field | `EasingFn` |  |
| `TweenPoseOptions.geometry?` | field | `PoseDescriptor<TPose>` | Pose descriptor with a `lerp(from, to, t)` method. |
| `TweenPoseOptions.recordOp?` | field | `boolean` | When true (default), emit a transform op before the tween so undo restores the pre-animation pose. |
| `TweenPoseOptions.opLabel?` | field | `string` | Label for the recorded op. |
| `TweenPoseOptions.onDone?` | field | `() => void` |  |
| `SpringPoseOptions` | interface | `{ id, to, preset, stiffness, damping, mass, geometry, recordOp, opLabel, onDone }` |  |
| `SpringPoseOptions.id` | field | `string` |  |
| `SpringPoseOptions.to` | field | `TPose` |  |
| `SpringPoseOptions.preset?` | field | `SpringPresetName` |  |
| `SpringPoseOptions.stiffness?` | field | `number` |  |
| `SpringPoseOptions.damping?` | field | `number` |  |
| `SpringPoseOptions.mass?` | field | `number` |  |
| `SpringPoseOptions.geometry?` | field | `PoseDescriptor<TPose>` |  |
| `SpringPoseOptions.recordOp?` | field | `boolean` |  |
| `SpringPoseOptions.opLabel?` | field | `string` |  |
| `SpringPoseOptions.onDone?` | field | `() => void` |  |
| `tweenPose` | function | `(animator: Animator, adapter: SceneAdapter<TNode, TPose>, opts: TweenPoseOptions<TPose>) => AnimationHandle` |  |
| `tweenPose.animator` | param | `animator: Animator` |  |
| `tweenPose.adapter` | param | `adapter: SceneAdapter<TNode, TPose>` |  |
| `tweenPose.opts` | param | `opts: TweenPoseOptions<TPose>` |  |
| `springPose` | function | `(animator: Animator, adapter: SceneAdapter<TNode, TPose>, opts: SpringPoseOptions<TPose>) => AnimationHandle` |  |
| `springPose.animator` | param | `animator: Animator` |  |
| `springPose.adapter` | param | `adapter: SceneAdapter<TNode, TPose>` |  |
| `springPose.opts` | param | `opts: SpringPoseOptions<TPose>` |  |

## src/animation/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `EasingFn` | type | `(t: number) => number` |  |
| `Interpolate` | type | `(from: T, to: T, t: number) => T` |  |
| `SpringPreset` | interface | `{ stiffness, damping, mass }` |  |
| `SpringPreset.stiffness` | field | `number` |  |
| `SpringPreset.damping` | field | `number` |  |
| `SpringPreset.mass` | field | `number` |  |
| `SpringPresetName` | type | `'gentle' \| 'wobbly' \| 'stiff' \| 'slow'` |  |
| `AnimationHandle` | interface | `{ id, cancel }` |  |
| `AnimationHandle.id` | field | `number` | Monotonic id assigned by the animator. |
| `AnimationHandle.cancel` | field | `void` | Cancel this animation. |
| `TweenOptions` | interface | `{ from, to, ms, easing, interpolate, onTick, onDone, cancelKey }` |  |
| `TweenOptions.from` | field | `T` |  |
| `TweenOptions.to` | field | `T` |  |
| `TweenOptions.ms` | field | `number` |  |
| `TweenOptions.easing?` | field | `EasingFn` |  |
| `TweenOptions.interpolate?` | field | `Interpolate<T>` | Required when T is not `number`. |
| `TweenOptions.onTick` | field | `(value: T) => void` |  |
| `TweenOptions.onDone?` | field | `() => void` |  |
| `TweenOptions.cancelKey?` | field | `string` | Any new animation passed the same cancelKey cancels the prior one in flight. |
| `SpringOptions` | interface | `{ from, to, velocity, preset, stiffness, damping, mass, interpolate, add, subtract, ... }` |  |
| `SpringOptions.from` | field | `T` |  |
| `SpringOptions.to` | field | `T` |  |
| `SpringOptions.velocity?` | field | `T` | Initial velocity in T-units per second. |
| `SpringOptions.preset?` | field | `SpringPresetName` |  |
| `SpringOptions.stiffness?` | field | `number` |  |
| `SpringOptions.damping?` | field | `number` |  |
| `SpringOptions.mass?` | field | `number` |  |
| `SpringOptions.interpolate?` | field | `Interpolate<T>` |  |
| `SpringOptions.add?` | field | `(a: T, b: T) => T` | Vector helpers — required for non-numeric T. |
| `SpringOptions.subtract?` | field | `(a: T, b: T) => T` |  |
| `SpringOptions.scale?` | field | `(v: T, k: number) => T` |  |
| `SpringOptions.magnitude?` | field | `(v: T) => number` |  |
| `SpringOptions.restThreshold?` | field | `number` | Velocity magnitude below which the spring is considered settled. |
| `SpringOptions.onTick` | field | `(value: T) => void` |  |
| `SpringOptions.onDone?` | field | `() => void` |  |
| `SpringOptions.cancelKey?` | field | `string` |  |
| `DecayOptions` | interface | `{ from, velocity, friction, threshold, add, scale, magnitude, onTick, onDone, cancelKey }` |  |
| `DecayOptions.from` | field | `T` |  |
| `DecayOptions.velocity` | field | `T` |  |
| `DecayOptions.friction?` | field | `number` | Per-second velocity multiplier in (0, 1). |
| `DecayOptions.threshold?` | field | `number` | Velocity magnitude below which decay stops. |
| `DecayOptions.add` | field | `(a: T, b: T) => T` |  |
| `DecayOptions.scale` | field | `(v: T, k: number) => T` |  |
| `DecayOptions.magnitude` | field | `(v: T) => number` |  |
| `DecayOptions.onTick` | field | `(value: T) => void` |  |
| `DecayOptions.onDone?` | field | `() => void` |  |
| `DecayOptions.cancelKey?` | field | `string` |  |
| `UseAnimatorOptions` | interface | `{ now, requestFrame, cancelFrame }` |  |
| `UseAnimatorOptions.now?` | field | `() => number` | Optional clock injection for tests. |
| `UseAnimatorOptions.requestFrame?` | field | `(cb: (t: number) => void) => number` | Optional rAF / cAF injection for tests. |
| `UseAnimatorOptions.cancelFrame?` | field | `(handle: number) => void` |  |
| `Animator` | interface | `{ tween, spring, decay, cancel, cancelKey, cancelAll, isActive }` |  |
| `Animator.tween` | field | `AnimationHandle` |  |
| `Animator.spring` | field | `AnimationHandle` |  |
| `Animator.decay` | field | `AnimationHandle` |  |
| `Animator.cancel` | field | `void` | Cancel a specific animation by handle. |
| `Animator.cancelKey` | field | `void` | Cancel every animation currently active under `key`. |
| `Animator.cancelAll` | field | `void` | Cancel everything. |
| `Animator.isActive` | field | `boolean` | True iff at least one animation is active. |

## src/animation/useAnimator.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useAnimator` | hook | `(opts: UseAnimatorOptions = {}) => Animator` |  |
| `useAnimator.opts` | param | `opts: UseAnimatorOptions = {}` |  |

## src/animation/wrappers/animateLifecycle.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `LifecycleAnimation` | interface | `{ enterFrom, exitTo, ms, easing, geometry }` |  |
| `LifecycleAnimation.enterFrom?` | field | `(final: TPose) => TPose` | Pose to animate the new object FROM at insert. |
| `LifecycleAnimation.exitTo?` | field | `(current: TPose) => TPose` | Pose to animate the existing object TO at remove. |
| `LifecycleAnimation.ms?` | field | `number` |  |
| `LifecycleAnimation.easing?` | field | `EasingFn` |  |
| `LifecycleAnimation.geometry?` | field | `PoseDescriptor<TPose>` |  |
| `animateLifecycle` | function | `(adapter: SceneAdapter<TNode, TPose>, animator: Animator, opts: LifecycleAnimation<TPose>) => SceneAdapter<TNode, TPose>` |  |
| `animateLifecycle.adapter` | param | `adapter: SceneAdapter<TNode, TPose>` |  |
| `animateLifecycle.animator` | param | `animator: Animator` |  |
| `animateLifecycle.opts` | param | `opts: LifecycleAnimation<TPose>` |  |

## src/animation/wrappers/animateOnSetPose.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `AnimateOnSetPoseOptions` | interface | `{ ms, easing, spring, geometry, shouldAnimate, skipDuringGesture, gestureScope, opLabel }` |  |
| `AnimateOnSetPoseOptions.ms?` | field | `number` | Default: 200ms tween with easeOut. |
| `AnimateOnSetPoseOptions.easing?` | field | `EasingFn` |  |
| `AnimateOnSetPoseOptions.spring?` | field | `{ preset?: SpringPresetName; stiffness?: number; damping?: number; mass?: number; }` | Use a spring instead of a duration tween. |
| `AnimateOnSetPoseOptions.geometry?` | field | `PoseDescriptor<TPose>` |  |
| `AnimateOnSetPoseOptions.shouldAnimate?` | field | `(id: string, from: TPose, to: TPose) => boolean` | Predicate: return false to skip animation and write through immediately. |
| `AnimateOnSetPoseOptions.skipDuringGesture?` | field | `boolean` | Convenience: when true, auto-skip animation if the id is currently being manipulated by an active gesture. |
| `AnimateOnSetPoseOptions.gestureScope?` | field | `ReadonlySet<string>` | Optional: a Set the kit (or app) populates with ids currently being manipulated by a gesture. |
| `AnimateOnSetPoseOptions.opLabel?` | field | `string` | Op label for the recorded transform op. |
| `animateOnSetPose` | function | `(adapter: SceneAdapter<TNode, TPose>, animator: Animator, opts: AnimateOnSetPoseOptions<TPose> = {}) => SceneAdapter<TNode, TPose>` |  |
| `animateOnSetPose.adapter` | param | `adapter: SceneAdapter<TNode, TPose>` |  |
| `animateOnSetPose.animator` | param | `animator: Animator` |  |
| `animateOnSetPose.opts` | param | `opts: AnimateOnSetPoseOptions<TPose> = {}` |  |

## src/animation/wrappers/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `animateOnSetPose` | reexport | `re-export from './animateOnSetPose'` |  |
| `AnimateOnSetPoseOptions` | reexport | `re-export from './animateOnSetPose'` |  |
| `animateLifecycle` | reexport | `re-export from './animateLifecycle'` |  |
| `LifecycleAnimation` | reexport | `re-export from './animateLifecycle'` |  |

## src/canvas/Canvas.tsx

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `STANDARD_SLOTS` | const | `[ 'grid', 'cellHighlight', 'scene', 'selectionOverlay', ] as const` | Standard slot names — render in this canonical order. |
| `StandardSlotName` | type | `Exclude<(typeof STANDARD_SLOTS)[number], 'cellHighlight'>` | Names of the slots `<Canvas>` supports out of the box (excluding the implicit cell-highlight overlay). |
| `GridSlotConfig` | type | `GridLayerOpts & { /** Cell-highlight overlay; omit or set to `null` to skip. */ highlight?: CellHighlightLayerOpts \| null; }` | Grid slot config — extends raw grid layer opts with an optional nested `highlight` sub-config. |
| `SceneSlotConfig` | interface | `{ objects, toPose, drawOne, ghostAlpha }` | Scene slot config — describes how to draw one object with its effective pose. |
| `SceneSlotConfig.objects?` | field | `TNode[]` | Override `adapter.getNodes()` for the object iteration. |
| `SceneSlotConfig.toPose?` | field | `(obj: TNode) => TPose` | Project an object to its committed pose. |
| `SceneSlotConfig.drawOne` | field | `(ctx: CanvasRenderingContext2D, obj: TNode, pose: TPose, view: View) => void` | Draw a single object given its effective pose. |
| `SceneSlotConfig.ghostAlpha?` | field | `number` | Default ghost alpha for the move-overlay slot. |
| `SelectionOverlaySlotConfig` | type | `Omit< SelectionOverlayLayerOpts<TPose>, 'getSelection' \| 'getPose' > & { /** Override the auto-wired pose lookup (overlay-aware → adapter fallback). */ poseById?: (id: string) => TPose \| null; }` | Selection-overlay slot config — passed through to `createSelectionOverlayLayer`, minus the `getSelection`/`getPose` Canvas wires automatically. |
| `CustomLayerEntry` | interface | `{ layer, after, before }` | Custom layer entry — any key not in `STANDARD_SLOTS`. |
| `CustomLayerEntry.layer` | field | `RenderLayer<unknown>` |  |
| `CustomLayerEntry.after?` | field | `StandardSlotName` | Insert immediately after the named standard slot. |
| `CustomLayerEntry.before?` | field | `StandardSlotName` | Insert immediately before the named standard slot. |
| `StandardSlotConfig` | type | `\| GridSlotConfig \| SceneSlotConfig<TNode, TPose> \| SelectionOverlaySlotConfig<TPose>` | Per-slot config union. |
| `LayerSlotValue` | type | `\| StandardSlotConfig<TNode, TPose> \| CustomLayerEntry \| null` |  |
| `LayersMap` | type | `{ grid?: GridSlotConfig \| null; scene?: SceneSlotConfig<TNode, TPose> \| null; selectionOverlay?: SelectionOverlaySlotConfig<TPose> \| null; } & { [customKey: string]: LayerSlotValue<TNode, TPose> \|...` |  |
| `CanvasSelectionMode` | type | `'single' \| 'multi' \| 'none'` | High-level selection semantics. |
| `CanvasProps` | interface | `{ width, height, adapter, items, setItems, toPose, fromPose, createDefault, poseBounds, intersectsRect, ... }` | Props for the top-level `<Canvas>` component — combines viewport, scene, gesture controllers, and slot overrides. |
| `CanvasProps.width` | field | `number` | CSS-pixel width. |
| `CanvasProps.height` | field | `number` | CSS-pixel height. |
| `CanvasProps.adapter?` | field | `MoveAdapter<TNode, TPose> & ResizeAdapter<TNode, TPose> & RotateAdapter<TNode, TPose>` | Combined adapter. |
| `CanvasProps.items?` | field | `TNode[]` | Inline scene wiring: when `adapter` is omitted and `items`/`setItems` are provided, Canvas synthesizes an `arrayAdapter` internally (via `useArrayAdapter`). |
| `CanvasProps.setItems?` | field | `UseArrayAdapterOptions<TNode, TPose>['setItems']` | @deprecated Use `useScene({ items })` + `<SceneCanvas>`. |
| `CanvasProps.toPose?` | field | `UseArrayAdapterOptions<TNode, TPose>['toPose']` | @deprecated Use `useScene({ items })` + `<SceneCanvas>`. |
| `CanvasProps.fromPose?` | field | `UseArrayAdapterOptions<TNode, TPose>['fromPose']` | @deprecated Use `useScene({ items })` + `<SceneCanvas>`. |
| `CanvasProps.createDefault?` | field | `UseArrayAdapterOptions<TNode, TPose>['createDefault']` | @deprecated Use `useScene({ items })` + `<SceneCanvas>`. |
| `CanvasProps.poseBounds?` | field | `UseArrayAdapterOptions<TNode, TPose>['poseBounds']` | @deprecated Use `useScene({ items })` + `<SceneCanvas>`. |
| `CanvasProps.intersectsRect?` | field | `UseArrayAdapterOptions<TNode, TPose>['intersectsRect']` | @deprecated Use `useScene({ items })` + `<SceneCanvas>`. |
| `CanvasProps.selectionMode?` | field | `CanvasSelectionMode` | Selection semantics. |
| `CanvasProps.layers` | field | `LayersMap<TNode, TPose>` | Layer map. |
| `CanvasProps.selection?` | field | `SelectionApi` | --- Internal hook configuration --- |
| `CanvasProps.selectionOptions?` | field | `UseSelectionOptions` |  |
| `CanvasProps.geometry?` | field | `PoseDescriptor<TPose>` | Pose↔bounds projection. |
| `CanvasProps.pickEvery?` | field | `(worldX: number, worldY: number) => string \| string[] \| null` | --- Gesture overrides (escape hatches for non-rect / group-aware apps) --- |
| `CanvasProps.boundsOf?` | field | `(id: string) => Bounds \| null` |  |
| `CanvasProps.clientToWorld?` | field | `(canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number]` |  |
| `CanvasProps.onPointerDown?` | field | `React.PointerEventHandler<HTMLCanvasElement>` | --- Per-event overrides — replace the auto-built handler entirely --- |
| `CanvasProps.onPointerMove?` | field | `React.PointerEventHandler<HTMLCanvasElement>` |  |
| `CanvasProps.onPointerUp?` | field | `React.PointerEventHandler<HTMLCanvasElement>` |  |
| `CanvasProps.onPointerCancel?` | field | `React.PointerEventHandler<HTMLCanvasElement>` |  |
| `CanvasProps.background?` | field | `string` | --- Visuals / DOM passthrough --- |
| `CanvasProps.className?` | field | `string` |  |
| `CanvasProps.style?` | field | `React.CSSProperties` |  |
| `CanvasProps.tabIndex?` | field | `number` |  |
| `CanvasProps.autoFocusOnPointerDown?` | field | `boolean` |  |
| `CanvasProps.tools?` | field | `import('../tools/useTools').ToolsApi` | Tool primitive substrate. |
| `CanvasProps.gestures?` | field | `GesturesConfig<TPose>` |  |
| `CanvasProps.view?` | field | `View` | Controlled viewport. |
| `CanvasProps.defaultView?` | field | `View` | Initial viewport for the uncontrolled path. |
| `CanvasProps.onViewChange?` | field | `(next: View) => void` | Fires whenever the viewport changes — in both controlled and uncontrolled modes. |
| `CanvasProps.viewBounds?` | field | `{ x: number; y: number; width: number; height: number }` | Optional world-space rect that constrains pan. |
| `CanvasProps.helpersRef?` | field | `React.MutableRefObject<CanvasHelpers<TPose> \| null>` | Mutable ref Canvas writes overlay-aware pose/bounds lookups to on every render. |
| `CanvasProps.debug?` | field | `DebugConfig \| false` | Debug overlay configuration. |
| `CanvasProps.debugSinkRef?` | field | `React.MutableRefObject<(DebugSink & { snapshot(): DebugSnapshot }) \| null>` | Test-only escape hatch: writes the live debug sink to this ref so tests can call `snapshot()` after a render. |
| `DeleteGestureConfig` | interface | `{ label, filter }` | Per-action config for the `gestures` prop. |
| `DeleteGestureConfig.label?` | field | `string` |  |
| `DeleteGestureConfig.filter?` | field | `(ids: string[]) => string[]` |  |
| `NudgeGestureConfig` | interface | `{ step, shiftStep, label, translatePose }` |  |
| `NudgeGestureConfig.step?` | field | `number` |  |
| `NudgeGestureConfig.shiftStep?` | field | `number` |  |
| `NudgeGestureConfig.label?` | field | `string` |  |
| `NudgeGestureConfig.translatePose?` | field | `(pose: TPose, dx: number, dy: number) => TPose` | Override pose translation. |
| `DuplicateGestureConfig` | interface | `{ cloneNode, offset, label }` |  |
| `DuplicateGestureConfig.cloneNode` | field | `(id: string, offset: { dx: number; dy: number }) => { id: string }` |  |
| `DuplicateGestureConfig.offset?` | field | `{ dx: number; dy: number }` |  |
| `DuplicateGestureConfig.label?` | field | `string` |  |
| `UndoRedoGestureConfig` | interface | `{ adapter }` |  |
| `UndoRedoGestureConfig.adapter` | field | `UndoRedoAdapter` | Source of the undo/redo stack — typically a `Scene` or `History`. |
| `GesturesConfig` | interface | `{ delete, nudge, duplicate, undoRedo }` |  |
| `GesturesConfig.delete?` | field | `boolean \| DeleteGestureConfig` | Bind Delete/Backspace to remove the current selection. |
| `GesturesConfig.nudge?` | field | `boolean \| NudgeGestureConfig<TPose>` | Bind arrow keys to translate the current selection (shift = larger step). |
| `GesturesConfig.duplicate?` | field | `DuplicateGestureConfig` | Bind Mod+D to duplicate the current selection. |
| `GesturesConfig.undoRedo?` | field | `UndoRedoGestureConfig` | Bind Mod+Z / Mod+Shift+Z to undo/redo against the supplied adapter. |
| `CanvasHelpers` | interface | `{ getEffectivePose, getEffectiveBounds }` | Live overlay-aware lookups exposed to custom layers via `helpersRef`. |
| `CanvasHelpers.getEffectivePose` | field | `TPose \| null` | Pose currently displayed for `id` — drag/resize/rotate overlay if active, otherwise the committed pose from the adapter. |
| `CanvasHelpers.getEffectiveBounds` | field | `Bounds \| null` | Overlay-aware bounds for `id`. |
| `Canvas` | const | `forwardRef(CanvasInner) as < TNode extends { id: string } = { id: string }, TPose = TNode, >( props: CanvasProps<TOb` | Forward-ref'd `<canvas>` wrapper. |

## src/canvas/SceneCanvas.tsx

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `SceneCanvasProps` | type | `Omit< CanvasProps<Node<TData, TLayer, TPose>, TPose>, \| 'adapter' \| 'items' \| 'setItems' \| 'toPose' \| 'fromPose' \| 'createDefault' \| 'poseBounds' \| 'intersectsRect' \| 'moveOptions' \| 'resizeOptions' \|...` |  |
| `SceneCanvas` | const | `forwardRef(SceneCanvasInner) as < TData, TLayer extends string, TPose, >( props: SceneCanvasProps<TData, TLayer, TPose> ` |  |

## src/canvas/sceneAdapter.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `SceneAdapterSelection` | interface | `{ get, set, getSelection, setSelection }` | Minimal selection contract `sceneToAdapter` needs to wire `getSelection` / `setSelection`. |
| `SceneAdapterSelection.get?` | field | `string[]` |  |
| `SceneAdapterSelection.set?` | field | `void` |  |
| `SceneAdapterSelection.getSelection?` | field | `string[]` |  |
| `SceneAdapterSelection.setSelection?` | field | `void` |  |
| `SceneCanvasAdapter` | type | `& MoveAdapter<Node<TData, TLayer, TPose>, TPose> & ResizeAdapter<Node<TData, TLayer, TPose>, TPose> & RotateAdapter<Node<TData, TLayer, TPose>, TPose> & AreaSelectAdapter & Partial<InsertAdapter<Node<...` |  |
| `SceneToAdapterOptions` | interface | `{ commitInsert, insertLayer, selection, poseBounds }` | Optional extras for the synthesized adapter. |
| `SceneToAdapterOptions.commitInsert?` | field | `(bounds: Bounds) => { pose: TPose; data: TData; id?: string; } \| null` | Factory for new objects. |
| `SceneToAdapterOptions.insertLayer?` | field | `TLayer` | Layer to place inserted nodes on. |
| `SceneToAdapterOptions.selection?` | field | `SceneAdapterSelection` | Selection source for `AreaSelectAdapter.getSelection` / `setSelection`. |
| `SceneToAdapterOptions.poseBounds?` | field | `(pose: TPose) => Bounds` | Project a pose to an AABB for `hitTestArea`. |
| `sceneToAdapter` | function | `(scene: Scene<TData, TLayer, TPose>, options: SceneToAdapterOptions<TData, TLayer, TPose> = {}) => SceneCanvasAdapter<TData, TLayer, TPose>` |  |
| `sceneToAdapter.scene` | param | `scene: Scene<TData, TLayer, TPose>` |  |
| `sceneToAdapter.options` | param | `options: SceneToAdapterOptions<TData, TLayer, TPose> = {}` |  |

## src/core/adapters/arrayAdapter.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ArrayAdapterConfig` | interface | `{ ref, setItems, toPose, fromPose, getParent, setParent, getChildren, selectionRef, setSelection, createDefault, ... }` | Configuration for `arrayAdapter`. |
| `ArrayAdapterConfig.ref` | field | `MutableRefObject<TNode[]>` | Live ref to the current array. |
| `ArrayAdapterConfig.setItems` | field | `(updater: (items: TNode[]) => TNode[]) => void` | Functional setter (typically the second value from `useState`). |
| `ArrayAdapterConfig.toPose` | field | `(obj: TNode) => TPose` | Project an object to its pose. |
| `ArrayAdapterConfig.fromPose?` | field | `(obj: TNode, pose: TPose) => TNode` | Merge a new pose back into an object. |
| `ArrayAdapterConfig.getParent?` | field | `(id: string) => string \| null` | Optional parent lookup. |
| `ArrayAdapterConfig.setParent?` | field | `(id: string, parentId: string \| null) => void` | Optional reparent mutator. |
| `ArrayAdapterConfig.getChildren?` | field | `(id: string) => string[] \| undefined` | Optional children lookup. |
| `ArrayAdapterConfig.selectionRef?` | field | `MutableRefObject<string[]>` | Live ref to the current selection. |
| `ArrayAdapterConfig.setSelection?` | field | `(ids: string[]) => void` | Selection setter. |
| `ArrayAdapterConfig.createDefault?` | field | `(bounds: Bounds) => TNode \| null` | Factory for `commitInsert` — invoked at the end of an insert drag. |
| `ArrayAdapterConfig.poseBounds?` | field | `(pose: TPose) => Bounds` | Project a pose to an AABB for `hitTestArea`. |
| `ArrayAdapterConfig.intersectsRect?` | field | `(pose: TPose, rect: Bounds) => boolean` | Tight intersection test against a pose. |
| `ArrayAdapter` | interface | `{ getNodes, removeNode, getSelection, setSelection }` | Combined adapter satisfying every narrow adapter the kit ships. |
| `ArrayAdapter.getNodes` | field | `TNode[]` |  |
| `ArrayAdapter.removeNode` | field | `void` |  |
| `ArrayAdapter.getSelection` | field | `string[]` | required on InsertAdapter so TS sees a single non-conflicting signature. |
| `ArrayAdapter.setSelection` | field | `void` |  |
| `arrayAdapter` | function | `(config: ArrayAdapterConfig<TNode, TPose>) => ArrayAdapter<TNode, TPose>` | Synthesize a many-faceted adapter from a `useState`-array scene. |
| `arrayAdapter.config` | param | `config: ArrayAdapterConfig<TNode, TPose>` |  |

## src/core/adapters/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ClipboardSnapshot` | interface | `{ items }` | Opaque clipboard payload. |
| `ClipboardSnapshot.items` | field | `unknown[]` |  |
| `SnapTarget` | interface | `{ parentId, slotPose, metadata }` | SnapTarget — where a dragged object would re-parent to if released. |
| `SnapTarget.parentId` | field | `string` |  |
| `SnapTarget.slotPose` | field | `TPose` |  |
| `SnapTarget.metadata?` | field | `unknown` |  |
| `SceneAdapter` | interface | `{ getNodes, getNode, getSelection, hitTest, getPose, getParent, setPose, setParent, insertNode, removeNode, ... }` | Full scene adapter. |
| `SceneAdapter.getNodes` | field | `TNode[]` | Pull (gesture-time queries) |
| `SceneAdapter.getNode` | field | `TNode \| undefined` |  |
| `SceneAdapter.getSelection` | field | `string[]` |  |
| `SceneAdapter.hitTest` | field | `string \| null` |  |
| `SceneAdapter.getPose` | field | `TPose` |  |
| `SceneAdapter.getParent` | field | `string \| null` |  |
| `SceneAdapter.setPose` | field | `void` | Mutators (called by op apply methods) |
| `SceneAdapter.setParent` | field | `void` |  |
| `SceneAdapter.insertNode` | field | `void` |  |
| `SceneAdapter.removeNode` | field | `void` |  |
| `SceneAdapter.setSelection` | field | `void` |  |
| `SceneAdapter.applyBatch?` | field | `void` | adapter directly. |
| `MoveAdapter` | interface | `{ getNode, getNodes, getPose, getParent, setPose, setParent, applyBatch, findSnapTarget, getChildren, getLayout }` | Narrow adapter for `useMove`. |
| `MoveAdapter.getNode` | field | `TNode \| undefined` |  |
| `MoveAdapter.getNodes` | field | `TNode[]` | Enumerate all objects. |
| `MoveAdapter.getPose` | field | `TPose` |  |
| `MoveAdapter.getParent?` | field | `string \| null` | Optional. |
| `MoveAdapter.setPose` | field | `void` |  |
| `MoveAdapter.setParent?` | field | `void` | Optional. |
| `MoveAdapter.applyBatch?` | field | `void` | Optional: see SceneAdapter.applyBatch. |
| `MoveAdapter.findSnapTarget?` | field | `SnapTarget<TPose> \| null` |  |
| `MoveAdapter.getChildren?` | field | `string[]` | Optional: direct children of `id`. |
| `MoveAdapter.getLayout?` | field | `import('../../layout/types').LayoutStrategy<TPose> \| null` | Optional: layout strategy attached to a container, or null if the container uses absolute positioning (default behavior). |
| `ResizeAdapter` | interface | `{ getNode, getPose, setPose, applyBatch }` | Narrow adapter for `useResize`. |
| `ResizeAdapter.getNode` | field | `TNode \| undefined` |  |
| `ResizeAdapter.getPose` | field | `TPose` |  |
| `ResizeAdapter.setPose` | field | `void` |  |
| `ResizeAdapter.applyBatch?` | field | `void` | Optional: see SceneAdapter.applyBatch. |
| `RotateAdapter` | interface | `{ getNode, getPose, setPose, applyBatch }` | Narrow adapter for `useRotate`. |
| `RotateAdapter.getNode` | field | `TNode \| undefined` |  |
| `RotateAdapter.getPose` | field | `TPose` |  |
| `RotateAdapter.setPose` | field | `void` |  |
| `RotateAdapter.applyBatch?` | field | `void` | Optional: see SceneAdapter.applyBatch. |
| `AreaSelectAdapter` | interface | `{ hitTestArea, getSelection, setSelection, applyOps }` | Narrow adapter for `useAreaSelect`. |
| `AreaSelectAdapter.hitTestArea?` | field | `string[]` | Returns ids of objects intersecting the world-space rect. |
| `AreaSelectAdapter.getSelection?` | field | `string[]` | Current selection — read by behaviors to compute additive merges. |
| `AreaSelectAdapter.setSelection?` | field | `void` | Mutator wired by `setSelection` op. |
| `AreaSelectAdapter.applyOps?` | field | `void` | Apply ops without checkpointing or pushing a history entry. |
| `InsertAdapter` | interface | `{ commitInsert, commitPaste, snapshotSelection, getPasteOffset, insertNode, setSelection, applyBatch, getSelection }` | Narrow adapter for `useInsert` and `useClipboardOps`. |
| `InsertAdapter.commitInsert` | field | `TNode \| null` |  |
| `InsertAdapter.commitPaste` | field | `TNode[]` |  |
| `InsertAdapter.snapshotSelection` | field | `ClipboardSnapshot` |  |
| `InsertAdapter.getPasteOffset?` | field | `{ dx: number; dy: number }` |  |
| `InsertAdapter.insertNode` | field | `void` | Mutator wired by `insertNode`-using ops (kit-side InsertOp). |
| `InsertAdapter.setSelection` | field | `void` | Mutator wired by `setSelection` ops batched alongside paste. |
| `InsertAdapter.applyBatch?` | field | `void` | Optional: see SceneAdapter.applyBatch. |
| `InsertAdapter.getSelection` | field | `string[]` | Returns the current selection. |
| `OrderedAdapter` | interface | `{ getChildren, setChildOrder }` | Optional adapter mixin for sibling z-order. |
| `OrderedAdapter.getChildren?` | field | `string[]` | Ordered children of `parentId` (or root siblings if null), in z-order: index 0 is bottom, last index is top. |
| `OrderedAdapter.setChildOrder?` | field | `void` | Rewrite the order of `parentId`'s children. |

## src/core/adapters/useArrayAdapter.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseArrayAdapterOptions` | type | `Omit<ArrayAdapterConfig<TNode, TPose>, 'ref' \| 'setItems'> & { items: TNode[]; setItems: ArrayAdapterConfig<TNode, TPose>['setItems']; }` | Options for `useArrayAdapter` — same shape as `ArrayAdapterConfig` minus the `ref` field, which the hook manages internally from `items`. |
| `useArrayAdapter` | hook | `(options: UseArrayAdapterOptions<TNode, TPose>) => ArrayAdapter<TNode, TPose>` | Hook wrapper around `arrayAdapter` that owns the live items ref. |
| `useArrayAdapter.options` | param | `options: UseArrayAdapterOptions<TNode, TPose>` |  |

## src/core/applyOps.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `applyOpsTo` | function | `(adapter: A, ops: Op[], _label?: string) => void` | Default `applyBatch` implementation: apply each op in order against `adapter`. |
| `applyOpsTo.adapter` | param | `adapter: A` |  |
| `applyOpsTo.ops` | param | `ops: Op[]` |  |
| `applyOpsTo._label` | param | `_label?: string` |  |
| `dispatchApplyBatch` | function | `(adapter: A, ops: Op[], label?: string) => void` | Dispatcher: invokes `adapter.applyBatch` if present, otherwise falls back to `applyOpsTo`. |
| `dispatchApplyBatch.adapter` | param | `adapter: A` |  |
| `dispatchApplyBatch.ops` | param | `ops: Op[]` |  |
| `dispatchApplyBatch.label` | param | `label?: string` |  |

## src/core/history/history.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `History` | interface | `{ apply, applyBatch, undo, redo, canUndo, canRedo, clear }` | Op-batched undo/redo controller returned by `createHistory`. |
| `History.apply` | field | `void` |  |
| `History.applyBatch` | field | `void` |  |
| `History.undo` | field | `void` |  |
| `History.redo` | field | `void` |  |
| `History.canUndo` | field | `boolean` |  |
| `History.canRedo` | field | `boolean` |  |
| `History.clear` | field | `void` |  |
| `createHistory` | function | `(adapter: unknown) => History` | Build an op-batched undo/redo `History`. |
| `createHistory.adapter` | param | `adapter: unknown` |  |

## src/core/history/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createHistory` | reexport | `re-export from './history'` |  |
| `History` | reexport | `re-export from './history'` |  |

## src/core/layers/LayerRenderer.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `LayerRenderer` | class | `class` | Base class for layer renderers. |
| `LayerRenderer#view` | field | `ViewTransform` |  |
| `LayerRenderer#width` | field | `` |  |
| `LayerRenderer#height` | field | `` |  |
| `LayerRenderer#opacity` | field | `` |  |
| `LayerRenderer#highlight` | field | `` | Highlight animation state |
| `LayerRenderer#onInvalidate` | method | `(cb: () => void)` | Register a callback that fires when the renderer needs a re-render (animation tick). |
| `LayerRenderer#onInvalidate.cb` | param | `cb: () => void` |  |
| `LayerRenderer#setHoverHighlight` | method | `(on: boolean)` | Set hover-driven highlight (instant on/off). |
| `LayerRenderer#setHoverHighlight.on` | param | `on: boolean` |  |
| `LayerRenderer#flash` | method | `()` | Trigger a flash animation (quick fade-in, hold, fade-out). |
| `LayerRenderer#setView` | method | `(view: ViewTransform, width: number, height: number)` | Update view transform and dimensions. |
| `LayerRenderer#setView.view` | param | `view: ViewTransform` |  |
| `LayerRenderer#setView.width` | param | `width: number` |  |
| `LayerRenderer#setView.height` | param | `height: number` |  |
| `LayerRenderer#setParams` | method | `(params: Partial<this>)` | Bulk-assign render parameters. |
| `LayerRenderer#setParams.params` | param | `params: Partial<this>` |  |
| `LayerRenderer#render` | method | `(ctx: CanvasRenderingContext2D)` | Main render entry point. |
| `LayerRenderer#render.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `LayerRenderer#draw` | method | `(ctx: CanvasRenderingContext2D) => void` |  |
| `LayerRenderer#draw.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `LayerRenderer#dispose` | method | `()` |  |

## src/core/layers/render.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `RenderLayer` | interface | `{ id, label, draw, defaultVisible, alwaysOn, space }` | A single named render sub-layer within a canvas renderer. |
| `RenderLayer.id` | field | `string` | Unique identifier used in visibility maps and ordering arrays. |
| `RenderLayer.label` | field | `string` | Human-readable name for UI toggles. |
| `RenderLayer.draw` | field | `(ctx: CanvasRenderingContext2D, data: TData, view: View) => void` | Draw this layer's content onto the canvas. |
| `RenderLayer.defaultVisible?` | field | `boolean` | Whether the layer is shown when no explicit visibility entry exists. |
| `RenderLayer.alwaysOn?` | field | `boolean` | When true, the layer is always drawn regardless of the visibility map. |
| `RenderLayer.space?` | field | `'world' \| 'screen'` | Coordinate space the layer draws in. |
| `runLayers` | function | `(ctx: CanvasRenderingContext2D, layers: RenderLayer<TData>[], data: TData, visibility: Record<string, boolean>, order?: string[], view?: View) => void` | Iterate layers and call `draw` for each visible one. |
| `runLayers.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `runLayers.layers` | param | `layers: RenderLayer<TData>[]` |  |
| `runLayers.data` | param | `data: TData` |  |
| `runLayers.visibility` | param | `visibility: Record<string, boolean>` |  |
| `runLayers.order` | param | `order?: string[]` |  |
| `runLayers.view` | param | `view?: View` |  |

## src/core/ops/create.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `InsertOp` | type | `Op` | Type alias for ops produced by `createInsertOp`. |
| `createInsertOp` | function | `(args: { object: TNode; label?: string; }) => InsertOp` | Op: insert `object` into the scene; inverts to a delete of the same id. |
| `createInsertOp.args` | param | `args: { object: TNode; label?: string; }` |  |

## src/core/ops/delete.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createDeleteOp` | function | `(args: { object: TNode; label?: string; }) => Op` | Op: remove `object` from the scene; inverts to a re-insert of the captured object. |
| `createDeleteOp.args` | param | `args: { object: TNode; label?: string; }` |  |

## src/core/ops/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Op` | reexport | `re-export from './types'` |  |
| `applyOpsTo` | reexport | `re-export from '../applyOps'` |  |
| `dispatchApplyBatch` | reexport | `re-export from '../applyOps'` |  |
| `createTransformOp` | reexport | `re-export from './transform'` |  |
| `createReparentOp` | reexport | `re-export from './reparent'` |  |
| `createInsertOp` | reexport | `re-export from './create'` |  |
| `InsertOp` | reexport | `re-export from './create'` |  |
| `createDeleteOp` | reexport | `re-export from './delete'` |  |
| `createSetSelectionOp` | reexport | `re-export from './select'` |  |
| `createSetTextOp` | reexport | `re-export from './setText'` |  |
| `createBringForwardOp` | reexport | `re-export from './reorder'` |  |
| `createSendBackwardOp` | reexport | `re-export from './reorder'` |  |
| `createBringToFrontOp` | reexport | `re-export from './reorder'` |  |
| `createSendToBackOp` | reexport | `re-export from './reorder'` |  |
| `createMoveToIndexOp` | reexport | `re-export from './reorder'` |  |

## src/core/ops/reorder/algorithms.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `bringForward` | function | `(list: string[], ids: string[]) => string[]` |  |
| `bringForward.list` | param | `list: string[]` |  |
| `bringForward.ids` | param | `ids: string[]` |  |
| `sendBackward` | function | `(list: string[], ids: string[]) => string[]` |  |
| `sendBackward.list` | param | `list: string[]` |  |
| `sendBackward.ids` | param | `ids: string[]` |  |
| `bringToFront` | function | `(list: string[], ids: string[]) => string[]` |  |
| `bringToFront.list` | param | `list: string[]` |  |
| `bringToFront.ids` | param | `ids: string[]` |  |
| `sendToBack` | function | `(list: string[], ids: string[]) => string[]` |  |
| `sendToBack.list` | param | `list: string[]` |  |
| `sendToBack.ids` | param | `ids: string[]` |  |
| `moveToIndex` | function | `(list: string[], ids: string[], index: number) => string[]` |  |
| `moveToIndex.list` | param | `list: string[]` |  |
| `moveToIndex.ids` | param | `ids: string[]` |  |
| `moveToIndex.index` | param | `index: number` |  |

## src/core/ops/reorder/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createBringForwardOp` | function | `(args: { ids: string[]; label?: string }) => Op` | Op: bump each id one step toward the top of its parent's child order. |
| `createBringForwardOp.args` | param | `args: { ids: string[]; label?: string }` |  |
| `createSendBackwardOp` | function | `(args: { ids: string[]; label?: string }) => Op` | Op: bump each id one step toward the bottom of its parent's child order. |
| `createSendBackwardOp.args` | param | `args: { ids: string[]; label?: string }` |  |
| `createBringToFrontOp` | function | `(args: { ids: string[]; label?: string }) => Op` | Op: move each id to the top of its parent's child order. |
| `createBringToFrontOp.args` | param | `args: { ids: string[]; label?: string }` |  |
| `createSendToBackOp` | function | `(args: { ids: string[]; label?: string }) => Op` | Op: move each id to the bottom of its parent's child order. |
| `createSendToBackOp.args` | param | `args: { ids: string[]; label?: string }` |  |
| `createMoveToIndexOp` | function | `(args: { ids: string[]; parentId: string \| null; index: number; label?: string; }) => Op` | Op: move all `ids` to a contiguous block starting at `index` within `parentId`'s child order. |
| `createMoveToIndexOp.args` | param | `args: { ids: string[]; parentId: string \| null; index: number; label?: string; }` |  |

## src/core/ops/reparent.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createReparentOp` | function | `(args: { id: string; fromParentId: string \| null; toParentId: string \| null; label?: string; coalesceKey?: string; }) => Op` | Op: change `id`'s parent, inverting back to the prior parent. |
| `createReparentOp.args` | param | `args: { id: string; fromParentId: string \| null; toParentId: string \| null; label?: string; coalesceKey?: string; }` |  |

## src/core/ops/select.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createSetSelectionOp` | function | `(args: { from: string[]; to: string[]; label?: string; }) => Op` | Op: replace the current selection with `to`; inverts back to `from`. |
| `createSetSelectionOp.args` | param | `args: { from: string[]; to: string[]; label?: string; }` |  |

## src/core/ops/setText.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createSetTextOp` | function | `(args: { id: string; from: string; to: string; label?: string; coalesceKey?: string; }) => Op` | Op: set a text node's text content, inverting back to `from`. |
| `createSetTextOp.args` | param | `args: { id: string; from: string; to: string; label?: string; coalesceKey?: string; }` |  |

## src/core/ops/transform.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createTransformOp` | function | `(args: { id: string; from: TPose; to: TPose; label?: string; coalesceKey?: string; }) => Op` | Op: set an object's pose, inverting back to `from`. |
| `createTransformOp.args` | param | `args: { id: string; from: TPose; to: TPose; label?: string; coalesceKey?: string; }` |  |

## src/core/ops/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Op` | interface | `{ apply, invert, label, coalesceKey }` | An invertible mutation. |
| `Op.apply` | field | `void` |  |
| `Op.invert` | field | `Op` |  |
| `Op.label?` | field | `string` |  |
| `Op.coalesceKey?` | field | `string` |  |

## src/core/paint.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Paint` | type | `\| { fill?: 'solid'; color: string; opacity?: number } \| { fill: 'pattern'; pattern: CanvasPattern; opacity?: number }` | Color/texture strategy for fills (and, via `Stroke.paint`, strokes). |
| `StrokeAlign` | type | `'center' \| 'inner' \| 'outer'` | Where a stroke sits relative to the geometric edge it strokes. |
| `Stroke` | interface | `{ paint, width, dash, cap, join, align }` | Stroke style: a Paint plus structural line parameters. |
| `Stroke.paint` | field | `Paint` |  |
| `Stroke.width?` | field | `number` |  |
| `Stroke.dash?` | field | `number[]` | Per `CanvasRenderingContext2D.setLineDash` — empty/omitted = solid. |
| `Stroke.cap?` | field | `'butt' \| 'round' \| 'square'` |  |
| `Stroke.join?` | field | `'miter' \| 'round' \| 'bevel'` |  |
| `Stroke.align?` | field | `StrokeAlign` | Where the stroke sits relative to the geometric edge. |
| `alignedStrokeRect` | function | `(rect: { x: number; y: number; width: number; height: number }, align: StrokeAlign, width = 1) => { x: number; y: number; width: number; height: number }` | Inflate (positive) or deflate (negative) a rect to honor `align` when stroking it. |
| `alignedStrokeRect.rect` | param | `rect: { x: number; y: number; width: number; height: number }` |  |
| `alignedStrokeRect.align` | param | `align: StrokeAlign` |  |
| `alignedStrokeRect.width` | param | `width = 1` |  |
| `Region` | interface | `{ x, y, w, h, shape }` | Region a fill is clipped to. |
| `Region.x` | field | `number` |  |
| `Region.y` | field | `number` |  |
| `Region.w` | field | `number` |  |
| `Region.h` | field | `number` |  |
| `Region.shape` | field | `'rectangle' \| 'circle'` |  |
| `RenderFilledRegionOptions` | interface | `{ anchor }` | Per-call options for `renderFilledRegion`. |
| `RenderFilledRegionOptions.anchor?` | field | `{ x: number; y: number }` | World-space anchor for a pattern-fill's repeat origin. |
| `applyPaint` | function | `(ctx: CanvasRenderingContext2D, paint: Paint, anchor?: { x: number; y: number }) => void` | Set `ctx.fillStyle` and `ctx.globalAlpha` so a subsequent fill operation paints with the given strategy. |
| `applyPaint.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `applyPaint.paint` | param | `paint: Paint` |  |
| `applyPaint.anchor` | param | `anchor?: { x: number; y: number }` |  |
| `applyStroke` | function | `(ctx: CanvasRenderingContext2D, stroke: Stroke, anchor?: { x: number; y: number }) => void` | Set `ctx.strokeStyle`, `ctx.lineWidth`, dash/cap/join, and `globalAlpha` so a subsequent stroke operation paints with the given style. |
| `applyStroke.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `applyStroke.stroke` | param | `stroke: Stroke` |  |
| `applyStroke.anchor` | param | `anchor?: { x: number; y: number }` |  |
| `renderFilledRegion` | function | `(ctx: CanvasRenderingContext2D, paint: Paint \| null \| undefined, region: Region, options: RenderFilledRegionOptions = {}) => void` | Fill a rectangle or circle region with `paint`. |
| `renderFilledRegion.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `renderFilledRegion.paint` | param | `paint: Paint \| null \| undefined` |  |
| `renderFilledRegion.region` | param | `region: Region` |  |
| `renderFilledRegion.options` | param | `options: RenderFilledRegionOptions = {}` |  |

## src/core/scene/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createScene` | reexport | `re-export from './scene'` |  |
| `useScene` | reexport | `re-export from './useScene'` |  |
| `asNodeId` | reexport | `re-export from './types'` |  |
| `AddNodeSpec` | reexport | `re-export from './types'` |  |
| `ContainerNode` | reexport | `re-export from './types'` |  |
| `LayerRecord` | reexport | `re-export from './types'` |  |
| `LeafNode` | reexport | `re-export from './types'` |  |
| `Node` | reexport | `re-export from './types'` |  |
| `NodeId` | reexport | `re-export from './types'` |  |
| `RegisteredOp` | reexport | `re-export from './types'` |  |
| `Scene` | reexport | `re-export from './types'` |  |
| `SystemLayerRecord` | reexport | `re-export from './types'` |  |
| `SystemLayerSpec` | reexport | `re-export from './types'` |  |
| `UserLayerRecord` | reexport | `re-export from './types'` |  |
| `UseSceneOptions` | reexport | `re-export from './types'` |  |

## src/core/scene/scene.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createScene` | function | `(options: UseSceneOptions<TData, TLayer, TPose>) => Scene<TData, TLayer, TPose>` |  |
| `createScene.options` | param | `options: UseSceneOptions<TData, TLayer, TPose>` |  |

## src/core/scene/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `NodeId` | type | `string & { readonly __brand: 'NodeId' }` | Opaque branded id. |
| `asNodeId` | function | `(s: string) => NodeId` | Brand a string as a NodeId. |
| `asNodeId.s` | param | `s: string` |  |
| `LeafNode` | interface | `{ kind }` |  |
| `LeafNode.kind` | field | `'leaf'` |  |
| `ContainerNode` | interface | `{ kind, children }` |  |
| `ContainerNode.kind` | field | `'container'` |  |
| `ContainerNode.children` | field | `NodeId[]` |  |
| `Node` | type | `\| LeafNode<TData, TLayer, TPose> \| ContainerNode<TData, TLayer, TPose>` |  |
| `SystemLayerRecord` | interface | `{ kind }` |  |
| `SystemLayerRecord.kind` | field | `'system'` |  |
| `UserLayerRecord` | interface | `{ kind, name }` |  |
| `UserLayerRecord.kind` | field | `'user'` |  |
| `UserLayerRecord.name` | field | `string` |  |
| `LayerRecord` | type | `\| SystemLayerRecord<TLayer> \| UserLayerRecord<TLayer>` |  |
| `AddNodeSpec` | interface | `{ kind, layer, pose, data, parent, index, id }` |  |
| `AddNodeSpec.kind` | field | `'leaf' \| 'container'` |  |
| `AddNodeSpec.layer` | field | `TLayer` |  |
| `AddNodeSpec.pose` | field | `TPose` |  |
| `AddNodeSpec.data` | field | `TData` |  |
| `AddNodeSpec.parent?` | field | `NodeId \| null` |  |
| `AddNodeSpec.index?` | field | `number` |  |
| `AddNodeSpec.id?` | field | `NodeId` | Explicit id wins over the Scene's `generateId` and the kit default. |
| `RegisteredOp` | interface | `{ apply, revert }` |  |
| `RegisteredOp.apply` | field | `(payload: P) => void` |  |
| `RegisteredOp.revert` | field | `(payload: P) => void` |  |
| `SystemLayerSpec` | interface | `{ id, visible, locked }` |  |
| `SystemLayerSpec.id` | field | `TLayer` |  |
| `SystemLayerSpec.visible?` | field | `boolean` |  |
| `SystemLayerSpec.locked?` | field | `boolean` |  |
| `UseSceneOptions` | interface | `{ systemLayers, initial, ops, historyLimit, generateId }` |  |
| `UseSceneOptions.systemLayers` | field | `readonly SystemLayerSpec<TLayer>[]` |  |
| `UseSceneOptions.initial?` | field | `readonly AddNodeSpec<TData, TLayer, TPose>[]` |  |
| `UseSceneOptions.ops?` | field | `Readonly<Record<string, RegisteredOp<unknown>>>` |  |
| `UseSceneOptions.historyLimit?` | field | `number` |  |
| `UseSceneOptions.generateId?` | field | `() => NodeId` |  |
| `Scene` | interface | `{ nodes, roots, layers, get, childrenOf, ancestorsOf, renderOrder, add, remove, update, ... }` |  |
| `Scene.nodes` | field | `ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>` | Reads |
| `Scene.roots` | field | `readonly NodeId[]` |  |
| `Scene.layers` | field | `readonly LayerRecord<TLayer>[]` |  |
| `Scene.get` | field | `Node<TData, TLayer, TPose> \| undefined` |  |
| `Scene.childrenOf` | field | `readonly NodeId[]` |  |
| `Scene.ancestorsOf` | field | `readonly NodeId[]` |  |
| `Scene.renderOrder` | field | `Iterable<NodeId>` |  |
| `Scene.add` | field | `NodeId` | Mutations (all auto-undoable) |
| `Scene.remove` | field | `void` |  |
| `Scene.update` | field | `void` |  |
| `Scene.setPose` | field | `void` |  |
| `Scene.setLayer` | field | `void` |  |
| `Scene.move` | field | `void` |  |
| `Scene.reorder` | field | `void` |  |
| `Scene.setLayerVisible` | field | `void` |  |
| `Scene.setLayerLocked` | field | `void` |  |
| `Scene.registerOp` | field | `void` | Custom op seam |
| `Scene.recordOp` | field | `void` |  |
| `Scene.undo` | field | `boolean` | History |
| `Scene.redo` | field | `boolean` |  |
| `Scene.canUndo` | field | `boolean` |  |
| `Scene.canRedo` | field | `boolean` |  |
| `Scene.batch` | field | `T` |  |
| `Scene.subscribe` | field | `() => void` | Subscription (used by useScene; also for non-React observers) |
| `Scene.getVersion` | field | `number` | Monotonically increasing version. |

## src/core/scene/useScene.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseSceneTrivialOptions` | interface | `{ items, historyLimit, generateId }` | Trivial-form options: a flat list of items, no layers, no parenting. |
| `UseSceneTrivialOptions.items` | field | `readonly TItem[]` |  |
| `UseSceneTrivialOptions.historyLimit?` | field | `number` |  |
| `UseSceneTrivialOptions.generateId?` | field | `() => NodeId` |  |
| `useScene` | hook | `(options: UseSceneTrivialOptions<TItem>) => Scene<TItem, DefaultLayer, TItem>` | React hook returning a kit-owned `Scene`. |
| `useScene.options` | param | `options: UseSceneTrivialOptions<TItem>` |  |
| `useScene` | hook | `(options: UseSceneOptions<TData, TLayer, TPose>) => Scene<TData, TLayer, TPose>` |  |
| `useScene.options` | param | `options: UseSceneOptions<TData, TLayer, TPose>` |  |
| `useScene` | hook | `(options: unknown) => unknown` |  |
| `useScene.options` | param | `options: unknown` |  |

## src/core/units.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Unit` | type | `string` | A unit name (e.g. |
| `UnitSystem` | interface | `{ base, units }` | Conversion table mapping unit names to factors against a base unit. |
| `UnitSystem.base` | field | `Unit` | Name of the base unit, e.g. |
| `UnitSystem.units` | field | `Record<Unit, number>` | Factor to multiply a value in `unit` by to get base units. |
| `UnitValue` | type | `number \| { value: number; unit: Unit }` | Value at a unit-aware API boundary: bare number (in base units) or `{ value, unit }` tag. |
| `resolveUnit` | function | `(v: UnitValue, unitSystem?: UnitSystem) => number` | Resolve a UnitValue to a number in base units. |
| `resolveUnit.v` | param | `v: UnitValue` |  |
| `resolveUnit.unitSystem` | param | `unitSystem?: UnitSystem` |  |
| `formatUnit` | function | `(baseValue: number, displayUnit: Unit, unitSystem: UnitSystem, opts?: { precision?: number; suffix?: boolean }) => string` | Format a base-unit number as a string in the named display unit. |
| `formatUnit.baseValue` | param | `baseValue: number` |  |
| `formatUnit.displayUnit` | param | `displayUnit: Unit` |  |
| `formatUnit.unitSystem` | param | `unitSystem: UnitSystem` |  |
| `formatUnit.opts` | param | `opts?: { precision?: number; suffix?: boolean }` |  |
| `IMPERIAL_INCHES` | const | `UnitSystem` | Imperial unit system with base 'in'. |
| `METRIC_MM` | const | `UnitSystem` | Metric unit system with base 'mm'. |
| `PIXELS` | const | `UnitSystem` | Pixel unit system — sole unit is the base. |

## src/debug/createDebugOverlayLayer.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createDebugOverlayLayer` | function | `({   sink,   config, }: CreateDebugOverlayLayerOpts) => RenderLayer<unknown>` | Screen-space `RenderLayer` that paints the sink's snapshot. |
| `createDebugOverlayLayer.{
  sink,
  config,
}` | param | `{   sink,   config, }: CreateDebugOverlayLayerOpts` |  |

## src/debug/createDebugSink.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createDebugSink` | function | `(config: DebugConfig) => DebugSink & { snapshot(): DebugSnapshot }` | Build a sink that stores recorded primitives in arrays keyed by feature. |
| `createDebugSink.config` | param | `config: DebugConfig` |  |

## src/debug/defaultTheme.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DEFAULT_DEBUG_THEME` | const | `DebugTheme` | Default colors per the spec's Visual Style section. |

## src/debug/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `parseDebugFlags` | reexport | `re-export from './parseDebugFlags'` |  |
| `createDebugSink` | reexport | `re-export from './createDebugSink'` |  |
| `createDebugOverlayLayer` | reexport | `re-export from './createDebugOverlayLayer'` |  |
| `DEFAULT_DEBUG_THEME` | reexport | `re-export from './defaultTheme'` |  |
| `DebugConfig` | reexport | `re-export from './types'` |  |
| `DebugFeature` | reexport | `re-export from './types'` |  |
| `DebugTheme` | reexport | `re-export from './types'` |  |
| `DebugSink` | reexport | `re-export from './types'` |  |
| `DebugSnapshot` | reexport | `re-export from './types'` |  |
| `HandleKind` | reexport | `re-export from './types'` |  |
| `HitShape` | reexport | `re-export from './types'` |  |
| `RecordedHitbox` | reexport | `re-export from './types'` |  |
| `RecordedHandle` | reexport | `re-export from './types'` |  |
| `RecordedBounds` | reexport | `re-export from './types'` |  |
| `RecordedOrigin` | reexport | `re-export from './types'` |  |
| `RecordedSnap` | reexport | `re-export from './types'` |  |
| `RecordedLayer` | reexport | `re-export from './types'` |  |

## src/debug/parseDebugFlags.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `parseDebugFlags` | function | `(search: string) => DebugConfig \| null` | Parse a URL query string (with or without leading `?`) for a `debug` param. |
| `parseDebugFlags.search` | param | `search: string` |  |

## src/debug/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DebugConfig` | interface | `{ hitboxes, handles, bounds, origins, snap, layers, theme }` | One bit per debug feature; absent keys are off. |
| `DebugConfig.hitboxes?` | field | `boolean` |  |
| `DebugConfig.handles?` | field | `boolean` |  |
| `DebugConfig.bounds?` | field | `boolean` |  |
| `DebugConfig.origins?` | field | `boolean` |  |
| `DebugConfig.snap?` | field | `boolean` |  |
| `DebugConfig.layers?` | field | `boolean` |  |
| `DebugConfig.theme?` | field | `Partial<DebugTheme>` | Optional per-feature color overrides; falls back to the default theme. |
| `DebugFeature` | type | `'hitboxes' \| 'handles' \| 'bounds' \| 'origins' \| 'snap' \| 'layers'` |  |
| `DebugTheme` | interface | `{ hitboxFill, hitboxStroke, handle, bounds, origin, snap, layerText, layerTextBg }` |  |
| `DebugTheme.hitboxFill` | field | `string` |  |
| `DebugTheme.hitboxStroke` | field | `string` |  |
| `DebugTheme.handle` | field | `string` |  |
| `DebugTheme.bounds` | field | `string` |  |
| `DebugTheme.origin` | field | `string` |  |
| `DebugTheme.snap` | field | `string` |  |
| `DebugTheme.layerText` | field | `string` |  |
| `DebugTheme.layerTextBg` | field | `string` |  |
| `HandleKind` | type | `'corner' \| 'rotation' \| 'anchor'` |  |
| `HitShape` | type | `\| { kind: 'rect'; x: number; y: number; width: number; height: number; rotation?: number } \| { kind: 'circle'; cx: number; cy: number; r: number } \| { kind: 'path'; d: Path2D }` |  |
| `RecordedHitbox` | interface | `{ id, kind, shape }` |  |
| `RecordedHitbox.id` | field | `string` |  |
| `RecordedHitbox.kind` | field | `'body' \| 'handle' \| 'rotation' \| 'anchor'` |  |
| `RecordedHitbox.shape` | field | `HitShape` |  |
| `RecordedHandle` | interface | `{ id, position, kind }` |  |
| `RecordedHandle.id` | field | `string` |  |
| `RecordedHandle.position` | field | `{ x: number; y: number }` |  |
| `RecordedHandle.kind` | field | `HandleKind` |  |
| `RecordedBounds` | interface | `{ id, bounds }` |  |
| `RecordedBounds.id` | field | `string` |  |
| `RecordedBounds.bounds` | field | `{ x: number; y: number; width: number; height: number }` |  |
| `RecordedOrigin` | interface | `{ id, point }` |  |
| `RecordedOrigin.id` | field | `string` |  |
| `RecordedOrigin.point` | field | `{ x: number; y: number }` |  |
| `RecordedSnap` | interface | `{ point, accepted }` |  |
| `RecordedSnap.point` | field | `{ x: number; y: number }` |  |
| `RecordedSnap.accepted` | field | `boolean` |  |
| `RecordedLayer` | interface | `{ id, label, space, index }` |  |
| `RecordedLayer.id` | field | `string` |  |
| `RecordedLayer.label` | field | `string` |  |
| `RecordedLayer.space` | field | `'world' \| 'screen'` |  |
| `RecordedLayer.index` | field | `number` |  |
| `DebugSnapshot` | interface | `{ hitboxes, handles, bounds, origins, snap, layers }` |  |
| `DebugSnapshot.hitboxes` | field | `RecordedHitbox[]` |  |
| `DebugSnapshot.handles` | field | `RecordedHandle[]` |  |
| `DebugSnapshot.bounds` | field | `RecordedBounds[]` |  |
| `DebugSnapshot.origins` | field | `RecordedOrigin[]` |  |
| `DebugSnapshot.snap` | field | `RecordedSnap[]` |  |
| `DebugSnapshot.layers` | field | `RecordedLayer[]` |  |
| `DebugSink` | interface | `{ recordHitbox, recordHandle, recordBounds, recordOrigin, recordSnapCandidate, recordLayer, beginFrame, clearSnap }` |  |
| `DebugSink.recordHitbox` | field | `void` |  |
| `DebugSink.recordHandle` | field | `void` |  |
| `DebugSink.recordBounds` | field | `void` |  |
| `DebugSink.recordOrigin` | field | `void` |  |
| `DebugSink.recordSnapCandidate` | field | `void` |  |
| `DebugSink.recordLayer` | field | `void` |  |
| `DebugSink.beginFrame` | field | `void` | Clears every non-snap array. |
| `DebugSink.clearSnap` | field | `void` | Clears the snap array. |

## src/features/drag/dragGhost.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DragGhost` | interface | `{ move, setHidden, repaint, destroy }` | Cursor-following drag ghost. |
| `DragGhost.move` | field | `void` |  |
| `DragGhost.setHidden` | field | `void` |  |
| `DragGhost.repaint` | field | `void` |  |
| `DragGhost.destroy` | field | `void` |  |
| `DragGhostOptions` | interface | `{ sizeCss, paint, opacity }` | Construction options for `createDragGhost`. |
| `DragGhostOptions.sizeCss` | field | `number` | Visual diameter/side of the ghost in CSS pixels. |
| `DragGhostOptions.paint` | field | `(ctx: CanvasRenderingContext2D, sizeCss: number) => void` | Paint callback. |
| `DragGhostOptions.opacity?` | field | `number` | Optional opacity (default 0.85). |
| `createDragGhost` | function | `(opts: DragGhostOptions) => DragGhost` | Mount a fixed-position canvas drag ghost on `document.body`; returns the controller `DragGhost`. |
| `createDragGhost.opts` | param | `opts: DragGhostOptions` |  |

## src/features/drag/pointerDrag.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DragPayload` | interface | `{ kind, ids, data }` | Payload carried by an in-flight pointer drag — `kind` routes to drop zones, `ids` lists the dragged items. |
| `DragPayload.kind` | field | `string` |  |
| `DragPayload.ids` | field | `string[]` |  |
| `DragPayload.data?` | field | `unknown` |  |
| `DragHandleOptions` | interface | `{ createGhost }` | Options for `useDragHandle`; supply `createGhost` to override the default DOM-clone ghost. |
| `DragHandleOptions.createGhost?` | field | `(source: HTMLElement, payload: DragPayload) => HTMLElement` |  |
| `useDragHandle` | hook | `(getPayload: () => DragPayload \| null, options?: DragHandleOptions)` | Attach a pointer-driven drag handle: `getPayload` is read at threshold-cross time and a ghost follows the pointer. |
| `useDragHandle.getPayload` | param | `getPayload: () => DragPayload \| null` |  |
| `useDragHandle.options` | param | `options?: DragHandleOptions` |  |
| `DropZoneOptions` | interface | `{ accepts, onDrop, onOver, onMove }` | Options for `useDropZone`; `accepts` filters by `payload.kind`. |
| `DropZoneOptions.accepts` | field | `(kind: string) => boolean` |  |
| `DropZoneOptions.onDrop` | field | `(payload: DragPayload, clientX: number, clientY: number) => void` |  |
| `DropZoneOptions.onOver?` | field | `(active: boolean) => void` |  |
| `DropZoneOptions.onMove?` | field | `(payload: DragPayload, clientX: number, clientY: number) => void` |  |
| `useDropZone` | hook | `(opts: DropZoneOptions) => (el: T \| null) => void` | Register an element as a drop zone for `useDragHandle` payloads. |
| `useDropZone.opts` | param | `opts: DropZoneOptions` |  |

## src/features/drag/thresholdDrag.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ThresholdDragOptions` | interface | `{ threshold, onActivate, onMove, onCommit, onCancel }` | Wire up a pointer-driven drag with a movement threshold before activation. |
| `ThresholdDragOptions.threshold?` | field | `number` |  |
| `ThresholdDragOptions.onActivate?` | field | `(e: PointerEvent) => void` |  |
| `ThresholdDragOptions.onMove` | field | `(e: PointerEvent) => void` |  |
| `ThresholdDragOptions.onCommit` | field | `(e: PointerEvent) => void` |  |
| `ThresholdDragOptions.onCancel?` | field | `() => void` |  |
| `ThresholdDragHandle` | interface | `{ isDragging }` | Handle returned by `startThresholdDrag` exposing live gesture state. |
| `ThresholdDragHandle.isDragging` | field | `() => boolean` | True after the pointer has moved past `threshold` and the drag is live. |
| `startThresholdDrag` | function | `(e: React.PointerEvent, opts: ThresholdDragOptions) => ThresholdDragHandle` | Begin a threshold-gated drag from a React PointerDown event; returns a handle exposing live state. |
| `startThresholdDrag.e` | param | `e: React.PointerEvent` |  |
| `startThresholdDrag.opts` | param | `opts: ThresholdDragOptions` |  |

## src/features/grid/cellHighlight.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `CellHighlightLayerOpts` | interface | `{ spacing, unitSystem, origin, getCell, fill }` | Options for `createCellHighlightLayer`. |
| `CellHighlightLayerOpts.spacing` | field | `UnitValue` | Cell size in world units (matches the grid's `spacing`). |
| `CellHighlightLayerOpts.unitSystem?` | field | `UnitSystem` | Optional unit system for resolving tagged `spacing` values. |
| `CellHighlightLayerOpts.origin?` | field | `() => { x: number; y: number }` | Origin the cell grid is anchored to, in world units. |
| `CellHighlightLayerOpts.getCell` | field | `() => { col: number; row: number } \| null` | Cell to highlight, or `null` to skip drawing. |
| `CellHighlightLayerOpts.fill?` | field | `Paint` | Paint strategy for the filled cell. |
| `createCellHighlightLayer` | function | `(opts: CellHighlightLayerOpts) => RenderLayer<unknown>` | Build a `RenderLayer` that fills a single grid cell — typically a snap-target preview. |
| `createCellHighlightLayer.opts` | param | `opts: CellHighlightLayerOpts` |  |

## src/features/grid/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `roundToCell` | function | `(value: number, cellSize: number) => number` | Round `value` to the nearest multiple of `cellSize`. |
| `roundToCell.value` | param | `value: number` |  |
| `roundToCell.cellSize` | param | `cellSize: number` |  |

## src/features/grid/layer.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `GridLayerOpts` | interface | `{ spacing, unitSystem, bounds, accentEvery, subdivisions, style }` | Options for `createGridLayer`. |
| `GridLayerOpts.spacing` | field | `UnitValue` | Distance between adjacent grid lines (also known as grid pitch), in world (base) units. |
| `GridLayerOpts.unitSystem?` | field | `UnitSystem` | Optional unit system for resolving tagged `spacing` values. |
| `GridLayerOpts.bounds` | field | `() => { x: number; y: number; width: number; height: number }` | Bounds of the area to cover, in world units. |
| `GridLayerOpts.accentEvery?` | field | `number` | Lines every N cells get the accent style. |
| `GridLayerOpts.subdivisions?` | field | `number` | Optional finer subdivisions per cell. |
| `GridLayerOpts.style?` | field | `{ line?: Stroke; accent?: Stroke; sub?: Stroke; }` | Per-band stroke styles. |
| `createGridLayer` | function | `(opts: GridLayerOpts) => RenderLayer<unknown>` | Build a `RenderLayer` that draws a world-space grid with optional accent lines and subdivisions. |
| `createGridLayer.opts` | param | `opts: GridLayerOpts` |  |

## src/features/grid/useGridCellHover.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseGridCellHoverOptions` | interface | `{ ref, view, spacing, unitSystem, origin, onChange, enabled }` | Options for `useGridCellHover`. |
| `UseGridCellHoverOptions.ref` | field | `RefObject<HTMLElement \| null>` | Element to attach pointer listeners to (typically the canvas). |
| `UseGridCellHoverOptions.view` | field | `() => ViewTransform` | Read the current view transform. |
| `UseGridCellHoverOptions.spacing` | field | `UnitValue` | Cell spacing in world units. |
| `UseGridCellHoverOptions.unitSystem?` | field | `UnitSystem` | Required if `spacing` is tagged (e.g. |
| `UseGridCellHoverOptions.origin?` | field | `{ x: number; y: number }` | Origin the cell grid is anchored to, in world units. |
| `UseGridCellHoverOptions.onChange?` | field | `(cell: { col: number; row: number } \| null) => void` | Fires when the hovered cell changes (including to/from `null`). |
| `UseGridCellHoverOptions.enabled?` | field | `boolean` | Disable the listeners without unmounting. |
| `UseGridCellHoverReturn` | interface | `{ cell, getCell }` | Return shape of `useGridCellHover`. |
| `UseGridCellHoverReturn.cell` | field | `{ col: number; row: number } \| null` | Current hovered cell, or `null` when the pointer is outside the element. |
| `UseGridCellHoverReturn.getCell` | field | `() => { col: number; row: number } \| null` | Stable callback that returns the current cell — drop straight into `createCellHighlightLayer({ getCell })`. |
| `useGridCellHover` | hook | `(opts: UseGridCellHoverOptions) => UseGridCellHoverReturn` | Track which grid cell the pointer is over; pairs with `createCellHighlightLayer`. |
| `useGridCellHover.opts` | param | `opts: UseGridCellHoverOptions` |  |

## src/features/groups/children.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `CreateChildrenLayerOpts` | interface | `{ id, label, adapter, parentId, drawChild, defaultVisible, alwaysOn }` | Options for `createChildrenLayer`. |
| `CreateChildrenLayerOpts.id?` | field | `string` | Layer id for the visibility/order map. |
| `CreateChildrenLayerOpts.label?` | field | `string` | Human-readable label. |
| `CreateChildrenLayerOpts.adapter` | field | `Pick<OrderedAdapter, 'getChildren'>` | Source of `getChildren`. |
| `CreateChildrenLayerOpts.parentId?` | field | `string \| null \| (() => string \| null)` | Parent id (null = root). |
| `CreateChildrenLayerOpts.drawChild` | field | `void` | Draw one child. |
| `CreateChildrenLayerOpts.defaultVisible?` | field | `boolean` | Forwarded to the produced `RenderLayer`. |
| `CreateChildrenLayerOpts.alwaysOn?` | field | `boolean` | Forwarded to the produced `RenderLayer`. |
| `createChildrenLayer` | function | `(opts: CreateChildrenLayerOpts<TData>) => RenderLayer<TData>` | Build a `RenderLayer` that draws an `OrderedAdapter`'s children in z-order. |
| `createChildrenLayer.opts` | param | `opts: CreateChildrenLayerOpts<TData>` |  |

## src/features/groups/composePose.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `RectPose` | interface | `{ x, y, width, height }` | Axis-aligned rectangle pose. |
| `RectPose.x` | field | `number` |  |
| `RectPose.y` | field | `number` |  |
| `RectPose.width` | field | `number` |  |
| `RectPose.height` | field | `number` |  |
| `PoseAdapter` | interface | `{ getPose, getParent }` | Minimal adapter needed by `composeWorldPose` and friends — pose lookup plus parent walk. |
| `PoseAdapter.getPose` | field | `TPose` |  |
| `PoseAdapter.getParent` | field | `string \| null` |  |
| `composeWorldPose` | function | `(adapter: PoseAdapter<TPose>, id: string, compose: (parent: TPose, child: TPose) => TPose) => TPose` | Walk `id`'s parent chain (root first to id last) and fold local poses into a world pose via `compose`. |
| `composeWorldPose.adapter` | param | `adapter: PoseAdapter<TPose>` |  |
| `composeWorldPose.id` | param | `id: string` |  |
| `composeWorldPose.compose` | param | `compose: (parent: TPose, child: TPose) => TPose` |  |
| `composeRectPose` | function | `(parent: TPose, child: TPose) => TPose` | Default `compose` for axis-aligned rectangles. |
| `composeRectPose.parent` | param | `parent: TPose` |  |
| `composeRectPose.child` | param | `child: TPose` |  |
| `translateRectPose` | function | `(pose: TPose, dx: number, dy: number) => TPose` | Translate a `RectPose`-shaped pose by `(dx, dy)`. |
| `translateRectPose.pose` | param | `pose: TPose` |  |
| `translateRectPose.dx` | param | `dx: number` |  |
| `translateRectPose.dy` | param | `dy: number` |  |
| `rebaseLocalPose` | function | `(adapter: PoseAdapter<TPose>, worldPose: TPose, newParentId: string \| null, compose: (parent: TPose, child: TPose) => TPose, decompose: (parent: TPose, world: TPose) => TPose) => TPose` | Convert `worldPose` into a local pose expressed under `newParentId`'s frame. |
| `rebaseLocalPose.adapter` | param | `adapter: PoseAdapter<TPose>` |  |
| `rebaseLocalPose.worldPose` | param | `worldPose: TPose` |  |
| `rebaseLocalPose.newParentId` | param | `newParentId: string \| null` |  |
| `rebaseLocalPose.compose` | param | `compose: (parent: TPose, child: TPose) => TPose` |  |
| `rebaseLocalPose.decompose` | param | `decompose: (parent: TPose, world: TPose) => TPose` |  |
| `decomposeRectPose` | function | `(parent: TPose, world: TPose) => TPose` | Inverse of `composeRectPose` — subtracts parent translation. |
| `decomposeRectPose.parent` | param | `parent: TPose` |  |
| `decomposeRectPose.world` | param | `world: TPose` |  |
| `worldPoseLookup` | function | `(adapter: PoseAdapter<TPose>, compose: (parent: TPose, child: TPose) => TPose) => (id: string) => TPose \| null` | Build a `(id) => world pose \\| null` callback over a `PoseAdapter`. |
| `worldPoseLookup.adapter` | param | `adapter: PoseAdapter<TPose>` |  |
| `worldPoseLookup.compose` | param | `compose: (parent: TPose, child: TPose) => TPose` |  |

## src/features/groups/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Group` | reexport | `re-export from './types'` |  |
| `GroupAdapter` | reexport | `re-export from './types'` |  |
| `resolveToOutermostGroup` | reexport | `re-export from './resolve'` |  |
| `expandToLeaves` | reexport | `re-export from './resolve'` |  |
| `unionBounds` | reexport | `re-export from './unionBounds'` |  |
| `RectPose` | reexport | `re-export from './unionBounds'` |  |
| `withGroupOrdering` | reexport | `re-export from './orderedGroups'` |  |
| `createCreateGroupOp` | reexport | `re-export from './ops/createGroup'` |  |
| `createDissolveGroupOp` | reexport | `re-export from './ops/dissolveGroup'` |  |
| `createAddToGroupOp` | reexport | `re-export from './ops/addToGroup'` |  |
| `createRemoveFromGroupOp` | reexport | `re-export from './ops/removeFromGroup'` |  |

## src/features/groups/ops/addToGroup.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createAddToGroupOp` | function | `(args: { groupId: string; ids: string[]; label?: string; }) => Op` | Add ids to an existing group's member list. |
| `createAddToGroupOp.args` | param | `args: { groupId: string; ids: string[]; label?: string; }` |  |

## src/features/groups/ops/createGroup.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createCreateGroupOp` | function | `(args: { group: Group; label?: string }) => Op` | Insert a new virtual group. |
| `createCreateGroupOp.args` | param | `args: { group: Group; label?: string }` |  |

## src/features/groups/ops/dissolveGroup.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createDissolveGroupOp` | function | `(args: { group: Group; label?: string }) => Op` | Remove a virtual group. |
| `createDissolveGroupOp.args` | param | `args: { group: Group; label?: string }` |  |

## src/features/groups/ops/removeFromGroup.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `createRemoveFromGroupOp` | function | `(args: { groupId: string; ids: string[]; label?: string; }) => Op` | Remove ids from an existing group's member list. |
| `createRemoveFromGroupOp.args` | param | `args: { groupId: string; ids: string[]; label?: string; }` |  |

## src/features/groups/orderedGroups.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `withGroupOrdering` | function | `(scene: T, groups: Pick<GroupAdapter, 'getGroup'>) => OrderedSceneShape` | Compose a scene adapter's getChildren/setChildOrder with a group adapter so that `parentId === <groupId>` routes to the group's `members[]`. |
| `withGroupOrdering.scene` | param | `scene: T` |  |
| `withGroupOrdering.groups` | param | `groups: Pick<GroupAdapter, 'getGroup'>` |  |

## src/features/groups/resolve.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `resolveToOutermostGroup` | function | `(id: string, adapter: GroupAdapter) => string` | Walks parent groups for `id` and returns the outermost ancestor group id, or `id` itself if it's not a member of any group. |
| `resolveToOutermostGroup.id` | param | `id: string` |  |
| `resolveToOutermostGroup.adapter` | param | `adapter: GroupAdapter` |  |
| `expandToLeaves` | function | `(ids: string[], adapter: GroupAdapter) => string[]` | Given a list of ids (some of which may be groups), return the flattened list of leaf object ids by recursively expanding group memberships. |
| `expandToLeaves.ids` | param | `ids: string[]` |  |
| `expandToLeaves.adapter` | param | `adapter: GroupAdapter` |  |

## src/features/groups/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Group` | interface | `{ id, members }` | A virtual group is identified by string id, same shape as scene objects. |
| `Group.id` | field | `string` |  |
| `Group.members` | field | `string[]` | Ordered member ids; can include other group ids (nesting). |
| `GroupAdapter` | interface | `{ getGroup, getGroupsForMember, insertGroup, removeGroup, addToGroup, removeFromGroup }` | Adapter additions for groups. |
| `GroupAdapter.getGroup` | field | `Group \| undefined` | Return the group with this id, or undefined if it isn't a group. |
| `GroupAdapter.getGroupsForMember` | field | `string[]` | Return all groups this object is a *direct* member of (not transitive). |
| `GroupAdapter.insertGroup` | field | `void` | Insert a group record. |
| `GroupAdapter.removeGroup` | field | `void` | Remove a group record by id. |
| `GroupAdapter.addToGroup` | field | `void` | Append ids to a group's member list. |
| `GroupAdapter.removeFromGroup` | field | `void` | Remove ids from a group's member list. |

## src/features/groups/unionBounds.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `RectPose` | reexport | `re-export of RectPose` |  |
| `unionBounds` | function | `(poses: Iterable<TPose>) => RectPose \| null` | Compute the AABB envelope of a set of rect-shaped poses; returns null when empty. |
| `unionBounds.poses` | param | `poses: Iterable<TPose>` |  |

## src/features/paths/bounds.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `boundsOfPath` | function | `(path: Path) => RectPath` | AABB of a `Path`, returned as a `RectPath` for direct reuse with rect-fast-path machinery. |
| `boundsOfPath.path` | param | `path: Path` |  |

## src/features/paths/builder.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PathBuilder` | class | `class` | Fluent builder for `PolygonPath`; hides the `Uint8Array`/`Float32Array` encoding behind move/line/curve/close calls. |
| `PathBuilder#setFillRule` | method | `(rule: PathFillRule) => this` |  |
| `PathBuilder#setFillRule.rule` | param | `rule: PathFillRule` |  |
| `PathBuilder#moveTo` | method | `(x: number, y: number) => this` |  |
| `PathBuilder#moveTo.x` | param | `x: number` |  |
| `PathBuilder#moveTo.y` | param | `y: number` |  |
| `PathBuilder#lineTo` | method | `(x: number, y: number) => this` |  |
| `PathBuilder#lineTo.x` | param | `x: number` |  |
| `PathBuilder#lineTo.y` | param | `y: number` |  |
| `PathBuilder#curveTo` | method | `(x1: number, y1: number, x2: number, y2: number, x: number, y: number) => this` | Cubic bezier to (x, y) with control points (x1, y1) and (x2, y2). |
| `PathBuilder#curveTo.x1` | param | `x1: number` |  |
| `PathBuilder#curveTo.y1` | param | `y1: number` |  |
| `PathBuilder#curveTo.x2` | param | `x2: number` |  |
| `PathBuilder#curveTo.y2` | param | `y2: number` |  |
| `PathBuilder#curveTo.x` | param | `x: number` |  |
| `PathBuilder#curveTo.y` | param | `y: number` |  |
| `PathBuilder#quadTo` | method | `(x1: number, y1: number, x: number, y: number) => this` | Quadratic bezier to (x, y) with control point (x1, y1). |
| `PathBuilder#quadTo.x1` | param | `x1: number` |  |
| `PathBuilder#quadTo.y1` | param | `y1: number` |  |
| `PathBuilder#quadTo.x` | param | `x: number` |  |
| `PathBuilder#quadTo.y` | param | `y: number` |  |
| `PathBuilder#close` | method | `() => this` |  |
| `PathBuilder#build` | method | `() => PolygonPath` |  |
| `rectPath` | function | `(x: number, y: number, width: number, height: number) => RectPath` | Construct a `RectPath` (the fast-path subtype). |
| `rectPath.x` | param | `x: number` |  |
| `rectPath.y` | param | `y: number` |  |
| `rectPath.width` | param | `width: number` |  |
| `rectPath.height` | param | `height: number` |  |
| `polygonFromPoints` | function | `(points: readonly { x: number; y: number }[], opts: { fillRule?: PathFillRule } = {}) => PolygonPath` | Build a closed polygon from a flat list of points. |
| `polygonFromPoints.points` | param | `points: readonly { x: number; y: number }[]` |  |
| `polygonFromPoints.opts` | param | `opts: { fillRule?: PathFillRule } = {}` |  |

## src/features/paths/canvas.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `traceToContext` | function | `(ctx: CanvasRenderingContext2D, path: Path) => void` | Walk a `Path` command stream and emit it onto a Canvas2D context (caller fills/strokes/clips). |
| `traceToContext.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `traceToContext.path` | param | `path: Path` |  |

## src/features/paths/compose.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `composePath` | function | `(parent: Path, child: Path) => Path` | Express `child` (in `parent`'s local frame) in the next frame up. |
| `composePath.parent` | param | `parent: Path` |  |
| `composePath.child` | param | `child: Path` |  |
| `decomposePath` | function | `(parent: Path, world: Path) => Path` | Inverse of `composePath` — undo `parent`'s translation from a world pose. |
| `decomposePath.parent` | param | `parent: Path` |  |
| `decomposePath.world` | param | `world: Path` |  |

## src/features/paths/flatten.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DEFAULT_FLATTEN_TOLERANCE` | const | `0.5` | Bezier flattening — subdivide cubic and quadratic segments into polyline approximations within a flatness tolerance. |
| `flattenCubic` | function | `(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, tolerance: number, out: number[]) => void` | Recursively subdivide a cubic bezier (P0..P3) and append `lineTo`-style vertices to `out` (interleaved x,y). |
| `flattenCubic.x0` | param | `x0: number` |  |
| `flattenCubic.y0` | param | `y0: number` |  |
| `flattenCubic.x1` | param | `x1: number` |  |
| `flattenCubic.y1` | param | `y1: number` |  |
| `flattenCubic.x2` | param | `x2: number` |  |
| `flattenCubic.y2` | param | `y2: number` |  |
| `flattenCubic.x3` | param | `x3: number` |  |
| `flattenCubic.y3` | param | `y3: number` |  |
| `flattenCubic.tolerance` | param | `tolerance: number` |  |
| `flattenCubic.out` | param | `out: number[]` |  |
| `flattenQuadratic` | function | `(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, tolerance: number, out: number[]) => void` | Recursively subdivide a quadratic bezier (P0, P1, P2). |
| `flattenQuadratic.x0` | param | `x0: number` |  |
| `flattenQuadratic.y0` | param | `y0: number` |  |
| `flattenQuadratic.x1` | param | `x1: number` |  |
| `flattenQuadratic.y1` | param | `y1: number` |  |
| `flattenQuadratic.x2` | param | `x2: number` |  |
| `flattenQuadratic.y2` | param | `y2: number` |  |
| `flattenQuadratic.tolerance` | param | `tolerance: number` |  |
| `flattenQuadratic.out` | param | `out: number[]` |  |

## src/features/paths/hitTest.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PointInPathOptions` | interface | `{ tolerance }` | Options for `pointInPath`. |
| `PointInPathOptions.tolerance?` | field | `number` | Bezier flattening tolerance in world units. |
| `pointInPath` | function | `(path: Path, x: number, y: number, opts: PointInPathOptions = {}) => boolean` | Filled-region hit-test for a `Path`. |
| `pointInPath.path` | param | `path: Path` |  |
| `pointInPath.x` | param | `x: number` |  |
| `pointInPath.y` | param | `y: number` |  |
| `pointInPath.opts` | param | `opts: PointInPathOptions = {}` |  |

## src/features/paths/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PATH_C` | reexport | `re-export from './types'` |  |
| `PATH_L` | reexport | `re-export from './types'` |  |
| `PATH_M` | reexport | `re-export from './types'` |  |
| `PATH_Q` | reexport | `re-export from './types'` |  |
| `PATH_Z` | reexport | `re-export from './types'` |  |
| `PATH_CMD_LENGTHS` | reexport | `re-export from './types'` |  |
| `Path` | reexport | `re-export from './types'` |  |
| `PolygonPath` | reexport | `re-export from './types'` |  |
| `RectPath` | reexport | `re-export from './types'` |  |
| `PathFillRule` | reexport | `re-export from './types'` |  |
| `PathBuilder` | reexport | `re-export from './builder'` |  |
| `polygonFromPoints` | reexport | `re-export from './builder'` |  |
| `rectPath` | reexport | `re-export from './builder'` |  |
| `boundsOfPath` | reexport | `re-export from './bounds'` |  |
| `pointInPath` | reexport | `re-export from './hitTest'` |  |
| `PointInPathOptions` | reexport | `re-export from './hitTest'` |  |
| `translatePath` | reexport | `re-export from './transform'` |  |
| `translatePolygonInPlace` | reexport | `re-export from './transform'` |  |
| `scalePathToBounds` | reexport | `re-export from './transform'` |  |
| `traceToContext` | reexport | `re-export from './canvas'` |  |
| `createPathLayer` | reexport | `re-export from './pathLayer'` |  |
| `CreatePathLayerOpts` | reexport | `re-export from './pathLayer'` |  |
| `flattenCubic` | reexport | `re-export from './flatten'` |  |
| `flattenQuadratic` | reexport | `re-export from './flatten'` |  |
| `DEFAULT_FLATTEN_TOLERANCE` | reexport | `re-export from './flatten'` |  |
| `composePath` | reexport | `re-export from './compose'` |  |
| `decomposePath` | reexport | `re-export from './compose'` |  |
| `unionBoundsPath` | reexport | `re-export from './unionBoundsPath'` |  |
| `pathPoseDescriptor` | reexport | `re-export from './poseDescriptor'` |  |
| `pathOriginProjection` | reexport | `re-export from './originProjection'` |  |
| `createPenPreviewLayer` | reexport | `re-export from './penPreviewLayer'` |  |
| `CreatePenPreviewLayerOptions` | reexport | `re-export from './penPreviewLayer'` |  |
| `PenPreviewStyle` | reexport | `re-export from './penPreviewLayer'` |  |

## src/features/paths/originProjection.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `pathOriginProjection` | const | `OriginProjection<Path>` | `OriginProjection` for `Path` poses. |

## src/features/paths/pathLayer.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `CreatePathLayerOpts` | interface | `{ id, label, getNodes, getPath, getFill, getStroke, isHidden }` | Options for `createPathLayer`. |
| `CreatePathLayerOpts.id?` | field | `string` |  |
| `CreatePathLayerOpts.label?` | field | `string` |  |
| `CreatePathLayerOpts.getNodes` | field | `() => readonly T[]` |  |
| `CreatePathLayerOpts.getPath` | field | `(node: T) => Path` |  |
| `CreatePathLayerOpts.getFill?` | field | `(node: T) => Paint \| null \| undefined` | Per-node fill paint. |
| `CreatePathLayerOpts.getStroke?` | field | `(node: T) => Stroke \| null \| undefined` | Per-node stroke. |
| `CreatePathLayerOpts.isHidden?` | field | `(node: T) => boolean` | Optional per-node hide hook (e.g., suppress while editing). |
| `createPathLayer` | function | `(opts: CreatePathLayerOpts<T>) => RenderLayer<unknown>` | Build a `RenderLayer` that fills/strokes `Path` instances enumerated from a node list. |
| `createPathLayer.opts` | param | `opts: CreatePathLayerOpts<T>` |  |

## src/features/paths/penPreviewLayer.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PenPreviewStyle` | interface | `{ anchorFill, anchorStroke, handleStroke, rubberBandStroke, closeHintFill, finishedSubpathStroke }` |  |
| `PenPreviewStyle.anchorFill?` | field | `string` |  |
| `PenPreviewStyle.anchorStroke?` | field | `string` |  |
| `PenPreviewStyle.handleStroke?` | field | `string` |  |
| `PenPreviewStyle.rubberBandStroke?` | field | `string` |  |
| `PenPreviewStyle.closeHintFill?` | field | `string` |  |
| `PenPreviewStyle.finishedSubpathStroke?` | field | `string` |  |
| `CreatePenPreviewLayerOptions` | interface | `{ penTool, style }` |  |
| `CreatePenPreviewLayerOptions.penTool` | field | `Tool<PenScratch>` | The Tool returned by useUserPenTool. |
| `CreatePenPreviewLayerOptions.style?` | field | `PenPreviewStyle` |  |
| `createPenPreviewLayer` | function | `(opts: CreatePenPreviewLayerOptions) => RenderLayer<unknown>` |  |
| `createPenPreviewLayer.opts` | param | `opts: CreatePenPreviewLayerOptions` |  |

## src/features/paths/poseDescriptor.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `pathPoseDescriptor` | const | `PoseDescriptor<Path>` | `PoseDescriptor` for `Path` poses — wires `useResize` to operate on `Path` directly. |

## src/features/paths/transform.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `translatePath` | function | `(path: Path, dx: number, dy: number) => Path` | Translate a path by (dx, dy). |
| `translatePath.path` | param | `path: Path` |  |
| `translatePath.dx` | param | `dx: number` |  |
| `translatePath.dy` | param | `dy: number` |  |
| `translatePolygonInPlace` | function | `(path: PolygonPath, dx: number, dy: number) => PolygonPath` | Translate a polygon path's coords *in place*. |
| `translatePolygonInPlace.path` | param | `path: PolygonPath` |  |
| `translatePolygonInPlace.dx` | param | `dx: number` |  |
| `translatePolygonInPlace.dy` | param | `dy: number` |  |
| `scalePathToBounds` | function | `(path: Path, target: RectPath) => Path` | Scale a path's coords so its current AABB maps to `target`. |
| `scalePathToBounds.path` | param | `path: Path` |  |
| `scalePathToBounds.target` | param | `target: RectPath` |  |

## src/features/paths/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PATH_M` | const | `0` | Command code: moveTo. |
| `PATH_L` | const | `1` | Command code: lineTo. |
| `PATH_C` | const | `2` | Command code: cubic bezier (`bezierCurveTo`). |
| `PATH_Q` | const | `3` | Command code: quadratic bezier (`quadraticCurveTo`). |
| `PATH_Z` | const | `4` | Command code: close subpath. |
| `PATH_CMD_LENGTHS` | const | `readonly number[]` | Float coords consumed by each command, indexed by command code. |
| `PathFillRule` | type | `'nonzero' \| 'evenodd'` | Fill rule used by polygon path hit-testing and `ctx.fill()`. |
| `PolygonPath` | interface | `{ kind, commands, coords, fillRule }` | Polygon path with arbitrary contours and optional bezier segments. |
| `PolygonPath.kind` | field | `'polygon'` |  |
| `PolygonPath.commands` | field | `Uint8Array` |  |
| `PolygonPath.coords` | field | `Float32Array` |  |
| `PolygonPath.fillRule` | field | `PathFillRule` |  |
| `RectPath` | interface | `{ kind, x, y, width, height }` | Axis-aligned rectangle. |
| `RectPath.kind` | field | `'rect'` |  |
| `RectPath.x` | field | `number` |  |
| `RectPath.y` | field | `number` |  |
| `RectPath.width` | field | `number` |  |
| `RectPath.height` | field | `number` |  |
| `Path` | type | `PolygonPath \| RectPath` | Canonical path shape — either an axis-aligned rect (fast path) or a polygon command stream. |

## src/features/paths/unionBoundsPath.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `unionBoundsPath` | function | `(paths: Iterable<Path>) => RectPath \| null` | AABB envelope over a set of `Path` instances; returns `null` for empty input. |
| `unionBoundsPath.paths` | param | `paths: Iterable<Path>` |  |

## src/features/patterns/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `TilePatternOpts` | interface | `{ size, draw }` | Options for `createTilePattern`. |
| `TilePatternOpts.size` | field | `number` | Edge length (in pixels) of the square offscreen tile. |
| `TilePatternOpts.draw` | field | `(oc: CanvasRenderingContext2D, size: number) => void` | Paint one tile at integer-pixel coordinates `(0, 0) .. |
| `createTilePattern` | function | `(ctx: CanvasRenderingContext2D, opts: TilePatternOpts) => CanvasPattern \| null` | Render a single tile to an offscreen canvas and return a repeating `CanvasPattern`. |
| `createTilePattern.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `createTilePattern.opts` | param | `opts: TilePatternOpts` |  |

## src/features/patterns/patterns-builtin.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `HatchParams` | interface | `{ color, size, lineWidth }` | Diagonal hatch (forward slash). |
| `HatchParams.color` | field | `string` |  |
| `HatchParams.size?` | field | `number` |  |
| `HatchParams.lineWidth?` | field | `number` |  |
| `hatch` | function | `(ctx: CanvasRenderingContext2D, params: HatchParams) => CanvasPattern \| null` |  |
| `hatch.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `hatch.params` | param | `params: HatchParams` |  |
| `CrosshatchParams` | interface | `{ color, size, lineWidth }` | Diagonal hatch in both directions. |
| `CrosshatchParams.color` | field | `string` |  |
| `CrosshatchParams.size?` | field | `number` |  |
| `CrosshatchParams.lineWidth?` | field | `number` |  |
| `crosshatch` | function | `(ctx: CanvasRenderingContext2D, params: CrosshatchParams) => CanvasPattern \| null` |  |
| `crosshatch.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `crosshatch.params` | param | `params: CrosshatchParams` |  |
| `DotsParams` | interface | `{ color, size, radius }` | Regular grid of filled dots. |
| `DotsParams.color` | field | `string` |  |
| `DotsParams.size?` | field | `number` |  |
| `DotsParams.radius?` | field | `number` |  |
| `dots` | function | `(ctx: CanvasRenderingContext2D, params: DotsParams) => CanvasPattern \| null` |  |
| `dots.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `dots.params` | param | `params: DotsParams` |  |
| `ChunksParams` | interface | `{ color, bg, size, density, chunkSize, seed }` | Random scatter of small ellipses on top of a solid background. |
| `ChunksParams.color` | field | `string` |  |
| `ChunksParams.bg?` | field | `string` |  |
| `ChunksParams.size?` | field | `number` |  |
| `ChunksParams.density?` | field | `number` | Coverage: `chunks * chunkSize²` per `size²` tile. |
| `ChunksParams.chunkSize?` | field | `number` |  |
| `ChunksParams.seed?` | field | `number` |  |
| `chunks` | function | `(ctx: CanvasRenderingContext2D, params: ChunksParams) => CanvasPattern \| null` |  |
| `chunks.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `chunks.params` | param | `params: ChunksParams` |  |

## src/features/selection/overlay.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ComposeSelectionPoseOpts` | interface | `{ moveOverlay, resizeOverlay, getStoredPose, getBounds, fromBounds, groupAdapter }` | Options for `composeSelectionPose`. |
| `ComposeSelectionPoseOpts.moveOverlay?` | field | `{ poses: Map<string, TPose> } \| null` | Move overlay; when present its `poses` map wins over everything else. |
| `ComposeSelectionPoseOpts.resizeOverlay?` | field | `{ id: string; currentPose: TPose; leafPoses?: Map<string, TPose>; } \| null` | Resize overlay; consulted only when move overlay does not own the id. |
| `ComposeSelectionPoseOpts.getStoredPose` | field | `(id: string) => TPose` | Fallback pose lookup (typically the stored/committed pose). |
| `ComposeSelectionPoseOpts.getBounds?` | field | `(pose: TPose) => Bounds` | Project a pose into its AABB. |
| `ComposeSelectionPoseOpts.fromBounds?` | field | `(bounds: Bounds) => TPose` | Wrap an AABB back into a TPose. |
| `ComposeSelectionPoseOpts.groupAdapter?` | field | `GroupAdapter` | Optional group adapter. |
| `composeSelectionPose` | function | `(opts: ComposeSelectionPoseOpts<TPose>) => (id: string) => TPose \| null` | Build a pose resolver for a selection. |
| `composeSelectionPose.opts` | param | `opts: ComposeSelectionPoseOpts<TPose>` |  |
| `SelectionOutlineLayerOpts` | interface | `{ outline }` | Options for `createSelectionOutlineLayer`. |
| `SelectionOutlineLayerOpts.outline?` | field | `Stroke & { pad?: number }` | Outline stroke style + outset distance from the pose rect. |
| `SelectionHandlesLayerOpts` | interface | `{ handles, handlesOf, rotationHandle }` | Options for `createSelectionHandlesLayer`. |
| `SelectionHandlesLayerOpts.handles?` | field | `{ size?: number; fill?: Paint; outline?: Stroke; }` | Handle visuals. |
| `SelectionHandlesLayerOpts.handlesOf?` | field | `(bounds: Bounds) => { x: number; y: number }[]` | Override handle placement. |
| `SelectionHandlesLayerOpts.rotationHandle?` | field | `\| boolean \| { /** World-pixel distance from the top edge to the handle center. */ distance?: number; }` | Render a rotation handle above the (rotated) top-center of the AABB. |
| `SelectionOverlayLayerOpts` | interface | `{ outline, handles, handlesOf, rotationHandle }` | Options for `createSelectionOverlayLayer`. |
| `SelectionOverlayLayerOpts.outline?` | field | `Stroke & { pad?: number }` |  |
| `SelectionOverlayLayerOpts.handles?` | field | `\| { size?: number; fill?: Paint; outline?: Stroke; } \| false` | Pass `false` to render outlines only. |
| `SelectionOverlayLayerOpts.handlesOf?` | field | `(bounds: Bounds) => { x: number; y: number }[]` |  |
| `SelectionOverlayLayerOpts.rotationHandle?` | field | `\| boolean \| { distance?: number; }` | See {@link SelectionHandlesLayerOpts.rotationHandle}. |
| `createSelectionOutlineLayer` | function | `(opts: SelectionOutlineLayerOpts<TPose>) => RenderLayer<unknown>` | `RenderLayer` that draws selection outlines only. |
| `createSelectionOutlineLayer.opts` | param | `opts: SelectionOutlineLayerOpts<TPose>` |  |
| `createSelectionHandlesLayer` | function | `(opts: SelectionHandlesLayerOpts<TPose>) => RenderLayer<unknown>` | `RenderLayer` that draws selection handles only. |
| `createSelectionHandlesLayer.opts` | param | `opts: SelectionHandlesLayerOpts<TPose>` |  |
| `createSelectionOverlayLayer` | function | `(opts: SelectionOverlayLayerOpts<TPose>) => RenderLayer<unknown>` | Convenience wrapper that draws outlines then handles in a single layer. |
| `createSelectionOverlayLayer.opts` | param | `opts: SelectionOverlayLayerOpts<TPose>` |  |

## src/features/selection/useSelection.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `SelectionMode` | type | `'single' \| 'multi'` | Selection click policy. |
| `SelectionExtendKey` | type | `'shift' \| 'meta' \| 'ctrl'` | Modifier key used to extend the selection in `multi` mode. |
| `SelectionApi` | interface | `{ current, get, set, add, remove, toggle, clear, contains, applyClick, adapterMethods }` | API returned by {@link useSelection}. |
| `SelectionApi.current` | field | `string[]` | Current selection. |
| `SelectionApi.get` | field | `string[]` | Imperative read for use inside event callbacks (avoids stale closures). |
| `SelectionApi.set` | field | `void` | Replace selection. |
| `SelectionApi.add` | field | `void` | Add id (multi-mode appends; single-mode replaces). |
| `SelectionApi.remove` | field | `void` | Remove id from selection. |
| `SelectionApi.toggle` | field | `void` | Toggle id in/out of selection. |
| `SelectionApi.clear` | field | `void` | Clear selection. |
| `SelectionApi.contains` | field | `boolean` | True if id is selected. |
| `SelectionApi.applyClick` | field | `void` | Apply a click to the selection per the configured mode/extend key. |
| `SelectionApi.adapterMethods` | field | `{ getSelection: () => string[]; setSelection: (ids: string[]) => void; }` | Pre-built methods for spreading into an adapter that needs them. |
| `UseSelectionOptions` | interface | `{ mode, extend, initial }` | Options for {@link useSelection}. |
| `UseSelectionOptions.mode?` | field | `SelectionMode` | Default `'single'`. |
| `UseSelectionOptions.extend?` | field | `SelectionExtendKey` | Default `'shift'`. |
| `UseSelectionOptions.initial?` | field | `string[]` | Default `[]`. |
| `useSelection` | hook | `(opts: UseSelectionOptions = {}) => SelectionApi` | Default implementation of the `getSelection` / `setSelection` adapter contract every action hook (delete, duplicate, nudge, group, ...) requires. |
| `useSelection.opts` | param | `opts: UseSelectionOptions = {}` |  |

## src/features/text/fitTextPose.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `FitTextPoseOptions` | interface | `{ axis, padding }` | Options for `fitTextPose`. |
| `FitTextPoseOptions.axis?` | field | `'height' \| 'both'` | Which axis (or axes) to recompute. |
| `FitTextPoseOptions.padding?` | field | `number \| { x?: number; y?: number }` | Padding (world units) added to all four sides. |
| `fitTextPose` | function | `(ctx: CanvasRenderingContext2D, pose: TextPose, opts: FitTextPoseOptions = {}) => TextPose` | Recompute a `TextPose`'s `width`/`height` to fit its content; pure helper, doesn't mutate scene state. |
| `fitTextPose.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `fitTextPose.pose` | param | `pose: TextPose` |  |
| `fitTextPose.opts` | param | `opts: FitTextPoseOptions = {}` |  |

## src/features/text/hitTest.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PointInTextPoseOpts` | interface | `{ padding }` | Options for `pointInTextPose`. |
| `PointInTextPoseOpts.padding?` | field | `number` | Extra padding (world units) added to the rect on all sides. |
| `pointInTextPose` | function | `(x: number, y: number, pose: TextPose, opts: PointInTextPoseOpts = {}) => boolean` | Coarse pose-rect hit-test for a text node — suitable for click-to-edit dispatch. |
| `pointInTextPose.x` | param | `x: number` |  |
| `pointInTextPose.y` | param | `y: number` |  |
| `pointInTextPose.pose` | param | `pose: TextPose` |  |
| `pointInTextPose.opts` | param | `opts: PointInTextPoseOpts = {}` |  |
| `caretIndexAt` | function | `(ctx: CanvasRenderingContext2D, x: number, y: number, pose: TextPose) => number` | Map a world-space point inside `pose` to a character offset into `pose.text` (0..text.length). |
| `caretIndexAt.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `caretIndexAt.x` | param | `x: number` |  |
| `caretIndexAt.y` | param | `y: number` |  |
| `caretIndexAt.pose` | param | `pose: TextPose` |  |

## src/features/text/markdownText.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `StyledRun` | interface | `{ text, bold, italic, sizeFactor }` | A contiguous styled span of text produced by `parseMarkdownRuns`. |
| `StyledRun.text` | field | `string` |  |
| `StyledRun.bold` | field | `boolean` |  |
| `StyledRun.italic` | field | `boolean` |  |
| `StyledRun.sizeFactor` | field | `number` | Multiplicative size factor applied to the base fontSize (default 1). |
| `DEFAULT_SIZE_STEP` | const | `1.15` | Default multiplicative step for `[`/`(`/`]`/`)` size markup in `parseMarkdownRuns`. |
| `ParseMarkdownRunsOptions` | interface | `{ sizeStep }` | Options for `parseMarkdownRuns`. |
| `ParseMarkdownRunsOptions.sizeStep?` | field | `number` | Multiplier applied per `[` (and divided per `(`). |
| `parseMarkdownRuns` | function | `(input: string, opts: ParseMarkdownRunsOptions = {}) => StyledRun[]` | Tokenize a small markdown subset (`*italic*`, `**bold**`, `***both***`, `[bigger]`, `(smaller)`) into styled runs. |
| `parseMarkdownRuns.input` | param | `input: string` |  |
| `parseMarkdownRuns.opts` | param | `opts: ParseMarkdownRunsOptions = {}` |  |
| `MeasureFn` | type | `(text: string, fontSize: number, bold: boolean, italic: boolean) => number` | Width-measurement strategy for `layoutMarkdown`; canvas-backed default supplied by `createMarkdownRenderer`. |
| `PositionedRun` | interface | `{ x }` | A `StyledRun` with its computed x-offset relative to the start of its line. |
| `PositionedRun.x` | field | `number` |  |
| `LayoutLine` | interface | `{ runs, width, height }` | A single laid-out line of text: its positioned runs, total width, and computed line height. |
| `LayoutLine.runs` | field | `PositionedRun[]` |  |
| `LayoutLine.width` | field | `number` |  |
| `LayoutLine.height` | field | `number` |  |
| `LayoutResult` | interface | `{ lines, width, height }` | Output of `layoutMarkdown`: per-line breakdown plus overall block dimensions. |
| `LayoutResult.lines` | field | `LayoutLine[]` |  |
| `LayoutResult.width` | field | `number` |  |
| `LayoutResult.height` | field | `number` |  |
| `layoutMarkdown` | function | `(runs: StyledRun[], maxWidth: number, fontSize: number, measure: MeasureFn, lineHeightFactor: number = 1.3) => LayoutResult` | Word-wrap parsed runs into lines bounded by `maxWidth`; pass `Infinity` for single-line layout. |
| `layoutMarkdown.runs` | param | `runs: StyledRun[]` |  |
| `layoutMarkdown.maxWidth` | param | `maxWidth: number` |  |
| `layoutMarkdown.fontSize` | param | `fontSize: number` |  |
| `layoutMarkdown.measure` | param | `measure: MeasureFn` |  |
| `layoutMarkdown.lineHeightFactor` | param | `lineHeightFactor: number = 1.3` |  |
| `MarkdownFontOptions` | interface | `{ family, weight, color, lineHeight, sizeStep }` | Font styling options threaded through `createMarkdownRenderer`. |
| `MarkdownFontOptions.family?` | field | `string` | Font-family spec (e.g. |
| `MarkdownFontOptions.weight?` | field | `string \| number` | Numeric weight applied to non-bold runs. |
| `MarkdownFontOptions.color?` | field | `string` | Override fill color. |
| `MarkdownFontOptions.lineHeight?` | field | `number` | Multiplier applied to font size for line height. |
| `MarkdownFontOptions.sizeStep?` | field | `number` | Multiplicative step for `[`/`(`/`]`/`)` size markup in markdown parsing. |
| `createMarkdownRenderer` | function | `(ctx: CanvasRenderingContext2D, text: string, fontSize: number, maxWidth: number = Infinity, fontOpts: MarkdownFontOptions = {}) => { renderer: TextRenderer; strokeRenderer: TextRenderer; width: number; height: number }` | Build a fill+stroke `TextRenderer` pair for a markdown string at the given size; pre-computes layout once. |
| `createMarkdownRenderer.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `createMarkdownRenderer.text` | param | `text: string` |  |
| `createMarkdownRenderer.fontSize` | param | `fontSize: number` |  |
| `createMarkdownRenderer.maxWidth` | param | `maxWidth: number = Infinity` |  |
| `createMarkdownRenderer.fontOpts` | param | `fontOpts: MarkdownFontOptions = {}` |  |

## src/features/text/measureText.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `MeasuredText` | interface | `{ lines, lineStarts, height }` | Result of `measureText`: wrapped lines, per-line source offsets, and total block height. |
| `MeasuredText.lines` | field | `string[]` |  |
| `MeasuredText.lineStarts` | field | `number[]` |  |
| `MeasuredText.height` | field | `number` |  |
| `measureText` | function | `(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, style: ResolvedTextStyle) => MeasuredText` | Greedy word-wrap text measurement against `maxWidth`; preserves explicit `\n` breaks. |
| `measureText.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `measureText.text` | param | `text: string` |  |
| `measureText.maxWidth` | param | `maxWidth: number` |  |
| `measureText.style` | param | `style: ResolvedTextStyle` |  |

## src/features/text/renderLabel.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `TextRenderer` | type | `( ctx: CanvasRenderingContext2D, text: string, x: number, y: number, ) => void` | Pluggable text-painting strategy. |
| `LabelOptions` | interface | `{ align, fontSize, renderText, width, height, padX, padY, cornerRadius }` | Visual options for `renderLabel`. |
| `LabelOptions.align?` | field | `'center' \| 'left'` |  |
| `LabelOptions.fontSize?` | field | `number` |  |
| `LabelOptions.renderText?` | field | `TextRenderer` |  |
| `LabelOptions.width?` | field | `number` | Override the pill width (content width, excluding padding). |
| `LabelOptions.height?` | field | `number` | Override the pill height (content height, excluding padding). |
| `LabelOptions.padX?` | field | `number` | Horizontal padding inside the pill. |
| `LabelOptions.padY?` | field | `number` | Vertical padding inside the pill. |
| `LabelOptions.cornerRadius?` | field | `number` | Corner radius of the pill background. |
| `renderLabel` | function | `(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options: LabelOptions = {}) => void` | Render a text label with a 75%-opaque black pill background and white text. |
| `renderLabel.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `renderLabel.text` | param | `text: string` |  |
| `renderLabel.x` | param | `x: number` |  |
| `renderLabel.y` | param | `y: number` |  |
| `renderLabel.options` | param | `options: LabelOptions = {}` |  |
| `defaultLabelTextRenderer` | function | `(ctx, text, x, y)` | Default `TextRenderer` used by `renderLabel`: white fill, no styling. |
| `defaultLabelTextRenderer.ctx` | param | `ctx` |  |
| `defaultLabelTextRenderer.text` | param | `text` |  |
| `defaultLabelTextRenderer.x` | param | `x` |  |
| `defaultLabelTextRenderer.y` | param | `y` |  |

## src/features/text/textLayer.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `TextPose` | interface | `{ x, y, width, height, text, style }` | Pose for a text node: bounding rect plus the text and optional style. |
| `TextPose.x` | field | `number` |  |
| `TextPose.y` | field | `number` |  |
| `TextPose.width` | field | `number` |  |
| `TextPose.height` | field | `number` |  |
| `TextPose.text` | field | `string` |  |
| `TextPose.style?` | field | `TextStyle` |  |
| `CreateTextLayerOpts` | interface | `{ id, label, getTexts, getPose, isHidden }` | Options for `createTextLayer`. |
| `CreateTextLayerOpts.id?` | field | `string` |  |
| `CreateTextLayerOpts.label?` | field | `string` |  |
| `CreateTextLayerOpts.getTexts` | field | `() => readonly T[]` |  |
| `CreateTextLayerOpts.getPose` | field | `(node: T) => TextPose` |  |
| `CreateTextLayerOpts.isHidden?` | field | `(node: T) => boolean` | Optional per-node hide hook (e.g., suppress while editing). |
| `createTextLayer` | function | `(opts: CreateTextLayerOpts<T>) => RenderLayer<unknown>` | Build a `RenderLayer` that draws text nodes using their `TextPose` and resolved style. |
| `createTextLayer.opts` | param | `opts: CreateTextLayerOpts<T>` |  |

## src/features/text/textStyle.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `TextStyle` | interface | `{ fontSize, fontFamily, fontWeight, fontStyle, align, lineHeight, fill, caretColor, selectionBackground, selectionColor }` | User-facing text style. |
| `TextStyle.fontSize?` | field | `number` | Font size in world units. |
| `TextStyle.fontFamily?` | field | `string` | Default `'sans-serif'`. |
| `TextStyle.fontWeight?` | field | `number \| string` | Default 400. |
| `TextStyle.fontStyle?` | field | `'normal' \| 'italic'` | Default `'normal'`. |
| `TextStyle.align?` | field | `'left' \| 'center' \| 'right'` | Default `'left'`. |
| `TextStyle.lineHeight?` | field | `number` | Multiplier applied to `fontSize`. |
| `TextStyle.fill?` | field | `Paint` | Default `{ fill: 'solid', color: '#000' }`. |
| `TextStyle.caretColor?` | field | `string` | Caret color used by the edit overlay. |
| `TextStyle.selectionBackground?` | field | `string` | Selection background color used by the edit overlay's `::selection` pseudo-element. |
| `TextStyle.selectionColor?` | field | `string` | Selection text color paired with `selectionBackground`. |
| `ResolvedTextStyle` | interface | `{ fontSize, fontFamily, fontWeight, fontStyle, align, lineHeight, fill, caretColor, selectionBackground, selectionColor }` | `TextStyle` with all fields filled in from defaults — what the renderer actually consumes. |
| `ResolvedTextStyle.fontSize` | field | `number` |  |
| `ResolvedTextStyle.fontFamily` | field | `string` |  |
| `ResolvedTextStyle.fontWeight` | field | `number \| string` |  |
| `ResolvedTextStyle.fontStyle` | field | `'normal' \| 'italic'` |  |
| `ResolvedTextStyle.align` | field | `'left' \| 'center' \| 'right'` |  |
| `ResolvedTextStyle.lineHeight` | field | `number` |  |
| `ResolvedTextStyle.fill` | field | `Paint` |  |
| `ResolvedTextStyle.caretColor` | field | `string` |  |
| `ResolvedTextStyle.selectionBackground` | field | `string \| null` |  |
| `ResolvedTextStyle.selectionColor` | field | `string \| null` |  |
| `DEFAULT_TEXT_STYLE` | const | `ResolvedTextStyle` | Default resolved style used when a `TextPose` omits `style`. |
| `resolveTextStyle` | function | `(style?: TextStyle) => ResolvedTextStyle` | Fill in a partial `TextStyle` with defaults from `DEFAULT_TEXT_STYLE`. |
| `resolveTextStyle.style` | param | `style?: TextStyle` |  |
| `fontString` | function | `(s: ResolvedTextStyle) => string` | Build a CSS `font` shorthand suitable for `ctx.font`. |
| `fontString.s` | param | `s: ResolvedTextStyle` |  |

## src/features/text/useTextEdit.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `TextEditScreenPose` | interface | `{ x, y, width, height, fontSize, lineHeight }` | Screen-space pose passed to `useTextEdit` so the overlay can be placed and sized in CSS pixels. |
| `TextEditScreenPose.x` | field | `number` | Top-left in CSS pixels relative to `container`. |
| `TextEditScreenPose.y` | field | `number` |  |
| `TextEditScreenPose.width` | field | `number` |  |
| `TextEditScreenPose.height` | field | `number` |  |
| `TextEditScreenPose.fontSize` | field | `number` | Effective on-screen font size (style.fontSize * zoom). |
| `TextEditScreenPose.lineHeight?` | field | `number` | Effective on-screen line height multiplier (defaults to style.lineHeight). |
| `UseTextEditOptions` | interface | `{ container, getText, getStyle, getScreenPose, setText }` | Options for `useTextEdit`. |
| `UseTextEditOptions.container` | field | `HTMLElement \| null` | Element the overlay is appended to. |
| `UseTextEditOptions.getText` | field | `(id: string) => string` | Read the current text for `id`. |
| `UseTextEditOptions.getStyle` | field | `(id: string) => TextStyle \| undefined` | Read style for `id` (used for font setup on the overlay). |
| `UseTextEditOptions.getScreenPose` | field | `(id: string) => TextEditScreenPose \| null` | Read screen-space pose for `id`. |
| `UseTextEditOptions.setText` | field | `(id: string, text: string) => void` | Commit text. |
| `StartEditOptions` | interface | `{ caret }` | Options for `useTextEdit().startEdit`. |
| `StartEditOptions.caret?` | field | `number \| 'all'` | Where to place the caret on edit start. |
| `UseTextEditReturn` | interface | `{ editingId, startEdit, cancelEdit, commit, isEditing }` | Return shape of `useTextEdit`. |
| `UseTextEditReturn.editingId` | field | `string \| null` |  |
| `UseTextEditReturn.startEdit` | field | `(id: string, opts?: StartEditOptions) => void` |  |
| `UseTextEditReturn.cancelEdit` | field | `() => void` |  |
| `UseTextEditReturn.commit` | field | `() => void` |  |
| `UseTextEditReturn.isEditing` | field | `(id: string) => boolean` |  |
| `useTextEdit` | hook | `(opts: UseTextEditOptions) => UseTextEditReturn` | In-place text editing via a contenteditable overlay positioned over the text node's screen-space pose. |
| `useTextEdit.opts` | param | `opts: UseTextEditOptions` |  |

## src/features/viewport/clampView.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ClampBounds` | interface | `{ x, y, width, height }` |  |
| `ClampBounds.x` | field | `number` |  |
| `ClampBounds.y` | field | `number` |  |
| `ClampBounds.width` | field | `number` |  |
| `ClampBounds.height` | field | `number` |  |
| `CanvasSize` | interface | `{ width, height }` |  |
| `CanvasSize.width` | field | `number` |  |
| `CanvasSize.height` | field | `number` |  |
| `clampView` | function | `(view: View, bounds: ClampBounds, canvas: CanvasSize) => View` | Clamp a `View` so the visible world rect stays within `bounds`. |
| `clampView.view` | param | `view: View` |  |
| `clampView.bounds` | param | `bounds: ClampBounds` |  |
| `clampView.canvas` | param | `canvas: CanvasSize` |  |

## src/features/viewport/clientToCanvas.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `clientToCanvas` | function | `(canvas: HTMLCanvasElement, clientX: number, clientY: number) => [number, number]` | Convert client coords to canvas CSS-pixel coords (relative to the canvas's top-left). |
| `clientToCanvas.canvas` | param | `canvas: HTMLCanvasElement` |  |
| `clientToCanvas.clientX` | param | `clientX: number` |  |
| `clientToCanvas.clientY` | param | `clientY: number` |  |

## src/features/viewport/fitToBounds.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `fitZoom` | function | `(availW: number, availH: number, contentW: number, contentH: number, clamp?: { min?: number; max?: number }) => number` | Compute the largest uniform zoom (px per content-unit) that fits a content rect of `contentW x contentH` (in content units) into a viewport rect of `availW x av |
| `fitZoom.availW` | param | `availW: number` |  |
| `fitZoom.availH` | param | `availH: number` |  |
| `fitZoom.contentW` | param | `contentW: number` |  |
| `fitZoom.contentH` | param | `contentH: number` |  |
| `fitZoom.clamp` | param | `clamp?: { min?: number; max?: number }` |  |
| `fitToBounds` | function | `(viewportW: number, viewportH: number, contentW: number, contentH: number, paddingPx = 0, clamp?: { min?: number; max?: number }) => { zoom: number; panX: number; panY: number }` | Compute zoom + pan that centers `contentW x contentH` (content units) inside a `viewportW x viewportH` (pixel) rect. |
| `fitToBounds.viewportW` | param | `viewportW: number` |  |
| `fitToBounds.viewportH` | param | `viewportH: number` |  |
| `fitToBounds.contentW` | param | `contentW: number` |  |
| `fitToBounds.contentH` | param | `contentH: number` |  |
| `fitToBounds.paddingPx` | param | `paddingPx = 0` |  |
| `fitToBounds.clamp` | param | `clamp?: { min?: number; max?: number }` |  |

## src/features/viewport/pixelDensity.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `SetupCanvasDprOptions` | interface | `{ dpr }` | Resize a canvas's backing store for the current `devicePixelRatio` and pre-apply a dpr-scaling transform so subsequent draw calls operate in CSS pixels. |
| `SetupCanvasDprOptions.dpr?` | field | `number` | Override the dpr used. |
| `setupCanvasDpr` | function | `(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cssWidth: number, cssHeight: number, options: SetupCanvasDprOptions = {}) => number` | Resize a canvas's backing store for the current `devicePixelRatio` and pre-scale the context to draw in CSS pixels. |
| `setupCanvasDpr.canvas` | param | `canvas: HTMLCanvasElement` |  |
| `setupCanvasDpr.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `setupCanvasDpr.cssWidth` | param | `cssWidth: number` |  |
| `setupCanvasDpr.cssHeight` | param | `cssHeight: number` |  |
| `setupCanvasDpr.options` | param | `options: SetupCanvasDprOptions = {}` |  |
| `useFixedPixelRatio` | hook | `() => number` | Opt-out hook for DPR scaling. |

## src/features/viewport/useAutoCenter.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `computeFitView` | function | `(viewportW: number, viewportH: number, contentW: number, contentH: number, padRatio = 0.85) => { zoom: number; panX: number; panY: number }` | Compute zoom and pan that fit `contentW x contentH` (in content units) inside `viewportW x viewportH` (in pixels). |
| `computeFitView.viewportW` | param | `viewportW: number` |  |
| `computeFitView.viewportH` | param | `viewportH: number` |  |
| `computeFitView.contentW` | param | `contentW: number` |  |
| `computeFitView.contentH` | param | `contentH: number` |  |
| `computeFitView.padRatio` | param | `padRatio = 0.85` |  |
| `useAutoCenter` | hook | `(width: number, height: number, contentW: number, contentH: number, setZoom: (z: number) => void, setPan: (x: number, y: number) => void)` | Run `computeFitView` once when the viewport first has non-zero size, and apply the result via the supplied setters. |
| `useAutoCenter.width` | param | `width: number` |  |
| `useAutoCenter.height` | param | `height: number` |  |
| `useAutoCenter.contentW` | param | `contentW: number` |  |
| `useAutoCenter.contentH` | param | `contentH: number` |  |
| `useAutoCenter.setZoom` | param | `setZoom: (z: number) => void` |  |
| `useAutoCenter.setPan` | param | `setPan: (x: number, y: number) => void` |  |

## src/features/viewport/useCanvasSize.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useCanvasSize` | hook | `(containerRef: RefObject<HTMLDivElement \| null>) => CanvasSize` | Track a container's content-rect size and the current devicePixelRatio via `ResizeObserver`. |
| `useCanvasSize.containerRef` | param | `containerRef: RefObject<HTMLDivElement \| null>` |  |

## src/features/viewport/useZoom.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseZoomOptions` | interface | `{ zoom, setZoom, pan, setPan, min, max, wheelStep, keyStep, viewport, sources, ... }` | Options for `useZoom`. |
| `UseZoomOptions.zoom` | field | `number` |  |
| `UseZoomOptions.setZoom` | field | `(next: number) => void` |  |
| `UseZoomOptions.pan` | field | `{ x: number; y: number }` |  |
| `UseZoomOptions.setPan` | field | `(next: { x: number; y: number }) => void` |  |
| `UseZoomOptions.min?` | field | `number` |  |
| `UseZoomOptions.max?` | field | `number` |  |
| `UseZoomOptions.wheelStep?` | field | `number` |  |
| `UseZoomOptions.keyStep?` | field | `number` |  |
| `UseZoomOptions.viewport?` | field | `{ width: number; height: number }` |  |
| `UseZoomOptions.sources?` | field | `{ wheel?: boolean; keys?: boolean; doubleClick?: boolean; pinch?: boolean; }` |  |
| `UseZoomOptions.wheelRequiresModifier?` | field | `boolean` |  |
| `UseZoomReturn` | interface | `{ onWheel, onKeyDown, onDoubleClick, zoomTo, zoomBy, reset }` | Handlers and imperative actions returned by `useZoom`. |
| `UseZoomReturn.onWheel` | field | `void` |  |
| `UseZoomReturn.onKeyDown` | field | `void` |  |
| `UseZoomReturn.onDoubleClick` | field | `void` |  |
| `UseZoomReturn.zoomTo` | field | `void` |  |
| `UseZoomReturn.zoomBy` | field | `void` |  |
| `UseZoomReturn.reset` | field | `void` |  |
| `useZoom` | hook | `(opts: UseZoomOptions) => UseZoomReturn` | Wheel/key/double-click zoom with focal-point preservation; returns event handlers and `zoomTo`/`zoomBy`/`reset`. |
| `useZoom.opts` | param | `opts: UseZoomOptions` |  |

## src/features/viewport/view.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `View` | interface | `{ x, y, scale }` | Viewport state in camera-position semantics. |
| `View.x` | field | `number` |  |
| `View.y` | field | `number` |  |
| `View.scale` | field | `number` |  |
| `viewToTransform` | function | `(view: View) => ViewTransform` | Bridge `View` into the legacy `ViewTransform` shape so chrome can keep calling `worldToScreen` / `screenToWorld`. |
| `viewToTransform.view` | param | `view: View` |  |

## src/features/viewport/viewTransform.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ViewTransform` | interface | `{ panX, panY, zoom }` | Pan offset (in pixels) plus uniform zoom (pixels per content unit). |
| `ViewTransform.panX` | field | `number` |  |
| `ViewTransform.panY` | field | `number` |  |
| `ViewTransform.zoom` | field | `number` |  |
| `worldToScreen` | function | `(worldX: number, worldY: number, view: ViewTransform) => [number, number]` | Project a world-space point to screen-space pixels through a `ViewTransform`. |
| `worldToScreen.worldX` | param | `worldX: number` |  |
| `worldToScreen.worldY` | param | `worldY: number` |  |
| `worldToScreen.view` | param | `view: ViewTransform` |  |
| `screenToWorld` | function | `(screenX: number, screenY: number, view: ViewTransform) => [number, number]` | Inverse of `worldToScreen` — recover the world-space point under a screen-space pixel. |
| `screenToWorld.screenX` | param | `screenX: number` |  |
| `screenToWorld.screenY` | param | `screenY: number` |  |
| `screenToWorld.view` | param | `view: ViewTransform` |  |

## src/features/viewport/wheelHandler.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `WheelState` | interface | `{ zoom, panX, panY }` | Pure viewport state consumed and returned by `computeWheelAction`. |
| `WheelState.zoom` | field | `number` | Multiplier; `1` = 100% / no zoom. |
| `WheelState.panX` | field | `number` |  |
| `WheelState.panY` | field | `number` |  |
| `WheelInput` | interface | `{ deltaX, deltaY, mouseX, mouseY, shiftKey, metaKey }` | Wheel-event input, decoupled from the DOM `WheelEvent` shape for testability. |
| `WheelInput.deltaX` | field | `number` |  |
| `WheelInput.deltaY` | field | `number` |  |
| `WheelInput.mouseX` | field | `number` |  |
| `WheelInput.mouseY` | field | `number` |  |
| `WheelInput.shiftKey?` | field | `boolean` |  |
| `WheelInput.metaKey?` | field | `boolean` |  |
| `ZoomBounds` | interface | `{ min, max }` | Inclusive `[min, max]` zoom clamp for `computeWheelAction`. |
| `ZoomBounds.min` | field | `number` |  |
| `ZoomBounds.max` | field | `number` |  |
| `computeWheelAction` | function | `(state: WheelState, input: WheelInput, bounds: ZoomBounds = { min: DEFAULT_MIN_ZOOM, max: DEFAULT_MAX_ZOOM }) => WheelState` | Pure reducer: given current viewport state and a wheel input, return the next state (zoom, pan, or scroll). |
| `computeWheelAction.state` | param | `state: WheelState` |  |
| `computeWheelAction.input` | param | `input: WheelInput` |  |
| `computeWheelAction.bounds` | param | `bounds: ZoomBounds = { min: DEFAULT_MIN_ZOOM, max: DEFAULT_MAX_ZOOM }` |  |

## src/features/viewport/zoomAt.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ZoomClampOpts` | interface | `{ min, max }` | Optional clamp bounds for `zoomAt`. |
| `ZoomClampOpts.min?` | field | `number` |  |
| `ZoomClampOpts.max?` | field | `number` |  |
| `zoomAt` | function | `(view: View, anchor: { x: number; y: number }, factor: number, opts?: ZoomClampOpts) => View` | Pure zoom primitive. |
| `zoomAt.view` | param | `view: View` |  |
| `zoomAt.anchor` | param | `anchor: { x: number; y: number }` |  |
| `zoomAt.factor` | param | `factor: number` |  |
| `zoomAt.opts` | param | `opts?: ZoomClampOpts` |  |

## src/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from './features/grid'` | reexport-all | `*` |  |
| `* from './features/viewport/viewTransform'` | reexport-all | `*` |  |
| `* from './features/drag/dragGhost'` | reexport-all | `*` |  |
| `* from './features/drag/thresholdDrag'` | reexport-all | `*` |  |
| `* from './features/drag/pointerDrag'` | reexport-all | `*` |  |
| `* from './features/viewport/useCanvasSize'` | reexport-all | `*` |  |
| `setupCanvasDpr` | reexport | `re-export from './features/viewport/pixelDensity'` |  |
| `useFixedPixelRatio` | reexport | `re-export from './features/viewport/pixelDensity'` |  |
| `SetupCanvasDprOptions` | reexport | `re-export from './features/viewport/pixelDensity'` |  |
| `* from './features/viewport/fitToBounds'` | reexport-all | `*` |  |
| `zoomAt` | reexport | `re-export from './features/viewport/zoomAt'` |  |
| `ZoomClampOpts` | reexport | `re-export from './features/viewport/zoomAt'` |  |
| `clampView` | reexport | `re-export from './features/viewport/clampView'` |  |
| `ClampBounds` | reexport | `re-export from './features/viewport/clampView'` |  |
| `CanvasSize` | reexport | `re-export from './features/viewport/clampView'` |  |
| `* from './features/viewport/useZoom'` | reexport-all | `*` |  |
| `* from './features/viewport/useAutoCenter'` | reexport-all | `*` |  |
| `useGridCellHover` | reexport | `re-export from './features/grid/useGridCellHover'` |  |
| `UseGridCellHoverOptions` | reexport | `re-export from './features/grid/useGridCellHover'` |  |
| `UseGridCellHoverReturn` | reexport | `re-export from './features/grid/useGridCellHover'` |  |
| `useKeybinding` | reexport | `re-export from './interactions/actions/useKeybinding'` |  |
| `isEditableTarget` | reexport | `re-export from './interactions/actions/useKeybinding'` |  |
| `KeyBinding` | reexport | `re-export from './interactions/actions/useKeybinding'` |  |
| `* from './features/viewport/wheelHandler'` | reexport-all | `*` |  |
| `clientToCanvas` | reexport | `re-export from './features/viewport/clientToCanvas'` |  |
| `usePointerGestures` | reexport | `re-export from './interactions/usePointerGestures'` |  |
| `* from './tools'` | reexport-all | `*` |  |
| `PointerGestureBindings` | reexport | `re-export from './interactions/usePointerGestures'` |  |
| `UsePointerGesturesOptions` | reexport | `re-export from './interactions/usePointerGestures'` |  |
| `PointerGestureCallbackCtx` | reexport | `re-export from './interactions/usePointerGestures'` |  |
| `Canvas` | reexport | `re-export from './canvas/Canvas'` |  |
| `SceneCanvas` | reexport | `re-export from './canvas/SceneCanvas'` |  |
| `SceneCanvasProps` | reexport | `re-export from './canvas/SceneCanvas'` |  |
| `sceneToAdapter` | reexport | `re-export from './canvas/sceneAdapter'` |  |
| `SceneCanvasAdapter` | reexport | `re-export from './canvas/sceneAdapter'` |  |
| `CanvasProps` | reexport | `re-export from './canvas/Canvas'` |  |
| `CanvasHelpers` | reexport | `re-export from './canvas/Canvas'` |  |
| `CanvasSelectionMode` | reexport | `re-export from './canvas/Canvas'` |  |
| `StandardSlotName` | reexport | `re-export from './canvas/Canvas'` |  |
| `CustomLayerEntry` | reexport | `re-export from './canvas/Canvas'` |  |
| `GridSlotConfig` | reexport | `re-export from './canvas/Canvas'` |  |
| `useSelection` | reexport | `re-export from './features/selection/useSelection'` |  |
| `SelectionApi` | reexport | `re-export from './features/selection/useSelection'` |  |
| `SelectionMode` | reexport | `re-export from './features/selection/useSelection'` |  |
| `SelectionExtendKey` | reexport | `re-export from './features/selection/useSelection'` |  |
| `UseSelectionOptions` | reexport | `re-export from './features/selection/useSelection'` |  |
| `* from './core/layers/render'` | reexport-all | `*` |  |
| `* from './core/layers/LayerRenderer'` | reexport-all | `*` |  |
| `createGridLayer` | reexport | `re-export from './features/grid/layer'` |  |
| `GridLayerOpts` | reexport | `re-export from './features/grid/layer'` |  |
| `createCellHighlightLayer` | reexport | `re-export from './features/grid/cellHighlight'` |  |
| `CellHighlightLayerOpts` | reexport | `re-export from './features/grid/cellHighlight'` |  |
| `createChildrenLayer` | reexport | `re-export from './features/groups/children'` |  |
| `CreateChildrenLayerOpts` | reexport | `re-export from './features/groups/children'` |  |
| `resolveUnit` | reexport | `re-export from './core/units'` |  |
| `formatUnit` | reexport | `re-export from './core/units'` |  |
| `IMPERIAL_INCHES` | reexport | `re-export from './core/units'` |  |
| `METRIC_MM` | reexport | `re-export from './core/units'` |  |
| `PIXELS` | reexport | `re-export from './core/units'` |  |
| `Unit` | reexport | `re-export from './core/units'` |  |
| `UnitSystem` | reexport | `re-export from './core/units'` |  |
| `UnitValue` | reexport | `re-export from './core/units'` |  |
| `composeSelectionPose` | reexport | `re-export from './features/selection/overlay'` |  |
| `createSelectionOutlineLayer` | reexport | `re-export from './features/selection/overlay'` |  |
| `createSelectionHandlesLayer` | reexport | `re-export from './features/selection/overlay'` |  |
| `createSelectionOverlayLayer` | reexport | `re-export from './features/selection/overlay'` |  |
| `ComposeSelectionPoseOpts` | reexport | `re-export from './features/selection/overlay'` |  |
| `SelectionOutlineLayerOpts` | reexport | `re-export from './features/selection/overlay'` |  |
| `SelectionHandlesLayerOpts` | reexport | `re-export from './features/selection/overlay'` |  |
| `SelectionOverlayLayerOpts` | reexport | `re-export from './features/selection/overlay'` |  |
| `* from './features/text/renderLabel'` | reexport-all | `*` |  |
| `* from './features/text/markdownText'` | reexport-all | `*` |  |
| `DEFAULT_TEXT_STYLE` | reexport | `re-export from './features/text/textStyle'` |  |
| `resolveTextStyle` | reexport | `re-export from './features/text/textStyle'` |  |
| `fontString` | reexport | `re-export from './features/text/textStyle'` |  |
| `TextStyle` | reexport | `re-export from './features/text/textStyle'` |  |
| `ResolvedTextStyle` | reexport | `re-export from './features/text/textStyle'` |  |
| `measureText` | reexport | `re-export from './features/text/measureText'` |  |
| `MeasuredText` | reexport | `re-export from './features/text/measureText'` |  |
| `createTextLayer` | reexport | `re-export from './features/text/textLayer'` |  |
| `TextPose` | reexport | `re-export from './features/text/textLayer'` |  |
| `CreateTextLayerOpts` | reexport | `re-export from './features/text/textLayer'` |  |
| `pointInTextPose` | reexport | `re-export from './features/text/hitTest'` |  |
| `caretIndexAt` | reexport | `re-export from './features/text/hitTest'` |  |
| `fitTextPose` | reexport | `re-export from './features/text/fitTextPose'` |  |
| `FitTextPoseOptions` | reexport | `re-export from './features/text/fitTextPose'` |  |
| `PointInTextPoseOpts` | reexport | `re-export from './features/text/hitTest'` |  |
| `useTextEdit` | reexport | `re-export from './features/text/useTextEdit'` |  |
| `TextEditScreenPose` | reexport | `re-export from './features/text/useTextEdit'` |  |
| `StartEditOptions` | reexport | `re-export from './features/text/useTextEdit'` |  |
| `UseTextEditOptions` | reexport | `re-export from './features/text/useTextEdit'` |  |
| `UseTextEditReturn` | reexport | `re-export from './features/text/useTextEdit'` |  |
| `createTilePattern` | reexport | `re-export from './features/patterns'` |  |
| `TilePatternOpts` | reexport | `re-export from './features/patterns'` |  |
| `applyPaint` | reexport | `re-export from './core/paint'` |  |
| `applyStroke` | reexport | `re-export from './core/paint'` |  |
| `renderFilledRegion` | reexport | `re-export from './core/paint'` |  |
| `Paint` | reexport | `re-export from './core/paint'` |  |
| `Stroke` | reexport | `re-export from './core/paint'` |  |
| `Region` | reexport | `re-export from './core/paint'` |  |
| `RenderFilledRegionOptions` | reexport | `re-export from './core/paint'` |  |
| `* from './core/ops'` | reexport-all | `*` |  |
| `composeWorldPose` | reexport | `re-export from './features/groups/composePose'` |  |
| `composeRectPose` | reexport | `re-export from './features/groups/composePose'` |  |
| `decomposeRectPose` | reexport | `re-export from './features/groups/composePose'` |  |
| `rebaseLocalPose` | reexport | `re-export from './features/groups/composePose'` |  |
| `translateRectPose` | reexport | `re-export from './features/groups/composePose'` |  |
| `worldPoseLookup` | reexport | `re-export from './features/groups/composePose'` |  |
| `PoseAdapter` | reexport | `re-export from './features/groups/composePose'` |  |
| `nestedGroupHitTester` | reexport | `re-export from './interactions/hit/nestedGroupHit'` |  |
| `NestedGroupHitOpts` | reexport | `re-export from './interactions/hit/nestedGroupHit'` |  |
| `NestedGroupHitTester` | reexport | `re-export from './interactions/hit/nestedGroupHit'` |  |
| `PATH_M` | reexport | `re-export from './features/paths'` |  |
| `PATH_L` | reexport | `re-export from './features/paths'` |  |
| `PATH_C` | reexport | `re-export from './features/paths'` |  |
| `PATH_Q` | reexport | `re-export from './features/paths'` |  |
| `PATH_Z` | reexport | `re-export from './features/paths'` |  |
| `PATH_CMD_LENGTHS` | reexport | `re-export from './features/paths'` |  |
| `PathBuilder` | reexport | `re-export from './features/paths'` |  |
| `polygonFromPoints` | reexport | `re-export from './features/paths'` |  |
| `rectPath` | reexport | `re-export from './features/paths'` |  |
| `boundsOfPath` | reexport | `re-export from './features/paths'` |  |
| `pointInPath` | reexport | `re-export from './features/paths'` |  |
| `translatePath` | reexport | `re-export from './features/paths'` |  |
| `translatePolygonInPlace` | reexport | `re-export from './features/paths'` |  |
| `scalePathToBounds` | reexport | `re-export from './features/paths'` |  |
| `traceToContext` | reexport | `re-export from './features/paths'` |  |
| `createPathLayer` | reexport | `re-export from './features/paths'` |  |
| `flattenCubic` | reexport | `re-export from './features/paths'` |  |
| `flattenQuadratic` | reexport | `re-export from './features/paths'` |  |
| `DEFAULT_FLATTEN_TOLERANCE` | reexport | `re-export from './features/paths'` |  |
| `composePath` | reexport | `re-export from './features/paths'` |  |
| `decomposePath` | reexport | `re-export from './features/paths'` |  |
| `unionBoundsPath` | reexport | `re-export from './features/paths'` |  |
| `pathPoseDescriptor` | reexport | `re-export from './features/paths'` |  |
| `pathOriginProjection` | reexport | `re-export from './features/paths'` |  |
| `createPenPreviewLayer` | reexport | `re-export from './features/paths'` |  |
| `Path` | reexport | `re-export from './features/paths'` |  |
| `PolygonPath` | reexport | `re-export from './features/paths'` |  |
| `RectPath` | reexport | `re-export from './features/paths'` |  |
| `PathFillRule` | reexport | `re-export from './features/paths'` |  |
| `PointInPathOptions` | reexport | `re-export from './features/paths'` |  |
| `CreatePathLayerOpts` | reexport | `re-export from './features/paths'` |  |
| `CreatePenPreviewLayerOptions` | reexport | `re-export from './features/paths'` |  |
| `PenPreviewStyle` | reexport | `re-export from './features/paths'` |  |
| `constrainTo45` | reexport | `re-export from './util/constrainTo45'` |  |
| `Group` | reexport | `re-export from './features/groups/types'` |  |
| `GroupAdapter` | reexport | `re-export from './features/groups/types'` |  |
| `resolveToOutermostGroup` | reexport | `re-export from './features/groups/resolve'` |  |
| `expandToLeaves` | reexport | `re-export from './features/groups/resolve'` |  |
| `unionBounds` | reexport | `re-export from './features/groups/unionBounds'` |  |
| `RectPose` | reexport | `re-export from './features/groups/unionBounds'` |  |
| `withGroupOrdering` | reexport | `re-export from './features/groups/orderedGroups'` |  |
| `* from './core/history'` | reexport-all | `*` |  |
| `* from './core/adapters/types'` | reexport-all | `*` |  |
| `arrayAdapter` | reexport | `re-export from './core/adapters/arrayAdapter'` |  |
| `ArrayAdapter` | reexport | `re-export from './core/adapters/arrayAdapter'` |  |
| `ArrayAdapterConfig` | reexport | `re-export from './core/adapters/arrayAdapter'` |  |
| `useArrayAdapter` | reexport | `re-export from './core/adapters/useArrayAdapter'` |  |
| `UseArrayAdapterOptions` | reexport | `re-export from './core/adapters/useArrayAdapter'` |  |
| `createScene` | reexport | `re-export from './core/scene'` |  |
| `useScene` | reexport | `re-export from './core/scene'` |  |
| `asNodeId` | reexport | `re-export from './core/scene'` |  |
| `AddNodeSpec` | reexport | `re-export from './core/scene'` |  |
| `ContainerNode` | reexport | `re-export from './core/scene'` |  |
| `LayerRecord` | reexport | `re-export from './core/scene'` |  |
| `LeafNode` | reexport | `re-export from './core/scene'` |  |
| `SceneNode` | reexport | `re-export from './core/scene'` |  |
| `NodeId` | reexport | `re-export from './core/scene'` |  |
| `RegisteredOp` | reexport | `re-export from './core/scene'` |  |
| `Scene` | reexport | `re-export from './core/scene'` |  |
| `SystemLayerRecord` | reexport | `re-export from './core/scene'` |  |
| `SystemLayerSpec` | reexport | `re-export from './core/scene'` |  |
| `UserLayerRecord` | reexport | `re-export from './core/scene'` |  |
| `UseSceneOptions` | reexport | `re-export from './core/scene'` |  |
| `ModifierState` | reexport | `re-export from './interactions/gestures/types'` |  |
| `PointerState` | reexport | `re-export from './interactions/gestures/types'` |  |
| `GestureContext` | reexport | `re-export from './interactions/gestures/types'` |  |
| `SnapStrategy` | reexport | `re-export from './interactions/gestures/types'` |  |
| `GestureBehavior` | reexport | `re-export from './interactions/gestures/types'` |  |
| `BehaviorMoveResult` | reexport | `re-export from './interactions/gestures/types'` |  |
| `MoveBehavior` | reexport | `re-export from './interactions/gestures/types'` |  |
| `MoveOverlay` | reexport | `re-export from './interactions/gestures/types'` |  |
| `ResizeAnchor` | reexport | `re-export from './interactions/gestures/types'` |  |
| `ResizePose` | reexport | `re-export from './interactions/gestures/types'` |  |
| `ResizeProposed` | reexport | `re-export from './interactions/gestures/types'` |  |
| `ResizeMoveResult` | reexport | `re-export from './interactions/gestures/types'` |  |
| `ResizeBehavior` | reexport | `re-export from './interactions/gestures/types'` |  |
| `ResizeOverlay` | reexport | `re-export from './interactions/gestures/types'` |  |
| `RotatedPose` | reexport | `re-export from './interactions/gestures/types'` |  |
| `RotateProposed` | reexport | `re-export from './interactions/gestures/types'` |  |
| `RotateMoveResult` | reexport | `re-export from './interactions/gestures/types'` |  |
| `RotateBehavior` | reexport | `re-export from './interactions/gestures/types'` |  |
| `RotateOverlay` | reexport | `re-export from './interactions/gestures/types'` |  |
| `InsertProposed` | reexport | `re-export from './interactions/gestures/types'` |  |
| `InsertMoveResult` | reexport | `re-export from './interactions/gestures/types'` |  |
| `InsertBehavior` | reexport | `re-export from './interactions/gestures/types'` |  |
| `InsertOverlay` | reexport | `re-export from './interactions/gestures/types'` |  |
| `AreaSelectPose` | reexport | `re-export from './interactions/gestures/types'` |  |
| `AreaSelectProposed` | reexport | `re-export from './interactions/gestures/types'` |  |
| `AreaSelectMoveResult` | reexport | `re-export from './interactions/gestures/types'` |  |
| `AreaSelectBehavior` | reexport | `re-export from './interactions/gestures/types'` |  |
| `AreaSelectOverlay` | reexport | `re-export from './interactions/gestures/types'` |  |
| `ClipboardSnapshot` | reexport | `re-export from './interactions/actions/clipboard/types'` |  |
| `snap` | reexport | `re-export from './interactions/gestures/shared'` |  |
| `gridSnapStrategy` | reexport | `re-export from './interactions/gestures/shared'` |  |
| `pointToGridCell` | reexport | `re-export from './interactions/gestures/shared'` |  |
| `RECT_ORIGIN_PROJECTION` | reexport | `re-export from './interactions/gestures/shared'` |  |
| `OriginProjection` | reexport | `re-export from './interactions/gestures/shared'` |  |
| `useMove` | reexport | `re-export from './interactions/gestures/move'` |  |
| `UseMoveOptions` | reexport | `re-export from './interactions/gestures/move'` |  |
| `MoveController` | reexport | `re-export from './interactions/gestures/move'` |  |
| `MoveStartArgs` | reexport | `re-export from './interactions/gestures/move'` |  |
| `MoveMoveArgs` | reexport | `re-export from './interactions/gestures/move'` |  |
| `useResize` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `RECT_POSE_DESCRIPTOR` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `cornerResizeHandles` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `hitCornerHandle` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `UseResizeOptions` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `ResizeController` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `PoseDescriptor` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `CornerHandle` | reexport | `re-export from './interactions/gestures/resize'` |  |
| `useRotate` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `pointInRotatedRect` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `rotatedRectCorners` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `rectCorners` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `rotatePoint` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `aabbCenter` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `rotationHandle` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `hitRotationHandle` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `DEFAULT_ROTATION_HANDLE_DISTANCE` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `UseRotateOptions` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `RotateController` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `RotateStartArgs` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `RotateMoveArgs` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `RotateGeometry` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `RotationHandle` | reexport | `re-export from './interactions/gestures/rotate'` |  |
| `useInsert` | reexport | `re-export from './interactions/gestures/insert'` |  |
| `UseInsertOptions` | reexport | `re-export from './interactions/gestures/insert'` |  |
| `InsertController` | reexport | `re-export from './interactions/gestures/insert'` |  |
| `useAreaSelect` | reexport | `re-export from './interactions/gestures/area-select'` |  |
| `useEditAnchors` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `hitAnchor` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `enumerateAnchors` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `withCoord` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `createAnchorEditOverlayLayer` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `UseEditAnchorsOptions` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `EditAnchorsController` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `EditAnchorsAdapter` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `EditAnchorsOverlay` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `EditAnchorsStartArgs` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `EditAnchorsMoveArgs` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `AnchorHit` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `PathAnchor` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `AnchorEditOverlayOpts` | reexport | `re-export from './interactions/gestures/edit-anchors'` |  |
| `UseAreaSelectOptions` | reexport | `re-export from './interactions/gestures/area-select'` |  |
| `AreaSelectController` | reexport | `re-export from './interactions/gestures/area-select'` |  |
| `selectFromMarquee` | reexport | `re-export from './interactions/gestures/area-select/behaviors'` |  |
| `useClipboardOps` | reexport | `re-export from './interactions/actions/clipboard'` |  |
| `useClipboard` | reexport | `re-export from './interactions/actions/clipboard'` |  |
| `UseClipboardOpsOptions` | reexport | `re-export from './interactions/actions/clipboard'` |  |
| `UseClipboardOpsReturn` | reexport | `re-export from './interactions/actions/clipboard'` |  |
| `ClipboardAdapter` | reexport | `re-export from './interactions/actions/clipboard'` |  |
| `UseClipboardOptions` | reexport | `re-export from './interactions/actions/clipboard'` |  |
| `UseClipboardReturn` | reexport | `re-export from './interactions/actions/clipboard'` |  |
| `useDelete` | reexport | `re-export from './interactions/actions/delete'` |  |
| `DeleteAdapter` | reexport | `re-export from './interactions/actions/delete'` |  |
| `UseDeleteOptions` | reexport | `re-export from './interactions/actions/delete'` |  |
| `UseDeleteReturn` | reexport | `re-export from './interactions/actions/delete'` |  |
| `useEscape` | reexport | `re-export from './interactions/actions/escape'` |  |
| `EscapeAdapter` | reexport | `re-export from './interactions/actions/escape'` |  |
| `UseEscapeOptions` | reexport | `re-export from './interactions/actions/escape'` |  |
| `UseEscapeReturn` | reexport | `re-export from './interactions/actions/escape'` |  |
| `useSelectAll` | reexport | `re-export from './interactions/actions/select-all'` |  |
| `SelectAllAdapter` | reexport | `re-export from './interactions/actions/select-all'` |  |
| `UseSelectAllOptions` | reexport | `re-export from './interactions/actions/select-all'` |  |
| `UseSelectAllReturn` | reexport | `re-export from './interactions/actions/select-all'` |  |
| `useDuplicate` | reexport | `re-export from './interactions/actions/duplicate'` |  |
| `DuplicateAdapter` | reexport | `re-export from './interactions/actions/duplicate'` |  |
| `UseDuplicateOptions` | reexport | `re-export from './interactions/actions/duplicate'` |  |
| `UseDuplicateReturn` | reexport | `re-export from './interactions/actions/duplicate'` |  |
| `useNudge` | reexport | `re-export from './interactions/actions/nudge'` |  |
| `NudgeAdapter` | reexport | `re-export from './interactions/actions/nudge'` |  |
| `NudgeDirection` | reexport | `re-export from './interactions/actions/nudge'` |  |
| `UseNudgeOptions` | reexport | `re-export from './interactions/actions/nudge'` |  |
| `UseNudgeReturn` | reexport | `re-export from './interactions/actions/nudge'` |  |
| `useClone` | reexport | `re-export from './interactions/gestures/clone'` |  |
| `cloneByAltDrag` | reexport | `re-export from './interactions/gestures/clone'` |  |
| `UseCloneOptions` | reexport | `re-export from './interactions/gestures/clone'` |  |
| `UseCloneReturn` | reexport | `re-export from './interactions/gestures/clone'` |  |
| `ClonePose` | reexport | `re-export from './interactions/gestures/types'` |  |
| `CloneLayer` | reexport | `re-export from './interactions/gestures/types'` |  |
| `CloneBehavior` | reexport | `re-export from './interactions/gestures/types'` |  |
| `createBringForwardOp` | reexport | `re-export from './core/ops/reorder'` |  |
| `createSendBackwardOp` | reexport | `re-export from './core/ops/reorder'` |  |
| `createBringToFrontOp` | reexport | `re-export from './core/ops/reorder'` |  |
| `createSendToBackOp` | reexport | `re-export from './core/ops/reorder'` |  |
| `createMoveToIndexOp` | reexport | `re-export from './core/ops/reorder'` |  |
| `useReorder` | reexport | `re-export from './interactions/actions/reorder'` |  |
| `ReorderAdapter` | reexport | `re-export from './interactions/actions/reorder'` |  |
| `UseReorderOptions` | reexport | `re-export from './interactions/actions/reorder'` |  |
| `UseReorderReturn` | reexport | `re-export from './interactions/actions/reorder'` |  |
| `useGroup` | reexport | `re-export from './interactions/actions/group'` |  |
| `useUngroup` | reexport | `re-export from './interactions/actions/group'` |  |
| `useNestedGroup` | reexport | `re-export from './interactions/actions/group'` |  |
| `useNestedUngroup` | reexport | `re-export from './interactions/actions/group'` |  |
| `GroupActionAdapter` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseGroupOptions` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseGroupReturn` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseUngroupOptions` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseUngroupReturn` | reexport | `re-export from './interactions/actions/group'` |  |
| `NestedGroupActionAdapter` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseNestedGroupOptions` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseNestedGroupReturn` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseNestedUngroupOptions` | reexport | `re-export from './interactions/actions/group'` |  |
| `UseNestedUngroupReturn` | reexport | `re-export from './interactions/actions/group'` |  |
| `useUndoRedo` | reexport | `re-export from './interactions/actions/undo-redo'` |  |
| `UndoRedoAdapter` | reexport | `re-export from './interactions/actions/undo-redo'` |  |
| `UseUndoRedoOptions` | reexport | `re-export from './interactions/actions/undo-redo'` |  |
| `UseUndoRedoReturn` | reexport | `re-export from './interactions/actions/undo-redo'` |  |
| `* from './debug'` | reexport-all | `*` |  |
| `* from './animation'` | reexport-all | `*` |  |
| `* from './layout'` | reexport-all | `*` |  |

## src/interactions/actions/clipboard/clipboard.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ClipboardAdapter` | interface | `{ getNode, removeNode }` | Adapter for `useClipboard`. |
| `ClipboardAdapter.getNode?` | field | `TNode \| undefined` | Capture the full object for `cut` so undo can re-insert it intact. |
| `ClipboardAdapter.removeNode` | field | `void` | Mutator wired by `DeleteOp.apply`. |
| `UseClipboardOptions` | interface | `{ getSelection, bindKeyboard, cutLabel, pasteLabel, onPaste }` | Options for `useClipboard`. |
| `UseClipboardOptions.getSelection` | field | `() => string[]` | Reads the current selection. |
| `UseClipboardOptions.bindKeyboard?` | field | `boolean` | Auto-bind Mod+C / Mod+X / Mod+V on document. |
| `UseClipboardOptions.cutLabel?` | field | `string` | Label for the cut batch. |
| `UseClipboardOptions.pasteLabel?` | field | `string` | Label for the paste batch. |
| `UseClipboardOptions.onPaste?` | field | `(newIds: string[]) => void` | Called after a successful paste with the ids of the new objects. |
| `UseClipboardReturn` | interface | `{ cut }` | Return shape of `useClipboard`. |
| `UseClipboardReturn.cut` | field | `string[]` | Snapshot the selection into the clipboard, then delete the originals. |
| `useClipboard` | hook | `(adapter: ClipboardAdapter<TNode>, options: UseClipboardOptions) => UseClipboardReturn` | Selection-driven copy / cut / paste with optional Mod+C, Mod+X, Mod+V keyboard bindings. |
| `useClipboard.adapter` | param | `adapter: ClipboardAdapter<TNode>` |  |
| `useClipboard.options` | param | `options: UseClipboardOptions` |  |

## src/interactions/actions/clipboard/clipboardOps.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseClipboardOpsOptions` | interface | `{ getSelection, onPaste, pasteLabel }` | Options for `useClipboardOps`. |
| `UseClipboardOpsOptions.getSelection` | field | `() => string[]` | How the hook reads "current selection" for copy. |
| `UseClipboardOpsOptions.onPaste?` | field | `(newIds: string[]) => void` | Called after a successful paste with the ids of the newly inserted objects. |
| `UseClipboardOpsOptions.pasteLabel?` | field | `string` | Label for the history entry produced by paste. |
| `UseClipboardOpsReturn` | interface | `{ copy, paste, isEmpty }` | Return shape of `useClipboardOps`: imperative `copy`, `paste`, and `isEmpty` functions. |
| `UseClipboardOpsReturn.copy` | field | `void` |  |
| `UseClipboardOpsReturn.paste` | field | `void` |  |
| `UseClipboardOpsReturn.isEmpty` | field | `boolean` |  |
| `useClipboardOps` | hook | `(adapter: InsertAdapter<TNode>, options: UseClipboardOpsOptions) => UseClipboardOpsReturn` | In-memory copy/paste of selections via `InsertAdapter.snapshotSelection` / `commitPaste`. |
| `useClipboardOps.adapter` | param | `adapter: InsertAdapter<TNode>` |  |
| `useClipboardOps.options` | param | `options: UseClipboardOpsOptions` |  |

## src/interactions/actions/clipboard/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useClipboardOps` | reexport | `re-export from './clipboardOps'` |  |
| `UseClipboardOpsOptions` | reexport | `re-export from './clipboardOps'` |  |
| `UseClipboardOpsReturn` | reexport | `re-export from './clipboardOps'` |  |
| `useClipboard` | reexport | `re-export from './clipboard'` |  |
| `ClipboardAdapter` | reexport | `re-export from './clipboard'` |  |
| `UseClipboardOptions` | reexport | `re-export from './clipboard'` |  |
| `UseClipboardReturn` | reexport | `re-export from './clipboard'` |  |

## src/interactions/actions/clipboard/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ClipboardSnapshot` | reexport | `re-export from '../../../core/adapters/types'` |  |

## src/interactions/actions/delete/delete.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DeleteAdapter` | interface | `{ getSelection, getNode, applyBatch, setSelection, removeNode }` | Adapter for `useDelete`. |
| `DeleteAdapter.getSelection` | field | `string[]` | Read current selection. |
| `DeleteAdapter.getNode?` | field | `{ id: string } \| undefined \| null` | Optional: provide the object for a given id; required by `createDeleteOp` to capture the object for invert/insert. |
| `DeleteAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `DeleteAdapter.setSelection?` | field | `void` | Optional: clear selection after delete. |
| `DeleteAdapter.removeNode?` | field | `void` | Optional: removeNode mutator wired by DeleteOp when applyBatch is omitted. |
| `UseDeleteOptions` | interface | `{ bindKeyboard, label, filter }` | Options for `useDelete`. |
| `UseDeleteOptions.bindKeyboard?` | field | `boolean` | Auto-bind Delete and Backspace keys on document. |
| `UseDeleteOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseDeleteOptions.filter?` | field | `(ids: string[]) => string[]` | Optional filter: given selected ids, return the subset to actually delete. |
| `UseDeleteReturn` | interface | `{ deleteSelection }` | Return shape of `useDelete`. |
| `UseDeleteReturn.deleteSelection` | field | `string[]` | Imperative trigger — deletes the current selection. |
| `useDelete` | hook | `(adapter: DeleteAdapter, options: UseDeleteOptions = {}) => UseDeleteReturn` | Selection-deletion action; optionally binds Delete/Backspace keys. |
| `useDelete.adapter` | param | `adapter: DeleteAdapter` |  |
| `useDelete.options` | param | `options: UseDeleteOptions = {}` |  |

## src/interactions/actions/delete/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useDelete` | reexport | `re-export from './delete'` |  |
| `DeleteAdapter` | reexport | `re-export from './delete'` |  |
| `UseDeleteOptions` | reexport | `re-export from './delete'` |  |
| `UseDeleteReturn` | reexport | `re-export from './delete'` |  |

## src/interactions/actions/duplicate/duplicate.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DuplicateAdapter` | interface | `{ getSelection, getPose, cloneNode, applyBatch }` | Adapter for `useDuplicate`. |
| `DuplicateAdapter.getSelection` | field | `string[]` | Read current selection. |
| `DuplicateAdapter.getPose` | field | `TPose` | Read pose for an id (currently unused at op-emit time but exposed for symmetry with other selection-driven hooks; consumers commonly need it inside `cloneNode |
| `DuplicateAdapter.cloneNode` | field | `{ id: string }` | Materialize a new object that is a copy of `id`, translated by `offset`. |
| `DuplicateAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `UseDuplicateOptions` | interface | `{ enableKeyboard, label, offset }` | Options for `useDuplicate`. |
| `UseDuplicateOptions.enableKeyboard?` | field | `boolean` | Auto-bind Ctrl/Cmd+D on document. |
| `UseDuplicateOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseDuplicateOptions.offset?` | field | `{ dx: number; dy: number }` | Translation applied to each clone. |
| `UseDuplicateReturn` | interface | `{ duplicate }` | Return shape of `useDuplicate`. |
| `UseDuplicateReturn.duplicate` | field | `void` | Imperative trigger — duplicates the current selection. |
| `useDuplicate` | hook | `(adapter: DuplicateAdapter<TPose>, options: UseDuplicateOptions = {}) => UseDuplicateReturn` | Selection-duplication action with offset; binds Ctrl/Cmd+D by default. |
| `useDuplicate.adapter` | param | `adapter: DuplicateAdapter<TPose>` |  |
| `useDuplicate.options` | param | `options: UseDuplicateOptions = {}` |  |

## src/interactions/actions/duplicate/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useDuplicate` | reexport | `re-export from './duplicate'` |  |
| `DuplicateAdapter` | reexport | `re-export from './duplicate'` |  |
| `UseDuplicateOptions` | reexport | `re-export from './duplicate'` |  |
| `UseDuplicateReturn` | reexport | `re-export from './duplicate'` |  |

## src/interactions/actions/escape/escape.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `EscapeAdapter` | interface | `{ getSelection, applyBatch, setSelection }` | Adapter for `useEscape`. |
| `EscapeAdapter.getSelection` | field | `string[]` | Read current selection. |
| `EscapeAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `EscapeAdapter.setSelection?` | field | `void` | Mutator wired by `setSelection` op when `applyBatch` is omitted. |
| `UseEscapeOptions` | interface | `{ enableKeyboard, label }` | Options for `useEscape`. |
| `UseEscapeOptions.enableKeyboard?` | field | `boolean` | Auto-bind Escape on document. |
| `UseEscapeOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseEscapeReturn` | interface | `{ clearSelection }` | Return shape of `useEscape`. |
| `UseEscapeReturn.clearSelection` | field | `void` | Imperative trigger — clears the current selection. |
| `useEscape` | hook | `(adapter: EscapeAdapter, options: UseEscapeOptions = {}) => UseEscapeReturn` | Selection-clearing action; binds Escape on document by default. |
| `useEscape.adapter` | param | `adapter: EscapeAdapter` |  |
| `useEscape.options` | param | `options: UseEscapeOptions = {}` |  |

## src/interactions/actions/escape/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useEscape` | reexport | `re-export from './escape'` |  |
| `EscapeAdapter` | reexport | `re-export from './escape'` |  |
| `UseEscapeOptions` | reexport | `re-export from './escape'` |  |
| `UseEscapeReturn` | reexport | `re-export from './escape'` |  |

## src/interactions/actions/group/group.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `GroupActionAdapter` | interface | `{ getSelection, applyBatch }` | Adapter for `useGroup` / `useUngroup`. |
| `GroupActionAdapter.getSelection` | field | `string[]` | Read current selection. |
| `GroupActionAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `UseGroupOptions` | interface | `{ bindKeyboard, newGroupId, label, minMembers }` | Options for `useGroup`. |
| `UseGroupOptions.bindKeyboard?` | field | `boolean` | Auto-bind Mod+G on document. |
| `UseGroupOptions.newGroupId?` | field | `() => string` | Mint the id for the new group. |
| `UseGroupOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseGroupOptions.minMembers?` | field | `number` | Minimum selection size that produces a group. |
| `UseGroupReturn` | interface | `{ group }` | Return shape of `useGroup`. |
| `UseGroupReturn.group` | field | `string \| null` | Imperative trigger — wraps the current selection in a new group, then selects that group. |
| `useGroup` | hook | `(adapter: GroupActionAdapter, options: UseGroupOptions = {}) => UseGroupReturn` | Selection-grouping action; optionally binds Mod+G. |
| `useGroup.adapter` | param | `adapter: GroupActionAdapter` |  |
| `useGroup.options` | param | `options: UseGroupOptions = {}` |  |
| `UseUngroupOptions` | interface | `{ bindKeyboard, label }` | Options for `useUngroup`. |
| `UseUngroupOptions.bindKeyboard?` | field | `boolean` | Auto-bind Mod+Shift+G on document. |
| `UseUngroupOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseUngroupReturn` | interface | `{ ungroup }` | Return shape of `useUngroup`. |
| `UseUngroupReturn.ungroup` | field | `string[]` | Imperative trigger — dissolves every group in the current selection. |
| `useUngroup` | hook | `(adapter: GroupActionAdapter, options: UseUngroupOptions = {}) => UseUngroupReturn` | Selection-ungrouping action; optionally binds Mod+Shift+G. |
| `useUngroup.adapter` | param | `adapter: GroupActionAdapter` |  |
| `useUngroup.options` | param | `options: UseUngroupOptions = {}` |  |

## src/interactions/actions/group/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useGroup` | reexport | `re-export from './group'` |  |
| `useUngroup` | reexport | `re-export from './group'` |  |
| `GroupActionAdapter` | reexport | `re-export from './group'` |  |
| `UseGroupOptions` | reexport | `re-export from './group'` |  |
| `UseGroupReturn` | reexport | `re-export from './group'` |  |
| `UseUngroupOptions` | reexport | `re-export from './group'` |  |
| `UseUngroupReturn` | reexport | `re-export from './group'` |  |
| `useNestedGroup` | reexport | `re-export from './nestedGroup'` |  |
| `useNestedUngroup` | reexport | `re-export from './nestedGroup'` |  |
| `NestedGroupActionAdapter` | reexport | `re-export from './nestedGroup'` |  |
| `UseNestedGroupOptions` | reexport | `re-export from './nestedGroup'` |  |
| `UseNestedGroupReturn` | reexport | `re-export from './nestedGroup'` |  |
| `UseNestedUngroupOptions` | reexport | `re-export from './nestedGroup'` |  |
| `UseNestedUngroupReturn` | reexport | `re-export from './nestedGroup'` |  |

## src/interactions/actions/group/nestedGroup.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `NestedGroupActionAdapter` | interface | `{ getSelection, getNode, getChildren, applyBatch }` | Adapter for `useNestedGroup` / `useNestedUngroup`. |
| `NestedGroupActionAdapter.getSelection` | field | `string[]` | Read current selection. |
| `NestedGroupActionAdapter.getNode` | field | `TNode \| undefined` | Look up an existing scene object — used by ungroup to recover the group object so the dissolve op can invert into a re-insert. |
| `NestedGroupActionAdapter.getChildren` | field | `string[]` | Enumerate direct children of `id` (`null` = root siblings). |
| `NestedGroupActionAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `UseNestedGroupOptions` | interface | `{ groupFactory, composePose, decomposePose, groupPoseFromChildren, bindKeyboard, newGroupId, label, minMembers }` | Options for `useNestedGroup`. |
| `UseNestedGroupOptions.groupFactory` | field | `(args: { id: string; localPose: TPose; childIds: string[] }) => TNode` | Mint the new group scene object. |
| `UseNestedGroupOptions.composePose` | field | `(parent: TPose, child: TPose) => TPose` | Compose a parent local + child local into the equivalent pose one frame up. |
| `UseNestedGroupOptions.decomposePose` | field | `(parent: TPose, world: TPose) => TPose` | Inverse of `composePose`: recover a child's local from its world pose given the parent's world pose. |
| `UseNestedGroupOptions.groupPoseFromChildren?` | field | `(childWorldPoses: TPose[]) => TPose` | Compute the group's local pose given the world poses of its children. |
| `UseNestedGroupOptions.bindKeyboard?` | field | `boolean` | Auto-bind Mod+G on document. |
| `UseNestedGroupOptions.newGroupId?` | field | `() => string` | Mint the id for the new group. |
| `UseNestedGroupOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseNestedGroupOptions.minMembers?` | field | `number` | Minimum selection size that produces a group. |
| `UseNestedGroupReturn` | interface | `{ group }` | Return shape of `useNestedGroup`. |
| `UseNestedGroupReturn.group` | field | `string \| null` | Imperative trigger — reparents the current selection under a newly inserted group object, rebasing each child's local pose so its visual world position is prese |
| `useNestedGroup` | hook | `(adapter: NestedGroupActionAdapter<TNode, TPose>, options: UseNestedGroupOptions<TNode, TPose>) => UseNestedGroupReturn` | Selection-grouping action that inserts a real scene-graph parent and reparents the selection under it. |
| `useNestedGroup.adapter` | param | `adapter: NestedGroupActionAdapter<TNode, TPose>` |  |
| `useNestedGroup.options` | param | `options: UseNestedGroupOptions<TNode, TPose>` |  |
| `UseNestedUngroupOptions` | interface | `{ composePose, decomposePose, bindKeyboard, label, isGroup }` | Options for `useNestedUngroup`. |
| `UseNestedUngroupOptions.composePose` | field | `(parent: TPose, child: TPose) => TPose` | Compose a parent local + child local into the next-frame-up pose. |
| `UseNestedUngroupOptions.decomposePose` | field | `(parent: TPose, world: TPose) => TPose` | Inverse of `composePose`. |
| `UseNestedUngroupOptions.bindKeyboard?` | field | `boolean` | Auto-bind Mod+Shift+G on document. |
| `UseNestedUngroupOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseNestedUngroupOptions.isGroup?` | field | `(id: string, object: TNode \| undefined) => boolean` | Predicate: should this id be treated as a nested group (i.e. |
| `UseNestedUngroupReturn` | interface | `{ ungroup }` | Return shape of `useNestedUngroup`. |
| `UseNestedUngroupReturn.ungroup` | field | `string[]` | Imperative trigger — for every group in the current selection, reparents its children to the grandparent (rebasing each local pose so visual world positions are |
| `useNestedUngroup` | hook | `(adapter: NestedGroupActionAdapter<TNode, TPose>, options: UseNestedUngroupOptions<TNode, TPose>) => UseNestedUngroupReturn` | Selection-ungrouping action; optionally binds Mod+Shift+G. |
| `useNestedUngroup.adapter` | param | `adapter: NestedGroupActionAdapter<TNode, TPose>` |  |
| `useNestedUngroup.options` | param | `options: UseNestedUngroupOptions<TNode, TPose>` |  |

## src/interactions/actions/nudge/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useNudge` | reexport | `re-export from './nudge'` |  |
| `NudgeAdapter` | reexport | `re-export from './nudge'` |  |
| `NudgeDirection` | reexport | `re-export from './nudge'` |  |
| `UseNudgeOptions` | reexport | `re-export from './nudge'` |  |
| `UseNudgeReturn` | reexport | `re-export from './nudge'` |  |

## src/interactions/actions/nudge/nudge.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `NudgeDirection` | type | `'up' \| 'down' \| 'left' \| 'right'` | Cardinal direction for `useNudge`. |
| `NudgeAdapter` | interface | `{ getSelection, getPose, applyBatch }` | Adapter for `useNudge`. |
| `NudgeAdapter.getSelection` | field | `string[]` | Read current selection. |
| `NudgeAdapter.getPose` | field | `TPose` | Read pose for an id; used as `from` for the transform op. |
| `NudgeAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `UseNudgeOptions` | interface | `{ translatePose, enableKeyboard, label, step, shiftStep }` | Options for `useNudge`. |
| `UseNudgeOptions.translatePose?` | field | `(pose: TPose, dx: number, dy: number) => TPose` | How to apply a `(dx, dy)` translation to a pose. |
| `UseNudgeOptions.enableKeyboard?` | field | `boolean` | Auto-bind arrow keys on document. |
| `UseNudgeOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseNudgeOptions.step?` | field | `number` | Base step in world units. |
| `UseNudgeOptions.shiftStep?` | field | `number` | Step used when shift held. |
| `UseNudgeReturn` | interface | `{ nudge }` | Return shape of `useNudge`. |
| `UseNudgeReturn.nudge` | field | `void` | Imperative trigger. |
| `useNudge` | hook | `(adapter: NudgeAdapter<TPose>, options: UseNudgeOptions<TPose> = {}) => UseNudgeReturn` | Arrow-key nudge action; binds arrow keys (with optional shift modifier for larger step) by default. |
| `useNudge.adapter` | param | `adapter: NudgeAdapter<TPose>` |  |
| `useNudge.options` | param | `options: UseNudgeOptions<TPose> = {}` |  |

## src/interactions/actions/reorder/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useReorder` | reexport | `re-export from './reorder'` |  |
| `ReorderAdapter` | reexport | `re-export from './reorder'` |  |
| `UseReorderOptions` | reexport | `re-export from './reorder'` |  |
| `UseReorderReturn` | reexport | `re-export from './reorder'` |  |

## src/interactions/actions/reorder/reorder.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ReorderAdapter` | interface | `{ getSelection, getParent, getChildren, setChildOrder, applyBatch }` | Adapter for `useReorder`; both order methods optional and the hook no-ops when either is absent. |
| `ReorderAdapter.getSelection` | field | `string[]` |  |
| `ReorderAdapter.getParent` | field | `string \| null` |  |
| `ReorderAdapter.getChildren?` | field | `string[]` | Optional — when absent, every reorder method is a silent no-op. |
| `ReorderAdapter.setChildOrder?` | field | `void` | Optional — when absent, every reorder method is a silent no-op. |
| `ReorderAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `UseReorderOptions` | interface | `{ enableKeyboard, filter }` | Options for `useReorder`. |
| `UseReorderOptions.enableKeyboard?` | field | `boolean` | Auto-bind Mod+] / Mod+[ (with optional Shift for to-front/to-back) on document. |
| `UseReorderOptions.filter?` | field | `(ids: string[]) => string[]` | Optional filter — given selected ids, return the subset to reorder. |
| `UseReorderReturn` | interface | `{ bringForward, sendBackward, bringToFront, sendToBack }` | Return shape of `useReorder`: imperative bring/send methods. |
| `UseReorderReturn.bringForward` | field | `void` |  |
| `UseReorderReturn.sendBackward` | field | `void` |  |
| `UseReorderReturn.bringToFront` | field | `void` |  |
| `UseReorderReturn.sendToBack` | field | `void` |  |
| `useReorder` | hook | `(adapter: ReorderAdapter, options: UseReorderOptions = {}) => UseReorderReturn` | Sibling z-order action; binds Mod+] / Mod+[ (forward/backward) and Shift-modified variants (front/back) by default. |
| `useReorder.adapter` | param | `adapter: ReorderAdapter` |  |
| `useReorder.options` | param | `options: UseReorderOptions = {}` |  |

## src/interactions/actions/select-all/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useSelectAll` | reexport | `re-export from './select-all'` |  |
| `SelectAllAdapter` | reexport | `re-export from './select-all'` |  |
| `UseSelectAllOptions` | reexport | `re-export from './select-all'` |  |
| `UseSelectAllReturn` | reexport | `re-export from './select-all'` |  |

## src/interactions/actions/select-all/select-all.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `SelectAllAdapter` | interface | `{ getSelection, listAll, applyBatch, setSelection }` | Adapter for `useSelectAll`. |
| `SelectAllAdapter.getSelection` | field | `string[]` | Read current selection (used as `from` for the setSelection op). |
| `SelectAllAdapter.listAll` | field | `string[]` | Return all selectable ids. |
| `SelectAllAdapter.applyBatch?` | field | `void` | Optional: op-batch entry point. |
| `SelectAllAdapter.setSelection?` | field | `void` | Mutator wired by `setSelection` op when `applyBatch` is omitted. |
| `UseSelectAllOptions` | interface | `{ enableKeyboard, label }` | Options for `useSelectAll`. |
| `UseSelectAllOptions.enableKeyboard?` | field | `boolean` | Auto-bind Ctrl/Cmd+A on document. |
| `UseSelectAllOptions.label?` | field | `string` | Label passed to applyBatch. |
| `UseSelectAllReturn` | interface | `{ selectAll }` | Return shape of `useSelectAll`. |
| `UseSelectAllReturn.selectAll` | field | `void` | Imperative trigger — selects every id from the adapter. |
| `useSelectAll` | hook | `(adapter: SelectAllAdapter, options: UseSelectAllOptions = {}) => UseSelectAllReturn` | Select-all action; binds Ctrl/Cmd+A on document by default. |
| `useSelectAll.adapter` | param | `adapter: SelectAllAdapter` |  |
| `useSelectAll.options` | param | `options: UseSelectAllOptions = {}` |  |

## src/interactions/actions/undo-redo/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useUndoRedo` | reexport | `re-export from './undoRedo'` |  |
| `UndoRedoAdapter` | reexport | `re-export from './undoRedo'` |  |
| `UseUndoRedoOptions` | reexport | `re-export from './undoRedo'` |  |
| `UseUndoRedoReturn` | reexport | `re-export from './undoRedo'` |  |

## src/interactions/actions/undo-redo/undoRedo.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UndoRedoAdapter` | interface | `{ undo, redo, canUndo, canRedo }` | Adapter for `useUndoRedo`. |
| `UndoRedoAdapter.undo` | field | `void` |  |
| `UndoRedoAdapter.redo` | field | `void` |  |
| `UndoRedoAdapter.canUndo?` | field | `boolean` |  |
| `UndoRedoAdapter.canRedo?` | field | `boolean` |  |
| `UseUndoRedoOptions` | interface | `{ bindKeyboard }` | Options for `useUndoRedo`. |
| `UseUndoRedoOptions.bindKeyboard?` | field | `boolean` | Auto-bind Mod+Z (undo) and Mod+Shift+Z (redo) on document. |
| `UseUndoRedoReturn` | interface | `{ undo, redo }` | Return shape of `useUndoRedo`. |
| `UseUndoRedoReturn.undo` | field | `boolean` | Imperative trigger — undo if the adapter has anything to undo. |
| `UseUndoRedoReturn.redo` | field | `boolean` | Imperative trigger — redo if the adapter has anything to redo. |
| `useUndoRedo` | hook | `(adapter: UndoRedoAdapter, options: UseUndoRedoOptions = {}) => UseUndoRedoReturn` | Undo/redo action; optionally binds Mod+Z and Mod+Shift+Z. |
| `useUndoRedo.adapter` | param | `adapter: UndoRedoAdapter` |  |
| `useUndoRedo.options` | param | `options: UseUndoRedoOptions = {}` |  |

## src/interactions/actions/useKeybinding.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `KeyBinding` | interface | `{ key, mod, alt, shift, skipInEditable, enabled, preventDefault }` | Declarative keybinding description used by `useKeybinding`. |
| `KeyBinding.key` | field | `string \| readonly string[]` | Key or list of keys to match. |
| `KeyBinding.mod?` | field | `boolean` | Require Cmd (mac) or Ctrl (others). |
| `KeyBinding.alt?` | field | `boolean` | Require Alt. |
| `KeyBinding.shift?` | field | `boolean \| 'optional'` | Shift policy. |
| `KeyBinding.skipInEditable?` | field | `boolean` | Skip when focus is in an editable element. |
| `KeyBinding.enabled?` | field | `boolean` | When `false`, the listener is not attached. |
| `KeyBinding.preventDefault?` | field | `boolean` | Call `preventDefault` before the handler. |
| `isEditableTarget` | function | `(target: EventTarget \| null) => boolean` | Returns true when the target is an input, textarea, or contenteditable element. |
| `isEditableTarget.target` | param | `target: EventTarget \| null` |  |
| `useKeybinding` | hook | `(binding: KeyBinding, handler: (event: KeyboardEvent) => void) => void` | Bind a keyboard handler on `document`, with the conventional skip-rules applied. |
| `useKeybinding.binding` | param | `binding: KeyBinding` |  |
| `useKeybinding.handler` | param | `handler: (event: KeyboardEvent) => void` |  |

## src/interactions/gestures/area-select/areaSelect.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseAreaSelectOptions` | interface | `{ behaviors, transient, label, onGestureStart, onGestureEnd, debug }` | Options for `useAreaSelect`. |
| `UseAreaSelectOptions.behaviors?` | field | `AreaSelectBehavior[]` |  |
| `UseAreaSelectOptions.transient?` | field | `boolean` | When set, overrides any behavior's `defaultTransient`. |
| `UseAreaSelectOptions.label?` | field | `string` | Label used when transient is false and the hook falls back to applyBatch. |
| `UseAreaSelectOptions.onGestureStart?` | field | `() => void` |  |
| `UseAreaSelectOptions.onGestureEnd?` | field | `(committed: boolean) => void` |  |
| `UseAreaSelectOptions.debug?` | field | `DebugSink` | Optional debug sink. |
| `AreaSelectController` | interface | `{ start, move, end, cancel, isAreaSelecting, overlay, adapter }` | Return shape of `useAreaSelect`: lifecycle methods and live marquee overlay. |
| `AreaSelectController.start` | field | `void` |  |
| `AreaSelectController.move` | field | `boolean` |  |
| `AreaSelectController.end` | field | `void` |  |
| `AreaSelectController.cancel` | field | `void` |  |
| `AreaSelectController.isAreaSelecting` | field | `boolean` |  |
| `AreaSelectController.overlay` | field | `AreaSelectOverlay \| null` |  |
| `AreaSelectController.adapter` | field | `AreaSelectAdapter` | The adapter passed in. |
| `useAreaSelect` | hook | `(adapter: AreaSelectAdapter, options: UseAreaSelectOptions = {}) => AreaSelectController` | Drag-rectangle area-select interaction; behaviors decide replace-vs-add semantics from modifiers. |
| `useAreaSelect.adapter` | param | `adapter: AreaSelectAdapter` |  |
| `useAreaSelect.options` | param | `options: UseAreaSelectOptions = {}` |  |

## src/interactions/gestures/area-select/behaviors/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `selectFromMarquee` | reexport | `re-export from './selectFromMarquee'` |  |

## src/interactions/gestures/area-select/behaviors/selectFromMarquee.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `selectFromMarquee` | function | `() => AreaSelectBehavior` | Default area-select behavior: replace selection with hits inside the marquee, or extend with shift held. |

## src/interactions/gestures/area-select/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useAreaSelect` | reexport | `re-export from './areaSelect'` |  |
| `UseAreaSelectOptions` | reexport | `re-export from './areaSelect'` |  |
| `AreaSelectController` | reexport | `re-export from './areaSelect'` |  |
| `* from './behaviors'` | reexport-all | `*` |  |

## src/interactions/gestures/clone/behaviors/cloneByAltDrag.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `cloneByAltDrag` | function | `() => CloneBehavior` | Clone-on-alt-drag behavior for `useClone`; activates when Alt/Option is held at drag start. |

## src/interactions/gestures/clone/behaviors/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `cloneByAltDrag` | reexport | `re-export from './cloneByAltDrag'` |  |

## src/interactions/gestures/clone/clone.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseCloneOptions` | interface | `{ behaviors, setOverlay, clearOverlay, expandIds }` | Options for `useClone`. |
| `UseCloneOptions.behaviors` | field | `CloneBehavior[]` |  |
| `UseCloneOptions.setOverlay` | field | `(layer: CloneLayer, objects: unknown[]) => void` |  |
| `UseCloneOptions.clearOverlay` | field | `() => void` |  |
| `UseCloneOptions.expandIds?` | field | `(ids: string[]) => string[]` | Optional: expand the incoming id list before snapshot. |
| `UseCloneReturn` | interface | `{ start, move, end, cancel, isCloning }` | Return shape of `useClone`: lifecycle methods plus the `isCloning` flag. |
| `UseCloneReturn.start` | field | `void` |  |
| `UseCloneReturn.move` | field | `boolean` |  |
| `UseCloneReturn.end` | field | `void` |  |
| `UseCloneReturn.cancel` | field | `void` |  |
| `UseCloneReturn.isCloning` | field | `boolean` |  |
| `useClone` | hook | `(adapter: InsertAdapter<T>, options: UseCloneOptions) => UseCloneReturn` | Drag-to-clone interaction; behavior decides which modifiers activate cloning vs plain move. |
| `useClone.adapter` | param | `adapter: InsertAdapter<T>` |  |
| `useClone.options` | param | `options: UseCloneOptions` |  |

## src/interactions/gestures/clone/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useClone` | reexport | `re-export from './clone'` |  |
| `UseCloneOptions` | reexport | `re-export from './clone'` |  |
| `UseCloneReturn` | reexport | `re-export from './clone'` |  |
| `cloneByAltDrag` | reexport | `re-export from './behaviors'` |  |

## src/interactions/gestures/edit-anchors/editAnchors.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `EditAnchorsAdapter` | interface | `{ getNode, getPose, setPose, applyBatch }` | Adapter for `useEditAnchors` — narrow read/write of one object's path pose. |
| `EditAnchorsAdapter.getNode` | field | `TNode \| undefined` |  |
| `EditAnchorsAdapter.getPose` | field | `Path` | Must return a `Path`; only `kind === 'polygon'` is editable. |
| `EditAnchorsAdapter.setPose` | field | `void` |  |
| `EditAnchorsAdapter.applyBatch?` | field | `(ops: Op[], label?: string) => void` |  |
| `EditAnchorsOverlay` | interface | `{ id, pose, selectedAnchors, drag }` | Live overlay state for the anchor-edit pass. |
| `EditAnchorsOverlay.id` | field | `string` |  |
| `EditAnchorsOverlay.pose` | field | `PolygonPath` |  |
| `EditAnchorsOverlay.selectedAnchors` | field | `number[]` |  |
| `EditAnchorsOverlay.drag` | field | `{ hit: AnchorHit } \| null` |  |
| `EditAnchorsStartArgs` | interface | `{ id, hit, worldX, worldY }` | Arguments to `start()`. |
| `EditAnchorsStartArgs.id` | field | `string` |  |
| `EditAnchorsStartArgs.hit` | field | `AnchorHit` |  |
| `EditAnchorsStartArgs.worldX` | field | `number` |  |
| `EditAnchorsStartArgs.worldY` | field | `number` |  |
| `EditAnchorsMoveArgs` | interface | `{ worldX, worldY, modifiers }` | Arguments to `move()`. |
| `EditAnchorsMoveArgs.worldX` | field | `number` |  |
| `EditAnchorsMoveArgs.worldY` | field | `number` |  |
| `EditAnchorsMoveArgs.modifiers` | field | `ModifierState` |  |
| `UseEditAnchorsOptions` | interface | `{ hitRadius, editLabel, editingId, debug }` | Options for `useEditAnchors`. |
| `UseEditAnchorsOptions.hitRadius?` | field | `number` | World-space hit-test radius for anchor and control handles. |
| `UseEditAnchorsOptions.editLabel?` | field | `string` | History label. |
| `UseEditAnchorsOptions.editingId?` | field | `string \| null` | Currently editing target — when non-null the controller draws an overlay and `tryHit` accepts hit-tests. |
| `UseEditAnchorsOptions.debug?` | field | `DebugSink` | Optional debug sink. |
| `EditAnchorsController` | interface | `{ start, move, end, cancel, isActive, overlay, tryHit, clearSelection, adapter }` | Return shape of `useEditAnchors`. |
| `EditAnchorsController.start` | field | `void` |  |
| `EditAnchorsController.move` | field | `boolean` |  |
| `EditAnchorsController.end` | field | `void` |  |
| `EditAnchorsController.cancel` | field | `void` |  |
| `EditAnchorsController.isActive` | field | `boolean` |  |
| `EditAnchorsController.overlay` | field | `EditAnchorsOverlay \| null` |  |
| `EditAnchorsController.tryHit` | field | `{ id: string; hit: AnchorHit } \| null` |  |
| `EditAnchorsController.clearSelection` | field | `void` | Clear the highlighted anchor selection (stays in edit mode). |
| `EditAnchorsController.adapter` | field | `EditAnchorsAdapter<TNode>` |  |
| `useEditAnchors` | hook | `(adapter: EditAnchorsAdapter<TNode>, options: UseEditAnchorsOptions = {}) => EditAnchorsController<TNode>` |  |
| `useEditAnchors.adapter` | param | `adapter: EditAnchorsAdapter<TNode>` |  |
| `useEditAnchors.options` | param | `options: UseEditAnchorsOptions = {}` |  |

## src/interactions/gestures/edit-anchors/geometry.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PathAnchor` | interface | `{ anchorIndex, x, y, controlIn, controlOut, coordIndex }` | A single anchor on a `PolygonPath`, with its incoming/outgoing bezier control points (when present). |
| `PathAnchor.anchorIndex` | field | `number` | Sequential anchor index in walk order (0-based). |
| `PathAnchor.x` | field | `number` | On-curve point. |
| `PathAnchor.y` | field | `number` |  |
| `PathAnchor.controlIn?` | field | `{ x: number; y: number; coordIndex: number }` | Incoming control (from the previous segment, when it was C/Q). |
| `PathAnchor.controlOut?` | field | `{ x: number; y: number; coordIndex: number }` | Outgoing control (from the next segment, when it is C/Q). |
| `PathAnchor.coordIndex` | field | `number` | Index of the anchor's on-curve x in `coords`. |
| `enumerateAnchors` | function | `(path: PolygonPath) => PathAnchor[]` | Walk a PolygonPath's command stream and yield one `PathAnchor` per on-curve point. |
| `enumerateAnchors.path` | param | `path: PolygonPath` |  |
| `withCoord` | function | `(path: PolygonPath, coordIndex: number, x: number, y: number) => PolygonPath` | Mutate `coords` in-place: write `(x, y)` at `coordIndex`, return a new PolygonPath sharing the same commands but with a fresh coords buffer. |
| `withCoord.path` | param | `path: PolygonPath` |  |
| `withCoord.coordIndex` | param | `coordIndex: number` |  |
| `withCoord.x` | param | `x: number` |  |
| `withCoord.y` | param | `y: number` |  |

## src/interactions/gestures/edit-anchors/handles.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `AnchorHit` | interface | `{ anchorIndex, kind, coordIndex }` | Result of a hit-test against a path's anchors / control handles. |
| `AnchorHit.anchorIndex` | field | `number` |  |
| `AnchorHit.kind` | field | `'anchor' \| 'controlIn' \| 'controlOut'` |  |
| `AnchorHit.coordIndex` | field | `number` | Index in `coords` of the hit point's x. |
| `hitAnchor` | function | `(path: PolygonPath, worldX: number, worldY: number, threshold: number) => AnchorHit \| null` | Hit-test anchors and control handles. |
| `hitAnchor.path` | param | `path: PolygonPath` |  |
| `hitAnchor.worldX` | param | `worldX: number` |  |
| `hitAnchor.worldY` | param | `worldY: number` |  |
| `hitAnchor.threshold` | param | `threshold: number` |  |
| `PathAnchor` | reexport | `re-export of PathAnchor` |  |

## src/interactions/gestures/edit-anchors/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useEditAnchors` | reexport | `re-export from './editAnchors'` |  |
| `UseEditAnchorsOptions` | reexport | `re-export from './editAnchors'` |  |
| `EditAnchorsController` | reexport | `re-export from './editAnchors'` |  |
| `EditAnchorsAdapter` | reexport | `re-export from './editAnchors'` |  |
| `EditAnchorsOverlay` | reexport | `re-export from './editAnchors'` |  |
| `EditAnchorsStartArgs` | reexport | `re-export from './editAnchors'` |  |
| `EditAnchorsMoveArgs` | reexport | `re-export from './editAnchors'` |  |
| `hitAnchor` | reexport | `re-export from './handles'` |  |
| `AnchorHit` | reexport | `re-export from './handles'` |  |
| `PathAnchor` | reexport | `re-export from './handles'` |  |
| `enumerateAnchors` | reexport | `re-export from './geometry'` |  |
| `withCoord` | reexport | `re-export from './geometry'` |  |
| `createAnchorEditOverlayLayer` | reexport | `re-export from './overlay'` |  |
| `AnchorEditOverlayOpts` | reexport | `re-export from './overlay'` |  |

## src/interactions/gestures/edit-anchors/overlay.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `AnchorEditOverlayOpts` | interface | `{ getOverlay, tangentStroke, anchorRadius, controlRadius, anchorFill, anchorStroke, selectedAnchorFill, controlFill, controlStroke }` | Visual options for the anchor-edit overlay. |
| `AnchorEditOverlayOpts.getOverlay` | field | `() => { pose: PolygonPath; selectedAnchors: number[]; } \| null` | Returns the live editing state (or `null` when not editing). |
| `AnchorEditOverlayOpts.tangentStroke?` | field | `string` | Tangent-line stroke color. |
| `AnchorEditOverlayOpts.anchorRadius?` | field | `number` | Anchor circle radius (world units). |
| `AnchorEditOverlayOpts.controlRadius?` | field | `number` | Control circle radius (world units). |
| `AnchorEditOverlayOpts.anchorFill?` | field | `string` | Anchor fill. |
| `AnchorEditOverlayOpts.anchorStroke?` | field | `string` | Anchor stroke. |
| `AnchorEditOverlayOpts.selectedAnchorFill?` | field | `string` | Selected-anchor fill (highlight). |
| `AnchorEditOverlayOpts.controlFill?` | field | `string` | Control fill. |
| `AnchorEditOverlayOpts.controlStroke?` | field | `string` | Control stroke. |
| `createAnchorEditOverlayLayer` | function | `(opts: AnchorEditOverlayOpts) => RenderLayer<unknown>` |  |
| `createAnchorEditOverlayLayer.opts` | param | `opts: AnchorEditOverlayOpts` |  |

## src/interactions/gestures/insert/behaviors/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snapToGrid` | reexport | `re-export from './snapToGrid'` |  |

## src/interactions/gestures/insert/behaviors/snapToGrid.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snapToGrid` | function | `(args: { spacing: number; bypassKey?: ModKey; }) => InsertBehavior<TPose>` |  |
| `snapToGrid.args` | param | `args: { spacing: number; bypassKey?: ModKey; }` |  |

## src/interactions/gestures/insert/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useInsert` | reexport | `re-export from './insert'` |  |
| `UseInsertOptions` | reexport | `re-export from './insert'` |  |
| `InsertController` | reexport | `re-export from './insert'` |  |
| `* from './behaviors'` | reexport-all | `*` |  |

## src/interactions/gestures/insert/insert.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseInsertOptions` | interface | `{ behaviors, insertLabel, transient, minBounds, posefromBounds, pointInsert, clickOnly, applyBatch, onGestureStart, onGestureEnd }` | Options for `useInsert`. |
| `UseInsertOptions.behaviors?` | field | `InsertBehavior<TPose>[]` |  |
| `UseInsertOptions.insertLabel?` | field | `string` |  |
| `UseInsertOptions.transient?` | field | `boolean` | Reserved; insert is never transient in practice. |
| `UseInsertOptions.minBounds?` | field | `{ width: number; height: number }` | Strictly-greater-than thresholds; bounds with width <= or height <= abort. |
| `UseInsertOptions.posefromBounds?` | field | `(bounds: ResizePose) => TPose` | Construct the in-flight pose from the drag bounds. |
| `UseInsertOptions.pointInsert?` | field | `(point: { x: number; y: number }) => TNode \| null` | Click / sub-threshold-drag fallback. |
| `UseInsertOptions.clickOnly?` | field | `boolean` | Drag-disabled mode. |
| `UseInsertOptions.applyBatch?` | field | `(ops: Op[], label: string) => void` | Override for op dispatch on commit. |
| `UseInsertOptions.onGestureStart?` | field | `() => void` |  |
| `UseInsertOptions.onGestureEnd?` | field | `(committed: boolean) => void` |  |
| `InsertController` | interface | `{ start, move, end, cancel, isInserting, overlay, adapter }` | Return shape of `useInsert`: lifecycle methods plus the live drag-rectangle overlay. |
| `InsertController.start` | field | `void` |  |
| `InsertController.move` | field | `boolean` |  |
| `InsertController.end` | field | `void` |  |
| `InsertController.cancel` | field | `void` |  |
| `InsertController.isInserting` | field | `boolean` |  |
| `InsertController.overlay` | field | `InsertOverlay<TPose> \| null` |  |
| `InsertController.adapter` | field | `InsertAdapter<TNode>` | The adapter passed in. |
| `useInsert` | hook | `(adapter: InsertAdapter<TNode>, options: UseInsertOptions<TPose, TNode> = {}) => InsertController<TNode, TPose>` | Drag-rectangle insert interaction; the adapter materializes the new object on commit. |
| `useInsert.adapter` | param | `adapter: InsertAdapter<TNode>` |  |
| `useInsert.options` | param | `options: UseInsertOptions<TPose, TNode> = {}` |  |

## src/interactions/gestures/move/behaviors/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snapToGrid` | reexport | `re-export from './snapToGrid'` |  |
| `snapToContainer` | reexport | `re-export from './snapToContainer'` |  |
| `snapBackOrDelete` | reexport | `re-export from './snapBackOrDelete'` |  |

## src/interactions/gestures/move/behaviors/snapBackOrDelete.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snapBackOrDelete` | function | `(args: { radius: number; onFreeRelease: 'snap-back' \| 'delete'; deleteLabel?: string; }) => MoveBehavior<TPose>` |  |
| `snapBackOrDelete.args` | param | `args: { radius: number; onFreeRelease: 'snap-back' \| 'delete'; deleteLabel?: string; }` |  |
| `snapBackOrDelete` | function | `(args: { radius: number; onFreeRelease: 'snap-back' \| 'delete'; deleteLabel?: string; origin: OriginProjection<TPose>; }) => MoveBehavior<TPose>` |  |
| `snapBackOrDelete.args` | param | `args: { radius: number; onFreeRelease: 'snap-back' \| 'delete'; deleteLabel?: string; origin: OriginProjection<TPose>; }` |  |
| `snapBackOrDelete` | function | `(args: { radius: number; onFreeRelease: 'snap-back' \| 'delete'; deleteLabel?: string; origin?: OriginProjection<TPose>; }) => MoveBehavior<TPose>` |  |
| `snapBackOrDelete.args` | param | `args: { radius: number; onFreeRelease: 'snap-back' \| 'delete'; deleteLabel?: string; origin?: OriginProjection<TPose>; }` |  |

## src/interactions/gestures/move/behaviors/snapToContainer.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snapToContainer` | function | `(args: { dwellMs: number; findTarget: ( draggedId: string, worldX: number, worldY: number, ) => SnapTarget<TPose> \| null; isInstant?: (target: SnapTarget<TPose>) => boolean; moveLabel?: string; reparentLabel?: string; }) => MoveBehavior<TPose>` |  |
| `snapToContainer.args` | param | `args: { dwellMs: number; findTarget: ( draggedId: string, worldX: number, worldY: number, ) => SnapTarget<TPose> \| null; isInstant?: (target: SnapTarget<TPose>) => boolean; moveLabel?: string; reparentLabel?: string; }` |  |

## src/interactions/gestures/move/behaviors/snapToGrid.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snapToGrid` | function | `(args: { spacing: number; bypassKey?: ModKey; }) => MoveBehavior<TPose>` |  |
| `snapToGrid.args` | param | `args: { spacing: number; bypassKey?: ModKey; }` |  |

## src/interactions/gestures/move/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useMove` | reexport | `re-export from './move'` |  |
| `UseMoveOptions` | reexport | `re-export from './move'` |  |
| `MoveController` | reexport | `re-export from './move'` |  |
| `MoveStartArgs` | reexport | `re-export from './move'` |  |
| `MoveMoveArgs` | reexport | `re-export from './move'` |  |
| `snapToGrid` | reexport | `re-export from './behaviors'` |  |
| `snapToContainer` | reexport | `re-export from './behaviors'` |  |
| `snapBackOrDelete` | reexport | `re-export from './behaviors'` |  |

## src/interactions/gestures/move/move.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseMoveOptions` | interface | `{ translatePose, behaviors, dragThresholdPx, moveLabel, transient, onGestureStart, onGestureEnd, expandIds, cascadeWorldPose }` | Options for `useMove`. |
| `UseMoveOptions.translatePose?` | field | `(pose: TPose, dx: number, dy: number) => TPose` | How to apply a `(dx, dy)` translation to a pose. |
| `UseMoveOptions.behaviors?` | field | `MoveBehavior<TPose>[]` |  |
| `UseMoveOptions.dragThresholdPx?` | field | `number` |  |
| `UseMoveOptions.moveLabel?` | field | `string` |  |
| `UseMoveOptions.transient?` | field | `boolean` | Reserved for transient gestures (no history entry). |
| `UseMoveOptions.onGestureStart?` | field | `void` |  |
| `UseMoveOptions.onGestureEnd?` | field | `void` |  |
| `UseMoveOptions.expandIds?` | field | `(ids: string[]) => string[]` | Optional: expand the incoming id list before pose lookups. |
| `UseMoveOptions.cascadeWorldPose?` | field | `(id: string) => TPose \| null` | Optional: lookup a world-space pose by id. |
| `MoveStartArgs` | interface | `{ ids, worldX, worldY, clientX, clientY }` | Arguments passed to `start()` when initiating a move gesture. |
| `MoveStartArgs.ids` | field | `string[]` |  |
| `MoveStartArgs.worldX` | field | `number` |  |
| `MoveStartArgs.worldY` | field | `number` |  |
| `MoveStartArgs.clientX` | field | `number` |  |
| `MoveStartArgs.clientY` | field | `number` |  |
| `MoveMoveArgs` | interface | `{ worldX, worldY, clientX, clientY, modifiers }` | Arguments passed to `move()` on each pointer-move during a live gesture. |
| `MoveMoveArgs.worldX` | field | `number` |  |
| `MoveMoveArgs.worldY` | field | `number` |  |
| `MoveMoveArgs.clientX` | field | `number` |  |
| `MoveMoveArgs.clientY` | field | `number` |  |
| `MoveMoveArgs.modifiers` | field | `ModifierState` |  |
| `MoveController` | interface | `{ start, move, end, cancel, isActive, overlay, adapter }` | Return shape of `useMove`: lifecycle methods and a live overlay snapshot. |
| `MoveController.start` | field | `void` |  |
| `MoveController.move` | field | `boolean` |  |
| `MoveController.end` | field | `void` |  |
| `MoveController.cancel` | field | `void` |  |
| `MoveController.isActive` | field | `boolean` |  |
| `MoveController.overlay` | field | `MoveOverlay<TPose> \| null` |  |
| `MoveController.adapter` | field | `MoveAdapter<TNode, TPose>` | The adapter passed in. |
| `useMove` | hook | `(adapter: MoveAdapter<TNode, TPose>, options: UseMoveOptions<TPose> = {}) => MoveController<TNode, TPose>` | Pointer-driven move interaction with composable behaviors (snap, container reparent, snap-back) and op-batched commit. |
| `useMove.adapter` | param | `adapter: MoveAdapter<TNode, TPose>` |  |
| `useMove.options` | param | `options: UseMoveOptions<TPose> = {}` |  |

## src/interactions/gestures/resize/autoPoseDescriptor.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `isPathLike` | function | `(p: unknown) => p is Path` | True for Path-shaped poses (`{kind: 'polygon' \\| 'rect'}`). |
| `isPathLike.p` | param | `p: unknown` |  |
| `AUTO_POSE_DESCRIPTOR` | const | `PoseDescriptor<unknown>` | Per-call dispatch: if the pose looks like a Path, route to `pathPoseDescriptor`; otherwise treat as a plain rect pose. |

## src/interactions/gestures/resize/behaviors/clampMinSize.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `clampMinSize` | function | `(args: { minWidth: number; minHeight: number; }) => ResizeBehavior<TPose>` |  |
| `clampMinSize.args` | param | `args: { minWidth: number; minHeight: number; }` |  |

## src/interactions/gestures/resize/behaviors/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `clampMinSize` | reexport | `re-export from './clampMinSize'` |  |
| `snapToGrid` | reexport | `re-export from './snapToGrid'` |  |

## src/interactions/gestures/resize/behaviors/snapToGrid.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snapToGrid` | function | `(args: { spacing: number; bypassKey?: ModKey; suspendBelowDim?: boolean; }) => ResizeBehavior<TPose>` |  |
| `snapToGrid.args` | param | `args: { spacing: number; bypassKey?: ModKey; suspendBelowDim?: boolean; }` |  |

## src/interactions/gestures/resize/cornerHandles.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `CornerHandle` | interface | `{ cx, cy, anchor }` | Corner resize-handle: world-space center plus the anchor that pins the opposite corner during resize. |
| `CornerHandle.cx` | field | `number` |  |
| `CornerHandle.cy` | field | `number` |  |
| `CornerHandle.anchor` | field | `ResizeAnchor` |  |
| `cornerResizeHandles` | function | `(bounds: Bounds) => CornerHandle[]` | Standard 4-corner resize-handle layout: each corner pins the opposite corner via an anchor of `{x: 'min'\\|'max', y: 'min'\\|'max'}` so dragging it scales the box f |
| `cornerResizeHandles.bounds` | param | `bounds: Bounds` |  |
| `hitCornerHandle` | function | `(handle: CornerHandle, px: number, py: number, radius: number) => boolean` | Square hit-test for a handle: returns true if `(px, py)` is within `radius` of the handle center on both axes. |
| `hitCornerHandle.handle` | param | `handle: CornerHandle` |  |
| `hitCornerHandle.px` | param | `px: number` |  |
| `hitCornerHandle.py` | param | `py: number` |  |
| `hitCornerHandle.radius` | param | `radius: number` |  |

## src/interactions/gestures/resize/geometry.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PoseDescriptor` | interface | `{ getBounds, remapBounds, translate, intersectsRect, lerp }` | Bridges arbitrary `TPose` shapes into the resize hook's bounds-driven math. |
| `PoseDescriptor.getBounds` | field | `ResizePose` |  |
| `PoseDescriptor.remapBounds` | field | `TPose` |  |
| `PoseDescriptor.translate?` | field | `TPose` | Translate the pose by (dx, dy). |
| `PoseDescriptor.intersectsRect?` | field | `boolean` | True iff any portion of the pose's geometry intersects `rect`. |
| `PoseDescriptor.lerp?` | field | `TPose` | Interpolate between two poses. |
| `aabbIntersectsRect` | function | `(b: ResizePose, r: ResizePose) => boolean` | AABB-vs-AABB overlap. |
| `aabbIntersectsRect.b` | param | `b: ResizePose` |  |
| `aabbIntersectsRect.r` | param | `r: ResizePose` |  |
| `RECT_POSE_DESCRIPTOR` | const | `PoseDescriptor<ResizePose>` | Identity geometry for `TPose extends ResizePose`. |

## src/interactions/gestures/resize/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useResize` | reexport | `re-export from './resize'` |  |
| `UseResizeOptions` | reexport | `re-export from './resize'` |  |
| `ResizeController` | reexport | `re-export from './resize'` |  |
| `RECT_POSE_DESCRIPTOR` | reexport | `re-export from './geometry'` |  |
| `PoseDescriptor` | reexport | `re-export from './geometry'` |  |
| `cornerResizeHandles` | reexport | `re-export from './cornerHandles'` |  |
| `hitCornerHandle` | reexport | `re-export from './cornerHandles'` |  |
| `CornerHandle` | reexport | `re-export from './cornerHandles'` |  |
| `* from './behaviors'` | reexport-all | `*` |  |

## src/interactions/gestures/resize/resize.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseResizeOptions` | interface | `{ behaviors, resizeLabel, transient, onGestureStart, onGestureEnd, expandIds, geometry, debug, handleHitRadius }` | Options for `useResize`. |
| `UseResizeOptions.behaviors?` | field | `TPose extends ResizePose ? ResizeBehavior<TPose>[] : never` | Behaviors are rect-typed: they read/write `{x,y,width,height}`. |
| `UseResizeOptions.resizeLabel?` | field | `string` |  |
| `UseResizeOptions.transient?` | field | `boolean` | Reserved; resize is never transient in practice. |
| `UseResizeOptions.onGestureStart?` | field | `(id: string) => void` |  |
| `UseResizeOptions.onGestureEnd?` | field | `(committed: boolean) => void` |  |
| `UseResizeOptions.expandIds?` | field | `(ids: string[]) => string[]` | Optional: expand the incoming id into leaf ids before pose lookups. |
| `UseResizeOptions.geometry?` | field | `PoseDescriptor<TPose>` | Projection from `TPose` to bounds and back. |
| `UseResizeOptions.debug?` | field | `DebugSink` | Optional debug sink. |
| `UseResizeOptions.handleHitRadius?` | field | `number` | Hit-test radius for corner handles, in screen pixels. |
| `ResizeController` | interface | `{ start, move, end, cancel, isResizing, overlay, adapter }` | Return shape of `useResize`: lifecycle methods plus a live overlay snapshot. |
| `ResizeController.start` | field | `void` |  |
| `ResizeController.move` | field | `boolean` |  |
| `ResizeController.end` | field | `void` |  |
| `ResizeController.cancel` | field | `void` |  |
| `ResizeController.isResizing` | field | `boolean` |  |
| `ResizeController.overlay` | field | `ResizeOverlay<TPose> \| null` |  |
| `ResizeController.adapter` | field | `ResizeAdapter<TNode, TPose>` | The adapter passed in. |
| `useResize` | hook | `(adapter: ResizeAdapter<TNode, TPose>, options: UseResizeOptions<TPose>) => ResizeController<TNode, TPose>` | Pointer-driven resize interaction with anchor-relative dragging, optional group expansion, and behavior pipeline. |
| `useResize.adapter` | param | `adapter: ResizeAdapter<TNode, TPose>` |  |
| `useResize.options` | param | `options: UseResizeOptions<TPose>` |  |

## src/interactions/gestures/rotate/geometry.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `aabbCenter` | function | `(bounds: ResizePose) => { x: number; y: number }` | AABB center of an unrotated rect — the canonical rotation pivot. |
| `aabbCenter.bounds` | param | `bounds: ResizePose` |  |
| `rotatePoint` | function | `(px: number, py: number, cx: number, cy: number, angle: number) => { x: number; y: number }` | Rotate `(px, py)` by `angle` (radians) around `(cx, cy)`. |
| `rotatePoint.px` | param | `px: number` |  |
| `rotatePoint.py` | param | `py: number` |  |
| `rotatePoint.cx` | param | `cx: number` |  |
| `rotatePoint.cy` | param | `cy: number` |  |
| `rotatePoint.angle` | param | `angle: number` |  |
| `rectCorners` | function | `(bounds: ResizePose) => { x: number; y: number }[]` | Four corners of an unrotated rect, in TL/TR/BR/BL order. |
| `rectCorners.bounds` | param | `bounds: ResizePose` |  |
| `rotatedRectCorners` | function | `(pose: RotatedPose) => { x: number; y: number }[]` | Four corners of a rotated rect (rotation around AABB center), in TL/TR/BR/BL order. |
| `rotatedRectCorners.pose` | param | `pose: RotatedPose` |  |
| `pointInRotatedRect` | function | `(pose: RotatedPose, worldX: number, worldY: number) => boolean` | Hit-test a world point against a rotated rect (rotation around AABB center). |
| `pointInRotatedRect.pose` | param | `pose: RotatedPose` |  |
| `pointInRotatedRect.worldX` | param | `worldX: number` |  |
| `pointInRotatedRect.worldY` | param | `worldY: number` |  |

## src/interactions/gestures/rotate/handle.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `DEFAULT_ROTATION_HANDLE_DISTANCE` | const | `24` | Default world-space distance from the rect's top edge to the rotation handle's center. |
| `RotationHandle` | interface | `{ cx, cy }` | Rotation handle position in world coords. |
| `RotationHandle.cx` | field | `number` | Handle center in world coords. |
| `RotationHandle.cy` | field | `number` |  |
| `rotationHandle` | function | `(pose: { x: number; y: number; width: number; height: number; rotation?: number }, distance: number = DEFAULT_ROTATION_HANDLE_DISTANCE) => RotationHandle` | Rotation handle for a rotated rect: top-center of the (rotated) bounding box, offset outward along the local up-vector by `distance` world pixels. |
| `rotationHandle.pose` | param | `pose: { x: number; y: number; width: number; height: number; rotation?: number }` |  |
| `rotationHandle.distance` | param | `distance: number = DEFAULT_ROTATION_HANDLE_DISTANCE` |  |
| `hitRotationHandle` | function | `(handle: RotationHandle, px: number, py: number, radius: number) => boolean` | Square hit-test: returns true if `(px, py)` is within `radius` of the handle's center on both axes. |
| `hitRotationHandle.handle` | param | `handle: RotationHandle` |  |
| `hitRotationHandle.px` | param | `px: number` |  |
| `hitRotationHandle.py` | param | `py: number` |  |
| `hitRotationHandle.radius` | param | `radius: number` |  |

## src/interactions/gestures/rotate/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useRotate` | reexport | `re-export from './rotate'` |  |
| `UseRotateOptions` | reexport | `re-export from './rotate'` |  |
| `RotateController` | reexport | `re-export from './rotate'` |  |
| `RotateStartArgs` | reexport | `re-export from './rotate'` |  |
| `RotateMoveArgs` | reexport | `re-export from './rotate'` |  |
| `RotateGeometry` | reexport | `re-export from './rotate'` |  |
| `aabbCenter` | reexport | `re-export from './geometry'` |  |
| `rotatePoint` | reexport | `re-export from './geometry'` |  |
| `rectCorners` | reexport | `re-export from './geometry'` |  |
| `rotatedRectCorners` | reexport | `re-export from './geometry'` |  |
| `pointInRotatedRect` | reexport | `re-export from './geometry'` |  |
| `rotationHandle` | reexport | `re-export from './handle'` |  |
| `hitRotationHandle` | reexport | `re-export from './handle'` |  |
| `DEFAULT_ROTATION_HANDLE_DISTANCE` | reexport | `re-export from './handle'` |  |
| `RotationHandle` | reexport | `re-export from './handle'` |  |

## src/interactions/gestures/rotate/rotate.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `RotateGeometry` | interface | `{ getRotatedBounds, withRotation }` | Project a TPose to its `{x, y, width, height, rotation}` view. |
| `RotateGeometry.getRotatedBounds` | field | `RotatedPose` |  |
| `RotateGeometry.withRotation` | field | `TPose` | Write a new rotation back into the pose; bounds stay the same. |
| `RotateStartArgs` | interface | `{ id, worldX, worldY }` | Arguments passed to `start()` when initiating a rotate gesture. |
| `RotateStartArgs.id` | field | `string` |  |
| `RotateStartArgs.worldX` | field | `number` |  |
| `RotateStartArgs.worldY` | field | `number` |  |
| `RotateMoveArgs` | interface | `{ worldX, worldY, modifiers }` | Arguments passed to `move()` on each pointer-move during a live gesture. |
| `RotateMoveArgs.worldX` | field | `number` |  |
| `RotateMoveArgs.worldY` | field | `number` |  |
| `RotateMoveArgs.modifiers` | field | `ModifierState` |  |
| `UseRotateOptions` | interface | `{ behaviors, rotateLabel, transient, onGestureStart, onGestureEnd, geometry, debug, rotationHandleDistance, handleHitRadius }` | Options for `useRotate`. |
| `UseRotateOptions.behaviors?` | field | `TPose extends RotatedPose ? RotateBehavior<TPose>[] : never` | Behaviors are typed against the pose shape; the kit ships none yet (rotation snap behaviors are deferred). |
| `UseRotateOptions.rotateLabel?` | field | `string` |  |
| `UseRotateOptions.transient?` | field | `boolean` | Reserved; rotate is never transient in practice. |
| `UseRotateOptions.onGestureStart?` | field | `(id: string) => void` |  |
| `UseRotateOptions.onGestureEnd?` | field | `(committed: boolean) => void` |  |
| `UseRotateOptions.geometry?` | field | `RotateGeometry<TPose>` | Project pose ↔ rotated bounds. |
| `UseRotateOptions.debug?` | field | `DebugSink` | Optional debug sink. |
| `UseRotateOptions.rotationHandleDistance?` | field | `number` | World-pixel distance from the AABB top edge to the rotation handle. |
| `UseRotateOptions.handleHitRadius?` | field | `number` | Hit-test radius for the rotation handle, in screen pixels. |
| `RotateController` | interface | `{ start, move, end, cancel, isActive, overlay, adapter }` | Return shape of `useRotate`: lifecycle methods and a live overlay snapshot. |
| `RotateController.start` | field | `void` |  |
| `RotateController.move` | field | `boolean` |  |
| `RotateController.end` | field | `void` |  |
| `RotateController.cancel` | field | `void` |  |
| `RotateController.isActive` | field | `boolean` |  |
| `RotateController.overlay` | field | `RotateOverlay<TPose> \| null` |  |
| `RotateController.adapter` | field | `RotateAdapter<TNode, TPose>` | The adapter passed in. |
| `useRotate` | hook | `(adapter: RotateAdapter<TNode, TPose>, options: UseRotateOptions<TPose> = {}) => RotateController<TNode, TPose>` | Pointer-driven rotation interaction. |
| `useRotate.adapter` | param | `adapter: RotateAdapter<TNode, TPose>` |  |
| `useRotate.options` | param | `options: UseRotateOptions<TPose> = {}` |  |
| `ResizePose` | reexport | `re-export of ResizePose` |  |

## src/interactions/gestures/shared/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snap` | reexport | `re-export from './snap'` |  |
| `* from './strategies'` | reexport-all | `*` |  |

## src/interactions/gestures/shared/snap.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `snap` | function | `(strategy: SnapStrategy<TPose>, opts: { bypassKey?: ModKey } = {}) => MoveBehavior<TPose>` | Generic snap behavior factory: wraps a `SnapStrategy` and returns a `MoveBehavior`, with optional bypass-key. |
| `snap.strategy` | param | `strategy: SnapStrategy<TPose>` |  |
| `snap.opts` | param | `opts: { bypassKey?: ModKey } = {}` |  |

## src/interactions/gestures/shared/strategies/grid.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `OriginProjection` | interface | `{ getOrigin, translate }` | Projection used by `gridSnapStrategy` when `TPose` doesn't expose `{x,y}` directly (Path, polygon, etc.). |
| `OriginProjection.getOrigin` | field | `{ x: number; y: number }` |  |
| `OriginProjection.translate` | field | `TPose` |  |
| `RECT_ORIGIN_PROJECTION` | const | `OriginProjection<{ x: number; y: number }>` | Identity projection for `TPose extends { x; y }`. |
| `gridSnapStrategy` | function | `(spacing: UnitValue, unitSystem?: UnitSystem) => SnapStrategy<TPose>` | Snap-strategy that rounds the pose's origin to the nearest multiple of `spacing` (resolved through `unitSystem`). |
| `gridSnapStrategy.spacing` | param | `spacing: UnitValue` |  |
| `gridSnapStrategy.unitSystem` | param | `unitSystem?: UnitSystem` |  |
| `gridSnapStrategy` | function | `(spacing: UnitValue, opts: { unitSystem?: UnitSystem; debug?: DebugSink }) => SnapStrategy<TPose>` |  |
| `gridSnapStrategy.spacing` | param | `spacing: UnitValue` |  |
| `gridSnapStrategy.opts` | param | `opts: { unitSystem?: UnitSystem; debug?: DebugSink }` |  |
| `gridSnapStrategy` | function | `(spacing: UnitValue, opts: { unitSystem?: UnitSystem; origin: OriginProjection<TPose>; debug?: DebugSink }) => SnapStrategy<TPose>` |  |
| `gridSnapStrategy.spacing` | param | `spacing: UnitValue` |  |
| `gridSnapStrategy.opts` | param | `opts: { unitSystem?: UnitSystem; origin: OriginProjection<TPose>; debug?: DebugSink }` |  |
| `gridSnapStrategy` | function | `(spacing: UnitValue, arg?: UnitSystem \| { unitSystem?: UnitSystem; origin?: OriginProjection<TPose>; debug?: DebugSink }) => SnapStrategy<TPose>` | Snap-strategy that rounds the pose's origin to the nearest multiple of `spacing` (resolved through `unitSystem`). |
| `gridSnapStrategy.spacing` | param | `spacing: UnitValue` |  |
| `gridSnapStrategy.arg` | param | `arg?: UnitSystem \| { unitSystem?: UnitSystem; origin?: OriginProjection<TPose>; debug?: DebugSink }` |  |
| `pointToGridCell` | function | `(point: { x: number; y: number }, spacing: UnitValue, unitSystem?: UnitSystem, origin: { x: number; y: number } = { x: 0, y: 0 }) => { col: number; row: number }` | Compute the integer cell `{col, row}` that contains `point`, given a grid `spacing` and optional `origin` and `unitSystem`. |
| `pointToGridCell.point` | param | `point: { x: number; y: number }` |  |
| `pointToGridCell.spacing` | param | `spacing: UnitValue` |  |
| `pointToGridCell.unitSystem` | param | `unitSystem?: UnitSystem` |  |
| `pointToGridCell.origin` | param | `origin: { x: number; y: number } = { x: 0, y: 0 }` |  |

## src/interactions/gestures/shared/strategies/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `gridSnapStrategy` | reexport | `re-export from './grid'` |  |
| `pointToGridCell` | reexport | `re-export from './grid'` |  |
| `RECT_ORIGIN_PROJECTION` | reexport | `re-export from './grid'` |  |
| `OriginProjection` | reexport | `re-export from './grid'` |  |

## src/interactions/gestures/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ModifierState` | interface | `{ alt, shift, meta, ctrl }` | Snapshot of modifier-key state at gesture dispatch. |
| `ModifierState.alt` | field | `boolean` |  |
| `ModifierState.shift` | field | `boolean` |  |
| `ModifierState.meta` | field | `boolean` |  |
| `ModifierState.ctrl` | field | `boolean` |  |
| `PointerState` | interface | `{ worldX, worldY, clientX, clientY }` | Pointer position in both world and client coords. |
| `PointerState.worldX` | field | `number` |  |
| `PointerState.worldY` | field | `number` |  |
| `PointerState.clientX` | field | `number` |  |
| `PointerState.clientY` | field | `number` |  |
| `GestureContext` | interface | `{ draggedIds, origin, current, snap, modifiers, pointer, adapter, scratch }` | Per-gesture context passed to behaviors. |
| `GestureContext.draggedIds` | field | `string[]` |  |
| `GestureContext.origin` | field | `Map<string, TPose>` |  |
| `GestureContext.current` | field | `Map<string, TPose>` |  |
| `GestureContext.snap` | field | `SnapTarget<TPose> \| null` |  |
| `GestureContext.modifiers` | field | `ModifierState` |  |
| `GestureContext.pointer` | field | `PointerState` |  |
| `GestureContext.adapter` | field | `MoveAdapter<TNode, TPose>` |  |
| `GestureContext.scratch` | field | `Record<string, unknown>` | Per-gesture mutable store. |
| `SnapStrategy` | interface | `{ snap }` | Pluggable per-gesture snap rule; receives the proposed pose and returns a snapped pose or `null` to skip. |
| `SnapStrategy.snap` | field | `TPose \| null` |  |
| `GestureBehavior` | interface | `{ defaultTransient, onStart, onMove, onEnd }` | Generalized base behavior. |
| `GestureBehavior.defaultTransient?` | field | `boolean` |  |
| `GestureBehavior.onStart?` | field | `void` |  |
| `GestureBehavior.onMove?` | field | `TMoveResult \| void` |  |
| `GestureBehavior.onEnd?` | field | `Op[] \| null \| void` |  |
| `BehaviorMoveResult` | interface | `{ pose, snap }` | Per-frame result a `MoveBehavior.onMove` can return to override pose / snap target. |
| `BehaviorMoveResult.pose?` | field | `TPose` |  |
| `BehaviorMoveResult.snap?` | field | `SnapTarget<TPose> \| null` |  |
| `MoveBehavior` | type | `GestureBehavior<TPose, TPose, BehaviorMoveResult<TPose>>` | A behavior plugged into `useMove` — shapes the proposed pose during a drag. |
| `MoveOverlay` | interface | `{ draggedIds, poses, snapped, hideIds, hypotheticalChildPositions, sourceReflowPositions, destContainerId, accepted }` | Live overlay state exposed by `useMove` for rendering ghosts and snap previews. |
| `MoveOverlay.draggedIds` | field | `string[]` |  |
| `MoveOverlay.poses` | field | `Map<string, TPose>` |  |
| `MoveOverlay.snapped` | field | `SnapTarget<TPose> \| null` |  |
| `MoveOverlay.hideIds` | field | `string[]` |  |
| `MoveOverlay.hypotheticalChildPositions` | field | `Map<string, TPose>` | Sibling poses in the destination container as a layout strategy proposes them during the live drag. |
| `MoveOverlay.sourceReflowPositions` | field | `Map<string, TPose>` | Sibling poses in the source container as the source's layout strategy proposes them when the dragged child has left it. |
| `MoveOverlay.destContainerId` | field | `string \| null` | The container the drag is currently over (for highlight chrome). |
| `MoveOverlay.accepted` | field | `boolean` | False when no layout-bearing container has accepted the pointer (pointer is over free space, or every candidate's snap returned null). |
| `ResizeAnchor` | type | `{ x: 'min' \| 'max' \| 'free'; y: 'min' \| 'max' \| 'free'; }` | Which corner/edge of the rect stays fixed during a resize. |
| `ResizeAnchor.x` | field | `'min' \| 'max' \| 'free'` |  |
| `ResizeAnchor.y` | field | `'min' \| 'max' \| 'free'` |  |
| `ResizePose` | interface | `{ x, y, width, height }` | Minimum rect-shaped pose required by the resize machinery. |
| `ResizePose.x` | field | `number` |  |
| `ResizePose.y` | field | `number` |  |
| `ResizePose.width` | field | `number` |  |
| `ResizePose.height` | field | `number` |  |
| `ResizeProposed` | interface | `{ pose, anchor }` | Per-frame proposed resize: pose plus the anchor pinning the opposite corner. |
| `ResizeProposed.pose` | field | `TPose` |  |
| `ResizeProposed.anchor` | field | `ResizeAnchor` |  |
| `ResizeMoveResult` | interface | `{ pose }` | Per-frame result a `ResizeBehavior.onMove` can return to override the proposed pose. |
| `ResizeMoveResult.pose?` | field | `TPose` |  |
| `ResizeBehavior` | type | `GestureBehavior< TPose, ResizeProposed<TPose>, ResizeMoveResult<TPose> >` | A behavior plugged into `useResize`. |
| `ResizeOverlay` | interface | `{ id, currentPose, targetPose, anchor, leafPoses }` | Live overlay state exposed by `useResize` for rendering the in-flight resize ghost. |
| `ResizeOverlay.id` | field | `string` |  |
| `ResizeOverlay.currentPose` | field | `TPose` |  |
| `ResizeOverlay.targetPose` | field | `TPose` |  |
| `ResizeOverlay.anchor` | field | `ResizeAnchor` |  |
| `ResizeOverlay.leafPoses?` | field | `Map<string, TPose>` | Per-leaf scaled poses when the gesture is resizing a virtual group. |
| `RotatedPose` | interface | `{ rotation }` | ResizePose extended with a rotation angle (radians). |
| `RotatedPose.rotation` | field | `number` |  |
| `RotateProposed` | interface | `{ pose, rotation }` | Per-frame proposed rotation: pose plus the candidate angle in radians. |
| `RotateProposed.pose` | field | `TPose` |  |
| `RotateProposed.rotation` | field | `number` | Proposed rotation angle (radians). |
| `RotateMoveResult` | interface | `{ pose }` | Per-frame result a `RotateBehavior.onMove` can return to override the proposed pose. |
| `RotateMoveResult.pose?` | field | `TPose` |  |
| `RotateBehavior` | type | `GestureBehavior< TPose, RotateProposed<TPose>, RotateMoveResult<TPose> >` | A behavior plugged into `useRotate`. |
| `RotateOverlay` | interface | `{ id, currentPose, targetPose, originPose }` | Live overlay state exposed by `useRotate` for rendering the in-flight rotation ghost. |
| `RotateOverlay.id` | field | `string` |  |
| `RotateOverlay.currentPose` | field | `TPose` |  |
| `RotateOverlay.targetPose` | field | `TPose` |  |
| `RotateOverlay.originPose` | field | `TPose` | Origin pose at gesture start. |
| `InsertPoint` | interface | `{ x, y }` | A single world-space point. |
| `InsertPoint.x` | field | `number` |  |
| `InsertPoint.y` | field | `number` |  |
| `InsertProposed` | interface | `{ start, current, bounds, pose }` | Per-frame proposed insert: the two world points plus their derived bounds and pose. |
| `InsertProposed.start` | field | `InsertPoint` |  |
| `InsertProposed.current` | field | `InsertPoint` |  |
| `InsertProposed.bounds` | field | `ResizePose` |  |
| `InsertProposed.pose` | field | `TPose` |  |
| `InsertMoveResult` | interface | `{ start, current }` | Per-frame result an `InsertBehavior.onMove` can return to override the start/current points. |
| `InsertMoveResult.start?` | field | `InsertPoint` | Override the start point (e.g. |
| `InsertMoveResult.current?` | field | `InsertPoint` | Override the current point (e.g. |
| `InsertBehavior` | type | `GestureBehavior< TPose, InsertProposed<TPose>, InsertMoveResult >` | Behaviors operate over the two world points; bounds and pose are derived by the hook from the (possibly modified) points each frame. |
| `InsertOverlay` | interface | `{ start, current, bounds, pose }` | Live overlay state exposed by `useInsert` for rendering the in-flight insert preview. |
| `InsertOverlay.start` | field | `InsertPoint` |  |
| `InsertOverlay.current` | field | `InsertPoint` |  |
| `InsertOverlay.bounds` | field | `ResizePose` | Axis-aligned bounding rect derived from `start`/`current`. |
| `InsertOverlay.pose` | field | `TPose` | TPose constructed from `bounds` via the hook's `posefromBounds`. |
| `AreaSelectPose` | interface | `{ worldX, worldY, shiftHeld }` | Pose carried through area-select gestures: the world point under the cursor at gesture start, plus the shift-key state at start. |
| `AreaSelectPose.worldX` | field | `number` |  |
| `AreaSelectPose.worldY` | field | `number` |  |
| `AreaSelectPose.shiftHeld` | field | `boolean` |  |
| `AreaSelectProposed` | interface | `{ start, current, shiftHeld }` | Per-frame proposed area-select state: start point, current point, and shift policy. |
| `AreaSelectProposed.start` | field | `{ worldX: number; worldY: number }` |  |
| `AreaSelectProposed.current` | field | `{ worldX: number; worldY: number }` |  |
| `AreaSelectProposed.shiftHeld` | field | `boolean` |  |
| `AreaSelectMoveResult` | type | `void` | onMove for area-select doesn't shape ops; behaviors only need to react in onEnd. |
| `AreaSelectBehavior` | type | `GestureBehavior< AreaSelectPose, AreaSelectProposed, AreaSelectMoveResult >` | A behavior plugged into `useAreaSelect`. |
| `AreaSelectOverlay` | interface | `{ start, current, shiftHeld }` | Live overlay state exposed by `useAreaSelect` for rendering the marquee. |
| `AreaSelectOverlay.start` | field | `{ worldX: number; worldY: number }` |  |
| `AreaSelectOverlay.current` | field | `{ worldX: number; worldY: number }` |  |
| `AreaSelectOverlay.shiftHeld` | field | `boolean` |  |
| `ClonePose` | interface | `{ ids, offset, worldX, worldY }` | Pose carried through clone gestures: ids being cloned plus the pointer/offset state. |
| `ClonePose.ids` | field | `string[]` |  |
| `ClonePose.offset` | field | `{ dx: number; dy: number }` |  |
| `ClonePose.worldX` | field | `number` |  |
| `ClonePose.worldY` | field | `number` |  |
| `CloneLayer` | type | `'structures' \| 'zones' \| 'plantings'` | Layer category a clone targets — kit-level placeholder; consumers may narrow. |
| `CloneBehavior` | interface | `{ id, defaultTransient, activates, onEnd }` | A behavior plugged into `useClone`; gates on modifier state and emits ops at gesture end. |
| `CloneBehavior.id` | field | `string` |  |
| `CloneBehavior.defaultTransient?` | field | `boolean` | Default true. |
| `CloneBehavior.activates` | field | `(modifiers: ModifierState) => boolean` | Decides whether this gesture should activate at start. |
| `CloneBehavior.onEnd` | field | `( pose: ClonePose, ctx: { adapter: InsertAdapter<{ id: string }> }, ) => Op[]` | On end, returns ops to commit (or [] for no-op). |

## src/interactions/hit/nestedGroupHit.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `NestedGroupHitOpts` | interface | `{ composePose, poseBounds, isGroup }` |  |
| `NestedGroupHitOpts.composePose` | field | `(parent: TPose, child: TPose) => TPose` | Compose a child's local pose into world coords given its parent's world pose. |
| `NestedGroupHitOpts.poseBounds?` | field | `(pose: TPose) => RectBounds` | Derive an axis-aligned bounding rect from a (world-space) pose. |
| `NestedGroupHitOpts.isGroup?` | field | `(id: string, obj: TNode \| undefined) => boolean` | Predicate for "this object is a group body". |
| `NestedGroupHitTester` | interface | `{ pickOutermost, pickBest }` |  |
| `NestedGroupHitTester.pickOutermost` | field | `(worldX: number, worldY: number) => string \| null` | Outermost-ancestor pick. |
| `NestedGroupHitTester.pickBest` | field | `( worldX: number, worldY: number, alt: boolean, selection: readonly string[], ) => string \| null` | Alt-aware selection-update pick. |
| `nestedGroupHitTester` | function | `(adapter: HitAdapter<TNode, TPose>, opts: NestedGroupHitOpts<TNode, TPose>) => NestedGroupHitTester` |  |
| `nestedGroupHitTester.adapter` | param | `adapter: HitAdapter<TNode, TPose>` |  |
| `nestedGroupHitTester.opts` | param | `opts: NestedGroupHitOpts<TNode, TPose>` |  |

## src/interactions/usePointerGestures.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PointerGestureBindings` | interface | `{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture }` | Pointer event handlers ready to spread onto a `<canvas>`. |
| `PointerGestureBindings.onPointerDown` | field | `(e: React.PointerEvent<HTMLCanvasElement>) => void` |  |
| `PointerGestureBindings.onPointerMove` | field | `(e: React.PointerEvent<HTMLCanvasElement>) => void` |  |
| `PointerGestureBindings.onPointerUp` | field | `(e: React.PointerEvent<HTMLCanvasElement>) => void` |  |
| `PointerGestureBindings.onPointerCancel` | field | `(e: React.PointerEvent<HTMLCanvasElement>) => void` |  |
| `PointerGestureBindings.onLostPointerCapture` | field | `(e: React.PointerEvent<HTMLCanvasElement>) => void` |  |
| `PointerGestureCallbackCtx` | interface | `{ event, worldX, worldY, modifiers }` | Context object passed to body-hit / tap-empty callbacks. |
| `PointerGestureCallbackCtx.event` | field | `React.PointerEvent<HTMLCanvasElement>` |  |
| `PointerGestureCallbackCtx.worldX` | field | `number` |  |
| `PointerGestureCallbackCtx.worldY` | field | `number` |  |
| `PointerGestureCallbackCtx.modifiers` | field | `ModifierState` |  |
| `UsePointerGesturesOptions` | interface | `{ clientToWorld, move, resize, rotate, insert, areaSelect, tool, rotateTarget, rotationHandleDistance, resizeTarget, ... }` | Options for `usePointerGestures` — wires move/resize/rotate/insert/area-select controllers into a single canvas. |
| `UsePointerGesturesOptions.clientToWorld?` | field | `( canvas: HTMLCanvasElement, clientX: number, clientY: number, ) => [number, number]` | clientX/Y → world coords. |
| `UsePointerGesturesOptions.move?` | field | `MoveController<{ id: string }, TMovePose>` | Live move interaction. |
| `UsePointerGesturesOptions.resize?` | field | `ResizeController<{ id: string }, TResizePose>` | Live resize interaction. |
| `UsePointerGesturesOptions.rotate?` | field | `RotateController<{ id: string }, TResizePose>` | Live rotation interaction. |
| `UsePointerGesturesOptions.insert?` | field | `InsertController<{ id: string }, unknown>` | Live insert interaction. |
| `UsePointerGesturesOptions.areaSelect?` | field | `AreaSelectController` | Live area-select interaction. |
| `UsePointerGesturesOptions.tool?` | field | `'select' \| 'insert' \| 'none'` | Empty-space tool. |
| `UsePointerGesturesOptions.rotateTarget?` | field | `() => { id: string; bounds: Bounds; rotation?: number } \| null` | Currently rotatable target. |
| `UsePointerGesturesOptions.rotationHandleDistance?` | field | `number` | World-pixel distance from the top edge to the rotation handle. |
| `UsePointerGesturesOptions.resizeTarget?` | field | `() => { id: string; bounds: Bounds } \| null` | Currently resizable target. |
| `UsePointerGesturesOptions.handleHitRadius?` | field | `number` | Hit-test radius for resize/rotation handles, in **screen** pixels. |
| `UsePointerGesturesOptions.getView?` | field | `() => View` | Returns the current view. |
| `UsePointerGesturesOptions.pickEvery?` | field | `(worldX: number, worldY: number) => string \| string[] \| null` | Body hit-test for starting a move. |
| `UsePointerGesturesOptions.selection?` | field | `SelectionApi` | Selection api (see {@link SelectionApi}). |
| `UsePointerGesturesOptions.boundsOf?` | field | `(id: string) => Bounds \| null` | Per-id bounds lookup. |
| `UsePointerGesturesOptions.onBodyHit?` | field | `(ids: string[], ctx: PointerGestureCallbackCtx) => void` | Called whenever a body hit occurs. |
| `UsePointerGesturesOptions.onTapEmpty?` | field | `(ctx: PointerGestureCallbackCtx) => void` | Called when the pointer hits neither a handle nor a body. |
| `UsePointerGesturesOptions.debug?` | field | `DebugSink` | Optional debug sink for the overlay subsystem. |
| `usePointerGestures` | hook | `(options: UsePointerGesturesOptions<TMovePose, TResizePose>) => PointerGestureBindings` | Pointer-event dispatcher that wires `useMove` + `useResize` to a canvas. |
| `usePointerGestures.options` | param | `options: UsePointerGesturesOptions<TMovePose, TResizePose>` |  |

## src/layout/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from './types'` | reexport-all | `*` |  |
| `* from './snaps'` | reexport-all | `*` |  |
| `* from './strategies'` | reexport-all | `*` |  |

## src/layout/snaps.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `none` | function | `() => LayoutSnap<TPose>` |  |
| `nearest` | function | `() => LayoutSnap<TPose>` |  |
| `nearestWithin` | function | `(opts: { tolerance: number }) => LayoutSnap<TPose>` |  |
| `nearestWithin.opts` | param | `opts: { tolerance: number }` |  |
| `containedThenNearest` | function | `() => LayoutSnap<TPose>` | Region-aware snap. |
| `cellAt` | function | `() => LayoutSnap<TPose>` | Backwards-compatible cell snap. |

## src/layout/strategies/freeform.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `FreeformOptions` | interface | `{ snap }` |  |
| `FreeformOptions.snap?` | field | `LayoutSnap<TPose>` |  |
| `freeform` | function | `(opts: FreeformOptions<TPose> = {}) => LayoutStrategy<TPose>` | Identity layout: each child stays where it's stored, no reflow, no drop targets. |
| `freeform.opts` | param | `opts: FreeformOptions<TPose> = {}` |  |

## src/layout/strategies/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `freeform` | reexport | `re-export from './freeform'` |  |
| `FreeformOptions` | reexport | `re-export from './freeform'` |  |
| `tileGrid` | reexport | `re-export from './tileGrid'` |  |
| `TileGridOptions` | reexport | `re-export from './tileGrid'` |  |
| `snapPoint` | reexport | `re-export from './snapPoint'` |  |
| `SnapPointOptions` | reexport | `re-export from './snapPoint'` |  |

## src/layout/strategies/snapPoint.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `SnapPointOptions` | interface | `{ pattern, gridSpacing, tolerance, snap }` |  |
| `SnapPointOptions.pattern` | field | `SnapPattern` |  |
| `SnapPointOptions.gridSpacing?` | field | `number` | Spacing for the 'grid' pattern, in world units. |
| `SnapPointOptions.tolerance?` | field | `number` | Tolerance for the default snap policy (nearestWithin). |
| `SnapPointOptions.snap?` | field | `LayoutSnap<TPose>` |  |
| `snapPoint` | function | `(opts: SnapPointOptions<TPose>) => LayoutStrategy<TPose>` |  |
| `snapPoint.opts` | param | `opts: SnapPointOptions<TPose>` |  |

## src/layout/strategies/tileGrid.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `TileGridOptions` | interface | `{ cols, rows, gap, snap, cellToPose }` |  |
| `TileGridOptions.cols` | field | `number` |  |
| `TileGridOptions.rows` | field | `number` |  |
| `TileGridOptions.gap?` | field | `number` | Gap between cells, in world units. |
| `TileGridOptions.snap?` | field | `LayoutSnap<TPose>` |  |
| `TileGridOptions.cellToPose?` | field | `TPose` | Optional: map a cell rect + the dragged pose to the new pose. |
| `tileGrid` | function | `(opts: TileGridOptions<TPose>) => LayoutStrategy<TPose>` |  |
| `tileGrid.opts` | param | `opts: TileGridOptions<TPose>` |  |

## src/layout/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ContainerBounds` | type | `{ x: number; y: number; width: number; height: number; }` |  |
| `ContainerBounds.x` | field | `number` |  |
| `ContainerBounds.y` | field | `number` |  |
| `ContainerBounds.width` | field | `number` |  |
| `ContainerBounds.height` | field | `number` |  |
| `LayoutChild` | interface | `{ id, pose }` |  |
| `LayoutChild.id` | field | `string` |  |
| `LayoutChild.pose` | field | `TPose` |  |
| `DropTarget` | interface | `{ pose, origin, hitBounds, meta }` |  |
| `DropTarget.pose` | field | `TPose` | Where the dragged child lands if this target is picked. |
| `DropTarget.origin` | field | `{ x: number; y: number }` | Reference point for distance metrics (snap algorithms). |
| `DropTarget.hitBounds?` | field | `{ x: number; y: number; width: number; height: number }` | Optional axis-aligned region (world units) used by region-aware snaps (e.g. |
| `DropTarget.meta?` | field | `unknown` | Strategy-private metadata (e.g. |
| `LayoutSnap` | interface | `{ pickTarget }` |  |
| `LayoutSnap.pickTarget` | field | `DropTarget<TPose> \| null` |  |
| `LayoutContainer` | interface | `{ id, bounds }` |  |
| `LayoutContainer.id` | field | `string` |  |
| `LayoutContainer.bounds` | field | `ContainerBounds` |  |
| `LayoutDragged` | interface | `{ id, originPose, pose, sourceContainerId }` |  |
| `LayoutDragged.id` | field | `string` |  |
| `LayoutDragged.originPose` | field | `TPose` | The pose the dragged child currently has (pre-drop). |
| `LayoutDragged.pose` | field | `TPose` | The pose the gesture proposes (pointer-driven, pre-snap). |
| `LayoutDragged.sourceContainerId` | field | `string \| null` |  |
| `LayoutStrategy` | interface | `{ getChildPositions, getDropTargets, reflowFor, commitDrop, snap, contains }` |  |
| `LayoutStrategy.getChildPositions` | field | `Map<string, TPose>` |  |
| `LayoutStrategy.getDropTargets` | field | `DropTarget<TPose>[]` |  |
| `LayoutStrategy.reflowFor` | field | `Map<string, TPose>` |  |
| `LayoutStrategy.commitDrop` | field | `Op[]` |  |
| `LayoutStrategy.snap` | field | `LayoutSnap<TPose>` |  |
| `LayoutStrategy.contains?` | field | `boolean` | Optional: predicate for whether a world-space point is inside this container. |

## src/subpaths/clipboard.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from '../interactions/actions/clipboard'` | reexport-all | `*` |  |

## src/subpaths/clone.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from '../interactions/gestures/clone'` | reexport-all | `*` |  |

## src/subpaths/insert.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from '../interactions/gestures/insert'` | reexport-all | `*` |  |

## src/subpaths/move.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from '../interactions/gestures/move'` | reexport-all | `*` |  |

## src/subpaths/patterns-builtin.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from '../features/patterns/patterns-builtin'` | reexport-all | `*` |  |

## src/subpaths/resize.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `* from '../interactions/gestures/resize'` | reexport-all | `*` |  |

## src/tools/builtin/hitExistingGate.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `applyHitExistingGate` | function | `(ctx: ToolCtx<unknown>, hitExisting: \| ((p: { x: number; y: number }) => string \| string[] \| null) \| undefined) => boolean` | Hit-existing gate shared by the drag-insert tool hooks. |
| `applyHitExistingGate.ctx` | param | `ctx: ToolCtx<unknown>` |  |
| `applyHitExistingGate.hitExisting` | param | `hitExisting: \| ((p: { x: number; y: number }) => string \| string[] \| null) \| undefined` |  |

## src/tools/builtin/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useDeleteTool` | reexport | `re-export from './useDeleteTool'` |  |
| `UseDeleteToolOptions` | reexport | `re-export from './useDeleteTool'` |  |
| `useNudgeTool` | reexport | `re-export from './useNudgeTool'` |  |
| `UseNudgeToolOptions` | reexport | `re-export from './useNudgeTool'` |  |
| `useUndoRedoTool` | reexport | `re-export from './useUndoRedoTool'` |  |
| `UseUndoRedoToolOptions` | reexport | `re-export from './useUndoRedoTool'` |  |
| `useDuplicateTool` | reexport | `re-export from './useDuplicateTool'` |  |
| `UseDuplicateToolOptions` | reexport | `re-export from './useDuplicateTool'` |  |
| `useInsertTool` | reexport | `re-export from './useInsertTool'` |  |
| `UseInsertToolOptions` | reexport | `re-export from './useInsertTool'` |  |
| `useSelectTool` | reexport | `re-export from './useSelectTool'` |  |
| `UseSelectToolOptions` | reexport | `re-export from './useSelectTool'` |  |
| `AreaSelectOverlayStyle` | reexport | `re-export from './useSelectTool'` |  |
| `MoveOverlayStyle` | reexport | `re-export from './useSelectTool'` |  |
| `ResizeOverlayStyle` | reexport | `re-export from './useSelectTool'` |  |
| `RotateOverlayStyle` | reexport | `re-export from './useSelectTool'` |  |
| `pickTopMostHit` | reexport | `re-export from './pickTopMostHit'` |  |
| `PickTopMostHitAdapter` | reexport | `re-export from './pickTopMostHit'` |  |
| `applyHitExistingGate` | reexport | `re-export from './hitExistingGate'` |  |
| `useHandTool` | reexport | `re-export from './useHandTool'` |  |
| `useTextTool` | reexport | `re-export from './useTextTool'` |  |
| `UseTextToolOptions` | reexport | `re-export from './useTextTool'` |  |
| `useWheelZoomTool` | reexport | `re-export from './useWheelZoomTool'` |  |
| `WheelZoomToolOpts` | reexport | `re-export from './useWheelZoomTool'` |  |
| `useWheelPanTool` | reexport | `re-export from './useWheelPanTool'` |  |
| `useKeyboardZoomTool` | reexport | `re-export from './useKeyboardZoomTool'` |  |
| `KeyboardZoomToolOpts` | reexport | `re-export from './useKeyboardZoomTool'` |  |
| `useUserPenTool` | reexport | `re-export from './useUserPenTool'` |  |
| `UseUserPenToolOptions` | reexport | `re-export from './useUserPenTool'` |  |
| `PenScratch` | reexport | `re-export from './useUserPenTool'` |  |
| `PenAnchor` | reexport | `re-export from './useUserPenTool'` |  |
| `PenSubpath` | reexport | `re-export from './useUserPenTool'` |  |
| `useEditAnchorsTool` | reexport | `re-export from './useEditAnchorsTool'` |  |
| `UseEditAnchorsToolOptions` | reexport | `re-export from './useEditAnchorsTool'` |  |
| `EditAnchorsScratch` | reexport | `re-export from './useEditAnchorsTool'` |  |
| `useSelectWithAnchorEdit` | reexport | `re-export from './useSelectWithAnchorEdit'` |  |
| `UseSelectWithAnchorEditOptions` | reexport | `re-export from './useSelectWithAnchorEdit'` |  |
| `UseSelectWithAnchorEditReturn` | reexport | `re-export from './useSelectWithAnchorEdit'` |  |
| `SelectWithAnchorEditAdapter` | reexport | `re-export from './useSelectWithAnchorEdit'` |  |
| `SelectWithAnchorEditAnchorsOptions` | reexport | `re-export from './useSelectWithAnchorEdit'` |  |
| `useCloneTool` | reexport | `re-export from './useCloneTool'` |  |
| `UseCloneToolOptions` | reexport | `re-export from './useCloneTool'` |  |
| `CloneScratch` | reexport | `re-export from './useCloneTool'` |  |
| `CloneOverlayItem` | reexport | `re-export from './useCloneTool'` |  |

## src/tools/builtin/marquee.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `InsertOverlayStyle` | interface | `{ fill, stroke, dash, lineWidth }` |  |
| `InsertOverlayStyle.fill?` | field | `string` |  |
| `InsertOverlayStyle.stroke?` | field | `string` |  |
| `InsertOverlayStyle.dash?` | field | `number[]` |  |
| `InsertOverlayStyle.lineWidth?` | field | `number` |  |
| `drawMarquee` | function | `(ctx: CanvasRenderingContext2D, view: View, bounds: { x: number; y: number; width: number; height: number }, style: InsertOverlayStyle \| undefined, defaults: MarqueeDefaults) => void` | Paints a dashed marquee rectangle in screen space. |
| `drawMarquee.ctx` | param | `ctx: CanvasRenderingContext2D` |  |
| `drawMarquee.view` | param | `view: View` |  |
| `drawMarquee.bounds` | param | `bounds: { x: number; y: number; width: number; height: number }` |  |
| `drawMarquee.style` | param | `style: InsertOverlayStyle \| undefined` |  |
| `drawMarquee.defaults` | param | `defaults: MarqueeDefaults` |  |

## src/tools/builtin/pickTopMostHit.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PickTopMostHitAdapter` | interface | `{ getParent }` | Pick the topmost id from a body-hit list, using whatever signal the adapter exposes. |
| `PickTopMostHitAdapter.getParent?` | field | `(id: string) => string \| null` |  |
| `pickTopMostHit` | function | `(ids: readonly string[], adapter: PickTopMostHitAdapter \| undefined \| null) => string \| null` |  |
| `pickTopMostHit.ids` | param | `ids: readonly string[]` |  |
| `pickTopMostHit.adapter` | param | `adapter: PickTopMostHitAdapter \| undefined \| null` |  |

## src/tools/builtin/testUtils.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `makeCtx` | function | `(over: Partial<ToolCtx<S>> = {}) => ToolCtx<S>` | Build a minimal ToolCtx for tool-hook unit tests. |
| `makeCtx.over` | param | `over: Partial<ToolCtx<S>> = {}` |  |
| `pe` | function | `(type = 'pointerdown') => PointerEvent` | A synthetic PointerEvent stand-in for handler signatures that don't inspect the event. |
| `pe.type` | param | `type = 'pointerdown'` |  |

## src/tools/builtin/useCloneTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `CloneOverlayItem` | interface | `{ id, x, y }` | Live preview item published by useClone — `{id, x, y}` (snapshot pose translated by the in-flight drag offset). |
| `CloneOverlayItem.id` | field | `string` |  |
| `CloneOverlayItem.x` | field | `number` |  |
| `CloneOverlayItem.y` | field | `number` |  |
| `CloneScratch` | interface | `{ pendingId, pendingMods }` |  |
| `CloneScratch.pendingId` | field | `string \| null` | Id captured by pickBest on pointer.onDown; passed to clone.start at threshold-cross. |
| `CloneScratch.pendingMods` | field | `ModifierState \| null` | Modifier snapshot at down — replayed into clone.start so the behavior's `activates()` decision uses the down-time state, not whatever modifiers happen to be hel |
| `UseCloneToolOptions` | interface | `{ behaviors, pickBest, drawGhost, drawOne, layer, expandIds, id, cursor }` |  |
| `UseCloneToolOptions.behaviors` | field | `CloneBehavior[]` | Clone behaviors (e.g. |
| `UseCloneToolOptions.pickBest?` | field | `(worldX: number, worldY: number) => string \| null` | Hit-test the world point and return the topmost cloneable id, or null if the pointer didn't land on anything cloneable. |
| `UseCloneToolOptions.drawGhost?` | field | `(cx: CanvasRenderingContext2D, items: CloneOverlayItem[], view: View) => void` | Render the in-flight clone ghost. |
| `UseCloneToolOptions.drawOne?` | field | `(cx: CanvasRenderingContext2D, obj: T, pose: TPose, view: View) => void` | Scene `drawOne` (the same render fn passed to `<Canvas layers={{ scene: { drawOne } }}>`). |
| `UseCloneToolOptions.layer?` | field | `CloneLayer` | CloneLayer category passed to `clone.start`. |
| `UseCloneToolOptions.expandIds?` | field | `UseCloneOptions['expandIds']` | Optional id-list expansion (e.g. |
| `UseCloneToolOptions.id?` | field | `string` | Tool id. |
| `UseCloneToolOptions.cursor?` | field | `string` | Cursor while the activating modifier is held. |
| `useCloneTool` | hook | `(adapter: InsertAdapter<T>, options: UseCloneToolOptions<T, TPose>) => Tool<CloneScratch>` | Wraps `useClone` as a Tool record. |
| `useCloneTool.adapter` | param | `adapter: InsertAdapter<T>` |  |
| `useCloneTool.options` | param | `options: UseCloneToolOptions<T, TPose>` |  |

## src/tools/builtin/useDeleteTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseDeleteToolOptions` | interface | `{  }` |  |
| `useDeleteTool` | hook | `(adapter: DeleteAdapter, options: UseDeleteToolOptions = {}) => Tool<undefined>` | Always-on Tool wrapping `useDelete`. |
| `useDeleteTool.adapter` | param | `adapter: DeleteAdapter` |  |
| `useDeleteTool.options` | param | `options: UseDeleteToolOptions = {}` |  |

## src/tools/builtin/useDuplicateTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseDuplicateToolOptions` | interface | `{  }` |  |
| `useDuplicateTool` | hook | `(adapter: DuplicateAdapter<TPose>, options: UseDuplicateToolOptions = {}) => Tool<undefined>` | Always-on Tool wrapping `useDuplicate`. |
| `useDuplicateTool.adapter` | param | `adapter: DuplicateAdapter<TPose>` |  |
| `useDuplicateTool.options` | param | `options: UseDuplicateToolOptions = {}` |  |

## src/tools/builtin/useEditAnchorsTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `EditAnchorsScratch` | interface | `{ pendingStart }` |  |
| `EditAnchorsScratch.pendingStart` | field | `EditAnchorsStartArgs \| null` | Captured on pointer.onDown when the down landed on an anchor or control. |
| `UseEditAnchorsToolOptions` | interface | `{ id, keybinding, cursor, overlayStyle, onExit }` |  |
| `UseEditAnchorsToolOptions.id?` | field | `string` | Tool id. |
| `UseEditAnchorsToolOptions.keybinding?` | field | `string` | Keybinding. |
| `UseEditAnchorsToolOptions.cursor?` | field | `string` | Cursor. |
| `UseEditAnchorsToolOptions.overlayStyle?` | field | `Partial<Omit<AnchorEditOverlayOpts, 'getOverlay'>>` | Visual style overrides for the anchor-edit overlay. |
| `UseEditAnchorsToolOptions.onExit?` | field | `() => void` | Optional callback for Escape — consumers typically clear their `editingId` state to exit edit mode entirely. |
| `useEditAnchorsTool` | hook | `(controller: EditAnchorsController<TNode>, options: UseEditAnchorsToolOptions = {}) => Tool<EditAnchorsScratch>` | Wraps `useEditAnchors` as a Tool record so anchor-editing becomes an active-slot tool. |
| `useEditAnchorsTool.controller` | param | `controller: EditAnchorsController<TNode>` |  |
| `useEditAnchorsTool.options` | param | `options: UseEditAnchorsToolOptions = {}` |  |

## src/tools/builtin/useHandTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useHandTool` | hook | `() => Tool<HandScratch \| null>` | Pan-on-drag tool. |

## src/tools/builtin/useInsertTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `InsertOverlayStyle` | reexport | `re-export of InsertOverlayStyle` |  |
| `UseInsertToolOptions` | interface | `{ overlayStyle, hitExisting }` |  |
| `UseInsertToolOptions.overlayStyle?` | field | `InsertOverlayStyle` |  |
| `UseInsertToolOptions.hitExisting?` | field | `(point: { x: number; y: number }) => string \| string[] \| null` | Hit-test gate consulted before insertion. |
| `useInsertTool` | hook | `(adapter: InsertAdapter<TNode>, options: UseInsertToolOptions<TPose, TNode> = {}) => Tool<undefined>` | Active-slot Tool wrapping `useInsert`. |
| `useInsertTool.adapter` | param | `adapter: InsertAdapter<TNode>` |  |
| `useInsertTool.options` | param | `options: UseInsertToolOptions<TPose, TNode> = {}` |  |

## src/tools/builtin/useKeyboardZoomTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `KeyboardZoomToolOpts` | interface | `{ min, max, keyStep }` |  |
| `KeyboardZoomToolOpts.min?` | field | `number` |  |
| `KeyboardZoomToolOpts.max?` | field | `number` |  |
| `KeyboardZoomToolOpts.keyStep?` | field | `number` | Multiplicative step per Cmd+= / Cmd+- press. |
| `useKeyboardZoomTool` | hook | `(opts: KeyboardZoomToolOpts = {}) => Tool<null>` | Always-on tool: claims `Cmd+=` (zoom in), `Cmd+-` (zoom out), `Cmd+0` (reset). |
| `useKeyboardZoomTool.opts` | param | `opts: KeyboardZoomToolOpts = {}` |  |

## src/tools/builtin/useNudgeTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseNudgeToolOptions` | interface | `{  }` |  |
| `useNudgeTool` | hook | `(adapter: NudgeAdapter<TPose>, options: UseNudgeToolOptions<TPose> = {}) => Tool<undefined>` | Always-on Tool wrapping `useNudge`. |
| `useNudgeTool.adapter` | param | `adapter: NudgeAdapter<TPose>` |  |
| `useNudgeTool.options` | param | `options: UseNudgeToolOptions<TPose> = {}` |  |

## src/tools/builtin/useSelectTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Bounds` | interface | `{ x, y, width, height }` | World-space bounding rect for hit-testing handles. |
| `Bounds.x` | field | `number` |  |
| `Bounds.y` | field | `number` |  |
| `Bounds.width` | field | `number` |  |
| `Bounds.height` | field | `number` |  |
| `AreaSelectOverlayStyle` | interface | `{ fill, stroke, dash, lineWidth }` |  |
| `AreaSelectOverlayStyle.fill?` | field | `string` |  |
| `AreaSelectOverlayStyle.stroke?` | field | `string` |  |
| `AreaSelectOverlayStyle.dash?` | field | `number[]` |  |
| `AreaSelectOverlayStyle.lineWidth?` | field | `number` |  |
| `MoveOverlayStyle` | interface | `{ ghostAlpha }` |  |
| `MoveOverlayStyle.ghostAlpha?` | field | `number` |  |
| `ResizeOverlayStyle` | interface | `{ ghostAlpha }` |  |
| `ResizeOverlayStyle.ghostAlpha?` | field | `number` |  |
| `RotateOverlayStyle` | interface | `{ ghostAlpha }` |  |
| `RotateOverlayStyle.ghostAlpha?` | field | `number` |  |
| `UseSelectToolOptions` | interface | `{ pickEvery, pickBest, boundsOf, handleHitRadius, rotationHandleDistance, move, resize, rotate, areaSelect, debug, ... }` |  |
| `UseSelectToolOptions.pickEvery` | field | `(worldX: number, worldY: number) => string[]` | Return ids of all objects whose painted body covers (worldX, worldY). |
| `UseSelectToolOptions.pickBest?` | field | `( worldX: number, worldY: number, alt: boolean, selection: readonly string[], ) => string \| null` | Optional alt-aware selection-update hit returning the single id the click should act on. |
| `UseSelectToolOptions.boundsOf` | field | `(id: string) => Bounds \| null` | Return the world-space bounds of `id`, or null if not found. |
| `UseSelectToolOptions.handleHitRadius?` | field | `number` | Square hit-radius for corner resize handles. |
| `UseSelectToolOptions.rotationHandleDistance?` | field | `number` | Distance from top edge of bounds to rotation handle center. |
| `UseSelectToolOptions.move?` | field | `UseMoveOptions<TPose>` |  |
| `UseSelectToolOptions.resize?` | field | `UseResizeOptions<TPose>` |  |
| `UseSelectToolOptions.rotate?` | field | `UseRotateOptions<TPose>` |  |
| `UseSelectToolOptions.areaSelect?` | field | `UseAreaSelectOptions` |  |
| `UseSelectToolOptions.debug?` | field | `DebugSink` | Optional debug sink. |
| `UseSelectToolOptions.areaSelectOverlayStyle?` | field | `AreaSelectOverlayStyle` | Style for the area-select marquee. |
| `UseSelectToolOptions.moveOverlayStyle?` | field | `MoveOverlayStyle` | Style for the move ghost (currently just `ghostAlpha`). |
| `UseSelectToolOptions.resizeOverlayStyle?` | field | `ResizeOverlayStyle` | Style for the resize ghost. |
| `UseSelectToolOptions.rotateOverlayStyle?` | field | `RotateOverlayStyle` | Style for the rotate ghost. |
| `UseSelectToolOptions.drawGhost?` | field | `( ctx: CanvasRenderingContext2D, obj: TNode \| null, pose: TPose, view: { x: number; y: number; scale: number }, ) => void` | Consumer's draw function for ghost objects (move/resize/rotate in-flight). |
| `UseSelectToolOptions.getNode?` | field | `(id: string) => TNode \| null` | Object lookup for the ghost render, paired with `drawGhost`. |
| `UseSelectToolOptions.onDoubleTap?` | field | `(args: { worldX: number; worldY: number; ids: string[]; event: PointerEvent; }) => void` | Optional double-tap hook. |
| `SelectScratch` | type | `\| { kind: 'idle' } \| { kind: 'move'; ids: string[] } \| { kind: 'resize'; targetId: string; anchor: ResizeAnchor } \| { kind: 'rotate'; targetId: string } \| { kind: 'area' }` |  |
| `useSelectTool` | hook | `(adapter: SelectAdapter<TNode, TPose>, options: UseSelectToolOptions<TNode, TPose>) => Tool<SelectScratch>` | Active-slot Tool wrapping `useMove`/`useResize`/`useRotate`/`useAreaSelect`. |
| `useSelectTool.adapter` | param | `adapter: SelectAdapter<TNode, TPose>` |  |
| `useSelectTool.options` | param | `options: UseSelectToolOptions<TNode, TPose>` |  |

## src/tools/builtin/useSelectWithAnchorEdit.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `SelectWithAnchorEditAdapter` | type | `& MoveAdapter<TNode, TPose> & ResizeAdapter<TNode, TPose> & RotateAdapter<TNode, TPose> & AreaSelectAdapter & EditAnchorsAdapter<TNode>` | Adapter intersection required for the inner select tool plus the edit-anchors controller. |
| `SelectWithAnchorEditAnchorsOptions` | interface | `{ hitRadius, editLabel, toolId, keybinding, cursor, overlayStyle }` | Sub-options forwarded to `useEditAnchors` + `useEditAnchorsTool`. |
| `SelectWithAnchorEditAnchorsOptions.hitRadius?` | field | `number` | World-space hit radius for anchor + control handles. |
| `SelectWithAnchorEditAnchorsOptions.editLabel?` | field | `UseEditAnchorsOptions['editLabel']` | History label for the anchor-edit transform. |
| `SelectWithAnchorEditAnchorsOptions.toolId?` | field | `UseEditAnchorsToolOptions['id']` | Tool id for the edit-anchors slot. |
| `SelectWithAnchorEditAnchorsOptions.keybinding?` | field | `UseEditAnchorsToolOptions['keybinding']` | Tool keybinding. |
| `SelectWithAnchorEditAnchorsOptions.cursor?` | field | `UseEditAnchorsToolOptions['cursor']` | Tool cursor. |
| `SelectWithAnchorEditAnchorsOptions.overlayStyle?` | field | `UseEditAnchorsToolOptions['overlayStyle']` | Visual style overrides for the anchor-edit overlay. |
| `UseSelectWithAnchorEditOptions` | interface | `{ editAnchors, editingFilter, clientToWorld }` | Options for the modal select-with-anchor-edit helper. |
| `UseSelectWithAnchorEditOptions.editAnchors?` | field | `SelectWithAnchorEditAnchorsOptions` | Edit-anchors sub-options (hit radius, overlay style, etc.). |
| `UseSelectWithAnchorEditOptions.editingFilter?` | field | `(ids: readonly string[]) => string \| null` | Filter applied to the ids `pickEvery` returns at the double-click point. |
| `UseSelectWithAnchorEditOptions.clientToWorld?` | field | `(canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number]` | Convert client (event) coords to world coords for the double-click hit test. |
| `UseSelectWithAnchorEditReturn` | interface | `{ tools, onDoubleClick, editingId }` | Return shape: a tools API for `<Canvas tools={...}>` plus a double-click handler the consumer wires to the wrapping element. |
| `UseSelectWithAnchorEditReturn.tools` | field | `ToolsApi` | Tools API — pass straight to `<Canvas tools={tools}>`. |
| `UseSelectWithAnchorEditReturn.onDoubleClick` | field | `(e: React.MouseEvent<HTMLElement>) => void` | Wrap the canvas container with this on `onDoubleClick`. |
| `UseSelectWithAnchorEditReturn.editingId` | field | `string \| null` | Currently editing id, if any — exposed for consumer UI (status bars, cursor hints). |
| `useSelectWithAnchorEdit` | hook | `(adapter: SelectWithAnchorEditAdapter<TNode, TPose>, options: UseSelectWithAnchorEditOptions<TNode, TPose>) => UseSelectWithAnchorEditReturn` | Compose `useSelectTool` + `useEditAnchors` + `useEditAnchorsTool` + `useTools` with the modal "double-click to enter anchor edit, Escape to exit" state machine  |
| `useSelectWithAnchorEdit.adapter` | param | `adapter: SelectWithAnchorEditAdapter<TNode, TPose>` |  |
| `useSelectWithAnchorEdit.options` | param | `options: UseSelectWithAnchorEditOptions<TNode, TPose>` |  |

## src/tools/builtin/useTextTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseTextToolOptions` | interface | `{ pointInsert, commitInsert, hitExisting, minBounds, marqueeStyle }` |  |
| `UseTextToolOptions.pointInsert` | field | `(point: { x: number; y: number }) => TNode \| null` | Click / sub-threshold-drag insertion. |
| `UseTextToolOptions.commitInsert?` | field | `InsertAdapter<TNode>['commitInsert']` | Optional drag-to-size path. |
| `UseTextToolOptions.hitExisting?` | field | `(point: { x: number; y: number }) => string \| string[] \| null` | Hit-test gate consulted before insertion. |
| `UseTextToolOptions.minBounds?` | field | `{ width: number; height: number }` | Threshold below which a drag falls back to `pointInsert`. |
| `UseTextToolOptions.marqueeStyle?` | field | `InsertOverlayStyle` | Style for the drag-to-size marquee preview. |
| `useTextTool` | hook | `(options: UseTextToolOptions<TNode>) => Tool<undefined>` | Active-slot Tool: click to create a new text object at the cursor; optionally drag to size its bounding box. |
| `useTextTool.options` | param | `options: UseTextToolOptions<TNode>` |  |

## src/tools/builtin/useUndoRedoTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseUndoRedoToolOptions` | interface | `{  }` |  |
| `useUndoRedoTool` | hook | `(adapter: UndoRedoAdapter, options: UseUndoRedoToolOptions = {}) => Tool<undefined>` | Always-on Tool wrapping `useUndoRedo`. |
| `useUndoRedoTool.adapter` | param | `adapter: UndoRedoAdapter` |  |
| `useUndoRedoTool.options` | param | `options: UseUndoRedoToolOptions = {}` |  |

## src/tools/builtin/useUserPenTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `PenAnchor` | interface | `{ x, y, outHandle, inHandle, altBroken }` | In-progress pen anchor. |
| `PenAnchor.x` | field | `number` |  |
| `PenAnchor.y` | field | `number` |  |
| `PenAnchor.outHandle?` | field | `{ x: number; y: number }` |  |
| `PenAnchor.inHandle?` | field | `{ x: number; y: number }` |  |
| `PenAnchor.altBroken?` | field | `boolean` | True when Alt was held during the outgoing-handle drag — the next anchor's incoming handle is NOT mirrored from this one. |
| `PenSubpath` | interface | `{ anchors, closed }` |  |
| `PenSubpath.anchors` | field | `PenAnchor[]` |  |
| `PenSubpath.closed` | field | `boolean` |  |
| `PenScratch` | interface | `{ finishedSubpaths, current, cursor, draggingHandleAt, closeHintActive, _pendingDown, _lastClick }` | Mutable scratch shared across pen-tool gestures. |
| `PenScratch.finishedSubpaths` | field | `PenSubpath[]` |  |
| `PenScratch.current` | field | `PenSubpath \| null` |  |
| `PenScratch.cursor` | field | `{ x: number; y: number } \| null` |  |
| `PenScratch.draggingHandleAt` | field | `number \| null` |  |
| `PenScratch.closeHintActive` | field | `boolean` |  |
| `PenScratch._pendingDown` | field | `{ worldX: number; worldY: number; alt: boolean; shift: boolean } \| null` | Pointer-down world coords + modifiers, captured on every pointer.onDown. |
| `PenScratch._lastClick` | field | `{ t: number; x: number; y: number } \| null` | Timestamp + world coords of the most recent click, used to detect a double-click on the last placed anchor (Illustrator convention for open-finish). |
| `UseUserPenToolOptions` | interface | `{ wrapPath, adapter, autoSelect, closeHitRadius, snapPoint }` |  |
| `UseUserPenToolOptions.wrapPath` | field | `(path: PolygonPath, opts: { closed: boolean }) => TPose` | Wrap a finished PolygonPath in the consumer's pose type. |
| `UseUserPenToolOptions.adapter` | field | `{ addNode: (pose: TPose) => string; setSelection: (ids: string[]) => void; }` | Insert + select adapter. |
| `UseUserPenToolOptions.autoSelect?` | field | `boolean` | Auto-select the new object after commit. |
| `UseUserPenToolOptions.closeHitRadius?` | field | `number` | Screen-px hit radius for "click first anchor to close". |
| `UseUserPenToolOptions.snapPoint?` | field | `(p: { x: number; y: number }) => { x: number; y: number }` | Optional point snapper applied to every world-space coordinate the pen records or previews — anchor positions (corner clicks, smooth- drag base point), the rubb |
| `useUserPenTool` | hook | `(options: UseUserPenToolOptions<TPose>) => Tool<PenScratch>` | Active-slot Tool: click + drag to build a `PolygonPath` Illustrator-style. |
| `useUserPenTool.options` | param | `options: UseUserPenToolOptions<TPose>` |  |

## src/tools/builtin/useWheelPanTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `useWheelPanTool` | hook | `() => Tool<null>` | Always-on tool: claims wheel events when `ctrlKey` is false (plain wheel + horizontal trackpad scroll). |

## src/tools/builtin/useWheelZoomTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `WheelZoomToolOpts` | interface | `{ min, max, wheelStep }` |  |
| `WheelZoomToolOpts.min?` | field | `number` |  |
| `WheelZoomToolOpts.max?` | field | `number` |  |
| `WheelZoomToolOpts.wheelStep?` | field | `number` | Multiplicative step per 100px of wheel delta. |
| `useWheelZoomTool` | hook | `(opts: WheelZoomToolOpts = {}) => Tool<null>` | Always-on tool: claims wheel events when `ctrlKey` is true (covers Cmd+wheel on macOS *and* trackpad pinch, which the browser synthesizes as ctrl+wheel). |
| `useWheelZoomTool.opts` | param | `opts: WheelZoomToolOpts = {}` |  |

## src/tools/defineTool.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `defineTool` | function | `(spec: Tool<TScratch>) => Tool<TScratch>` | Identity helper for declaring a `Tool`. |
| `defineTool.spec` | param | `spec: Tool<TScratch>` |  |

## src/tools/dispatcher.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `ToolsDispatcherOptions` | interface | `{ getSlots, getCtx, threshold, onGestureChange, now, dblTap }` |  |
| `ToolsDispatcherOptions.getSlots` | field | `() => SlotsState` | Called on every event to read the current slot occupants. |
| `ToolsDispatcherOptions.getCtx` | field | `(overrides?: { clientX?: number; clientY?: number; modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean }; }) => Omit<ToolCtx, 'scratch'>` | Called once per channel-handler invocation to construct the ctx the handler receives. |
| `ToolsDispatcherOptions.threshold?` | field | `number` | Pixel distance the pointer must travel before a click is reclassified as a drag. |
| `ToolsDispatcherOptions.onGestureChange?` | field | `() => void` | Optional callback fired whenever an in-flight gesture starts or ends (including phase transitions pending → drag → end/cancel). |
| `ToolsDispatcherOptions.now?` | field | `() => number` | Time source for double-tap detection. |
| `ToolsDispatcherOptions.dblTap?` | field | `{ /** Maximum interval between the two taps (ms). Default 300. */ windowMs?: number; /** Maximum CSS-px distance between the two tap positions. Default 8. */ maxDistance?: number; }` | Double-tap detection thresholds. |
| `ToolsDispatcher` | interface | `{ onPointerDown, onPointerMove, onPointerUp, onKeyDown, onKeyUp, onWheel, cancelGesture, hasActiveGesture, getActiveScratch }` |  |
| `ToolsDispatcher.onPointerDown` | field | `(e: PointerEvent) => void` |  |
| `ToolsDispatcher.onPointerMove` | field | `(e: PointerEvent) => void` |  |
| `ToolsDispatcher.onPointerUp` | field | `(e: PointerEvent) => void` |  |
| `ToolsDispatcher.onKeyDown` | field | `(e: KeyboardEvent) => void` |  |
| `ToolsDispatcher.onKeyUp` | field | `(e: KeyboardEvent) => void` |  |
| `ToolsDispatcher.onWheel` | field | `(e: WheelEvent) => void` |  |
| `ToolsDispatcher.cancelGesture` | field | `() => void` | Force-cancel any in-flight gesture (used on explicit tool switch). |
| `ToolsDispatcher.hasActiveGesture` | field | `() => boolean` | Whether a gesture is currently in flight. |
| `ToolsDispatcher.getActiveScratch` | field | `() => unknown` | Scratch of the in-flight gesture, or `null` when idle. |
| `createToolsDispatcher` | function | `(opts: ToolsDispatcherOptions) => ToolsDispatcher` |  |
| `createToolsDispatcher.opts` | param | `opts: ToolsDispatcherOptions` |  |

## src/tools/index.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `defineTool` | reexport | `re-export from './defineTool'` |  |
| `useTools` | reexport | `re-export from './useTools'` |  |
| `UseToolsOptions` | reexport | `re-export from './useTools'` |  |
| `ToolsApi` | reexport | `re-export from './useTools'` |  |
| `useKeybindings` | reexport | `re-export from './useKeybindings'` |  |
| `UseKeybindingsOptions` | reexport | `re-export from './useKeybindings'` |  |
| `createToolsDispatcher` | reexport | `re-export from './dispatcher'` |  |
| `ToolsDispatcher` | reexport | `re-export from './dispatcher'` |  |
| `Tool` | reexport | `re-export from './types'` |  |
| `AnyTool` | reexport | `re-export from './types'` |  |
| `ToolCtx` | reexport | `re-export from './types'` |  |
| `ToolModifiers` | reexport | `re-export from './types'` |  |
| `ToolSlot` | reexport | `re-export from './types'` |  |
| `Decision` | reexport | `re-export from './types'` |  |
| `ModifierTrigger` | reexport | `re-export from './types'` |  |
| `PointerChannel` | reexport | `re-export from './types'` |  |
| `DragChannel` | reexport | `re-export from './types'` |  |
| `KeyboardChannel` | reexport | `re-export from './types'` |  |
| `WheelChannel` | reexport | `re-export from './types'` |  |
| `* from './builtin'` | reexport-all | `*` |  |

## src/tools/types.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `Decision` | type | `'claim' \| 'pass' \| void` | Outcome of a channel handler. |
| `ToolModifiers` | interface | `{ alt, shift, meta, ctrl, space }` | Modifier-key snapshot at event dispatch time. |
| `ToolModifiers.alt` | field | `boolean` |  |
| `ToolModifiers.shift` | field | `boolean` |  |
| `ToolModifiers.meta` | field | `boolean` |  |
| `ToolModifiers.ctrl` | field | `boolean` |  |
| `ToolModifiers.space` | field | `boolean` |  |
| `ToolCtx` | interface | `{ worldX, worldY, modifiers, selection, adapter, applyBatch, view, setView, canvasRect, debug, ... }` | Per-event context passed to every channel handler. |
| `ToolCtx.worldX` | field | `number` |  |
| `ToolCtx.worldY` | field | `number` |  |
| `ToolCtx.modifiers` | field | `ToolModifiers` |  |
| `ToolCtx.selection` | field | `SelectionApi` |  |
| `ToolCtx.adapter` | field | `unknown` | Adapter/scene access — opaque at this layer; tools that need it cast to a known shape. |
| `ToolCtx.applyBatch` | field | `(ops: Op[], label: string) => void` |  |
| `ToolCtx.view` | field | `View` | Current viewport. |
| `ToolCtx.setView` | field | `(next: View) => void` | Mutate the viewport. |
| `ToolCtx.canvasRect` | field | `DOMRect` | Bounding rect of the canvas element in viewport coords. |
| `ToolCtx.debug?` | field | `DebugSink` | Optional debug sink. |
| `ToolCtx.scratch` | field | `TScratch` |  |
| `PointerChannel` | interface | `{ onDown, onClick }` |  |
| `PointerChannel.onDown?` | field | `(e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `PointerChannel.onClick?` | field | `(e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `DragChannel` | interface | `{ onStart, onMove, onEnd, onCancel }` |  |
| `DragChannel.onStart?` | field | `(e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `DragChannel.onMove?` | field | `(e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `DragChannel.onEnd?` | field | `(e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `DragChannel.onCancel?` | field | `(ctx: ToolCtx<TScratch>) => void` |  |
| `KeyboardChannel` | interface | `{ onDown, onUp }` |  |
| `KeyboardChannel.onDown?` | field | `(e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `KeyboardChannel.onUp?` | field | `(e: KeyboardEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `WheelChannel` | interface | `{ onWheel }` |  |
| `WheelChannel.onWheel?` | field | `(e: WheelEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `DblTapChannel` | interface | `{ onTap }` | Double-tap (double-click) channel. |
| `DblTapChannel.onTap?` | field | `(e: PointerEvent, ctx: ToolCtx<TScratch>) => Decision` |  |
| `ModifierTrigger` | type | `'space' \| 'alt' \| 'ctrl' \| 'meta' \| 'shift'` | Modifier-slot trigger key. |
| `ToolBounds` | interface | `{ x, y, width, height }` | World-space AABB shape used by `peekBounds`. |
| `ToolBounds.x` | field | `number` |  |
| `ToolBounds.y` | field | `number` |  |
| `ToolBounds.width` | field | `number` |  |
| `ToolBounds.height` | field | `number` |  |
| `Tool` | interface | `{ id, keybinding, modifier, initScratch, onActivate, onDeactivate, pointer, drag, keyboard, wheel, ... }` | Full Tool record. |
| `Tool.id` | field | `string` |  |
| `Tool.keybinding?` | field | `string` |  |
| `Tool.modifier?` | field | `ModifierTrigger` |  |
| `Tool.initScratch?` | field | `() => TScratch` |  |
| `Tool.onActivate?` | field | `(ctx: ToolCtx<TScratch>) => void` |  |
| `Tool.onDeactivate?` | field | `(ctx: ToolCtx<TScratch>) => void` |  |
| `Tool.pointer?` | field | `PointerChannel<TScratch>` |  |
| `Tool.drag?` | field | `DragChannel<TScratch>` |  |
| `Tool.keyboard?` | field | `KeyboardChannel<TScratch>` |  |
| `Tool.wheel?` | field | `WheelChannel<TScratch>` |  |
| `Tool.dblTap?` | field | `DblTapChannel<TScratch>` | Double-tap channel — fires when two sub-threshold taps land within `dblTap.windowMs` / `dblTap.maxDistance` of each other. |
| `Tool.cursor?` | field | `string \| ((ctx: ToolCtx<TScratch>) => string)` |  |
| `Tool.peekPose?` | field | `(id: string) => unknown` | Returns the in-flight overlay pose for `id` if this tool is mid-gesture on it; otherwise `null`. |
| `Tool.peekBounds?` | field | `(id: string) => ToolBounds \| null` | Returns the in-flight overlay bounds for `id` if this tool is mid-gesture on it; otherwise `null`. |
| `Tool.peekHide?` | field | `() => Iterable<string> \| null` | Returns ids whose committed scene-render should be suppressed while this tool is mid-gesture (e.g. |
| `Tool.overlay?` | field | `RenderLayer<unknown>` | Optional overlay layer rendered on top of the scene/chrome whenever this tool is in any active slot (active, modifier, or alwaysOn). |
| `ToolSlot` | type | `'modifier' \| 'active' \| 'alwaysOn'` | Internal — which slot a tool occupies in the dispatch order. |
| `AnyTool` | type | `Tool<any>` | eslint-disable-next-line @typescript-eslint/no-explicit-any |

## src/tools/useKeybindings.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseKeybindingsOptions` | interface | `{ overrides, disable, defaultTool }` |  |
| `UseKeybindingsOptions.overrides?` | field | `Record<string, string \| null>` | Override map: physical key → tool id. |
| `UseKeybindingsOptions.disable?` | field | `boolean` | Skip all wiring. |
| `UseKeybindingsOptions.defaultTool?` | field | `string \| null` | Tool id Escape switches to. |
| `useKeybindings` | hook | `(tools: ToolsApi, options: UseKeybindingsOptions = {}) => void` |  |
| `useKeybindings.tools` | param | `tools: ToolsApi` |  |
| `useKeybindings.options` | param | `options: UseKeybindingsOptions = {}` |  |

## src/tools/useTools.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `UseToolsOptions` | interface | `{ active, registry, alwaysOn, getCtx }` |  |
| `UseToolsOptions.active` | field | `string` | Initial active-slot tool id. |
| `UseToolsOptions.registry` | field | `Record<string, AnyTool>` | Tools eligible for the active slot or modifier slot. |
| `UseToolsOptions.alwaysOn?` | field | `AnyTool[]` | Always-on tools — listen continuously regardless of active slot. |
| `UseToolsOptions.getCtx?` | field | `(overrides?: { clientX?: number; clientY?: number; modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean }; }) => Omit<ToolCtx, 'scratch'>` | Per-event base ctx supplier. |
| `ToolsApi` | interface | `{ active, setActive, modifierEngaged, engageModifier, disengageModifier, alwaysOn, registry, dispatcher, gestureTick, has, ... }` |  |
| `ToolsApi.active` | field | `string` | Current active-slot tool id. |
| `ToolsApi.setActive` | field | `(id: string) => void` | Set the active-slot tool. |
| `ToolsApi.modifierEngaged` | field | `string \| null` | Currently modifier-engaged tool id (or `null`). |
| `ToolsApi.engageModifier` | field | `(id: string) => void` | Engage a modifier-slot tool by id. |
| `ToolsApi.disengageModifier` | field | `() => void` | Disengage the modifier-slot tool, if any. |
| `ToolsApi.alwaysOn` | field | `readonly AnyTool[]` | All always-on tools, in registration order. |
| `ToolsApi.registry` | field | `Readonly<Record<string, AnyTool>>` | Full registry — for userland UI (palette buttons, etc.). |
| `ToolsApi.dispatcher` | field | `ToolsDispatcher` | The dispatcher `<Canvas>` wires to its DOM events. |
| `ToolsApi.gestureTick` | field | `number` | Increments whenever an in-flight gesture starts, transitions phase, or ends. |
| `ToolsApi.has` | field | `boolean` | Returns true if a tool with the given id is in the registry or alwaysOn list. |
| `ToolsApi.getActiveOverlays` | field | `RenderLayer<unknown>[]` | All overlay layers from currently-engaged tools (active slot, modifier slot if engaged, all alwaysOn slot tools). |
| `useTools` | hook | `(opts: UseToolsOptions) => ToolsApi` |  |
| `useTools.opts` | param | `opts: UseToolsOptions` |  |

## src/util/constrainTo45.ts

| Name | Kind | Signature / shape | Description |
|------|------|-------------------|-------------|
| `constrainTo45` | function | `(dx: number, dy: number) => { dx: number; dy: number }` | Snap a (dx, dy) direction vector to the nearest 0/45/90/135° axis, preserving the input magnitude. |
| `constrainTo45.dx` | param | `dx: number` |  |
| `constrainTo45.dy` | param | `dy: number` |  |
