/**
 * Part of the `@weasel-js/core` barrel. Actions, deps, the gesture dispatcher, and tools.
 *
 * @packageDocumentation
 */

// --- Commands ----------------------------------------------------------------
export { useCommand } from '@weasel-js/routing/react';
export type { CommandOptions } from '@weasel-js/routing/react';

// --- Context menu --------------------------------------------------------------
export { contextMenuAction, openContextMenu } from '../interactions/actions/defaults/contextMenu';

// --- Action types -----------------------------------------------------------
export { ActionDisabledReason } from '@weasel-js/routing';
export type { ActionDisabledReasonValue, ActionVariant } from '@weasel-js/routing';

// --- Actions registry -----------------------------------------------------
export { ActionsProvider, InputScope, useYoke, Yoke, useActionsRegistry, useAction, useOngoingAction } from '@weasel-js/routing/react';
export { useLatest } from '@weasel-js/react';
export type { OngoingAction } from '@weasel-js/routing/react';
export { useMenuHost, useMenus } from '@weasel-js/routing/react';
export type { MenuDef, MenuHit, MenuHost, MenuOpenRequest, MenuSources, OpenMenu } from '@weasel-js/routing';
export { resolveSchemaMenu } from '@weasel-js/routing';
export type { ActionEntry, ActionsProp, ActionsRegistry, UiOngoingControl } from '@weasel-js/routing';
export { actionCursor } from '@weasel-js/routing';
export type { Action, ActionDispatch, ActionPresentation } from '@weasel-js/routing';
export { actionBindings, actionItems, actionItemTitle, actionsTagged, taggedActionItems, matchActionItem } from '@weasel-js/routing';
export { PATH_GESTURE_TAGS, pathOperationTags, type PathGestureFamily } from '../interactions/actions/pathGestureTags';
export { heldKeySpec } from '@weasel-js/routing';
export type { ActionItem } from '@weasel-js/routing';
export type { QueryMatch } from '@weasel-js/registry';
export type { BoundGesture, BindingSource } from '@weasel-js/routing';
export type { ActionParams, ActionTuning, TunedBinding } from '@weasel-js/routing';
export { tuneAction } from '@weasel-js/routing';
export { roleReader, keysHeld } from '@weasel-js/routing';
export type { ModifierRole, ModifierRoles, RoleKeys, RoleRebinds } from '@weasel-js/routing';
export type { ActionParamSchema, ActionTunings } from '../interactions/actions/actionParamSchema';
export { evaluateActive, evaluateEnabled, buildDepsFromRequires } from '@weasel-js/routing';
export type { ActionEnabledResult } from '@weasel-js/routing';
export { actionShortcuts, keySpecShortcut } from '@weasel-js/routing';
export type { ActionShortcut } from '@weasel-js/routing';
export { moveAction } from '../interactions/actions/move/action';
export { flipAction } from '../interactions/actions/flip/action';
export { resizeAction } from '../interactions/actions/resize/action';
export { rotateAction } from '../interactions/actions/rotate/action';
export { areaSelectAction } from '../interactions/actions/defaults/areaSelect';
export { insertAction } from '../interactions/actions/insert/action';
export { placeAction } from '../interactions/actions/insert/placeAction';
export { insertRepositionAction, INSERT_REPOSITION_BINDING } from '../interactions/actions/insert/repositionAction';
export { clearSelectionAction } from '../interactions/actions/defaults/clearSelection';
export {
  exitPathEditToolAction, pathEditToolAction, pathEditToolActive,
} from '../interactions/actions/defaults/pathEditTools';
export { cloneAction } from '../interactions/actions/clone/action';
export { inPlane, selectionLayer, insertLayer, editingLayer } from '../interactions/actions/planeInput';
export type { EditedLayerOf } from '../interactions/actions/planeInput';
export { viewportDragPanAction } from '../interactions/actions/defaults/viewportDragPan';
export type { DragPanParams } from '../interactions/actions/defaults/viewportDragPan';
export {
  viewportZoomAction,
  makeViewportZoomAction,
  type ViewportZoomOptions,
  type ViewportZoomAnimateOptions,
} from '../interactions/actions/defaults/viewportZoom';
export {
  viewportWheelPanAction,
  makeViewportWheelPanAction,
  type WheelPanOptions,
} from '../interactions/actions/defaults/viewportWheelPan';
export { editAnchorsAction } from '../interactions/actions/edit-anchors/action';
export {
  deleteAnchorsAction, nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction, nudgeAnchorsUpAction,
  selectAnchorAction,
} from '../interactions/actions/defaults/anchorEditing';
export { lassoSelectAction } from '../interactions/actions/lasso-select/action';
export { sliceAction } from '../interactions/actions/defaults/slice';
export {
  commitDeleteToScene, createDeleteAction, deleteAction, type DeleteActionOptions,
} from '../interactions/actions/defaults/delete';
export {
  pinchZoomAction,
  makePinchZoomAction,
  type PinchZoomOptions,
} from '../interactions/actions/defaults/pinchZoom';
export {
  clipboardCopyAction,
  clipboardCutAction,
  clipboardPasteAction,
  clipboardPasteEventAction,
} from '../interactions/actions/clipboard/action';
export { enterTextEditAction } from '../interactions/actions/defaults/enterTextEdit';
export type { SliceDep, ClipboardDep, TextEditDep } from '../interactions/actions/depSchema';
export { useStandardActions, KIT_STANDARD_ACTION_IDS } from '../interactions/actions/useStandardActions';
export type { UseStandardActionsOptions } from '../interactions/actions/useStandardActions';
// Scene-backed op applier for the consumer `applyOps` commit hook — applies a
// default action's committed ops directly to the scene in its native (local)
// frame. Consumers route their own history integration through `applyOps` and
// use this to perform the actual mutation (see DepSchema['applyOps']).
export { defaultCommitAdapter } from '../interactions/actions/defaultCommitAdapter';

// ─── Invoker / GestureBinding / ActiveToolContext ───
export { overlaysOf, resolveParams } from '@weasel-js/routing';
export type { Point2, DragSample, InvocationCtx, BindingOpts, ActionDeps, AffordanceHit, OngoingHandle, OngoingOverlay, OverlayRole, ImmediateInvoker, OngoingInvoker, Invoker } from '@weasel-js/routing';
export type { GestureBinding } from '@weasel-js/routing';
export { ActiveToolContextProvider, ActiveToolContextProviderIfRoot, useActiveToolContext, useOptionalActiveToolContext } from '@weasel-js/routing/react';
export type { ActiveToolContextValue, ActiveToolContextProviderProps } from '@weasel-js/routing/react';

// ─── Dep registry ───
export { DepRegistryProvider, useDepRegistry, useOptionalDepRegistry, useDepSource } from '@weasel-js/routing/react';
export { createDepRegistry } from '@weasel-js/routing';
export type { DepName, DepRegistry, DepListing, DepSource } from '@weasel-js/routing';
// Exported from its defining module rather than through depRegistry's
// re-export, so `DepName = keyof DepSchema` resolves to a documented symbol.
export type { DepSchema } from '../interactions/actions/depSchema';
export type {
  AreaSelectDep,
  HitTestView,
  ClipboardIngestCtx,
  EditAnchorsDep,
  FinishedEditFrame,
  TransformFollower,
  TransformPreviewNode,
  IngestionDep,
  InsertDep,
  InsertEnds,
  InsertIntoDep,
  PathSymmetryDep,
  InsertLive,
  SnapDep,
  SnapGeometry,
  InsertExtras,
  LassoSelectDep,
  LayoutDep,
  NodeAtPointDep,
  ResizePolicy,
  SvgIngestOptions,
  SvgUnpacker,
  ViewApi,
} from '../interactions/actions/depSchema';
export type { GeometryProjection } from '../interactions/actions/geometryProjection';
export {
  useResizePolicy,
  type UseResizePolicyOptions,
} from '../canvas/deps/resizePolicy';
export { usePoseDescriptorDepSource } from '../canvas/deps/poseDescriptor';
export {
  CORNER_ANCHORS, RESIZE_HANDLE_ANCHORS, EDGE_HANDLE_MIN_RADII, cornerPoint, handlePoint, isCornerHandle, resizeHandlesFor,
} from '../interactions/actions/resize/cornerHandles';
export type {
  CornerAnchor, CornerEdge, HandleEdge, ResizeHandleAnchor, ResizeHandleLayout,
} from '../interactions/actions/resize/cornerHandles';
export { useSliceDep, useSliceDepSource, type OpsApplier } from '../canvas/deps/slice';
export { useBooleansAdapterSource } from '../canvas/deps/booleans';
export {
  computeSliceOps,
  type ComputeSliceOpsArgs,
  type ComputeSliceResult,
  type SliceableNode,
  type SliceLeaf,
  type SlicePiece,
} from '../interactions/actions/defaults/sliceOps';

// ─── Gesture dispatcher ───
export { createDispatcher, // The precedence rule itself, so reflection surfaces can show WHY one
  // binding outranks another instead of re-deriving the tuple.
  specificity } from '@weasel-js/routing';
export { useGestureDispatcher } from '@weasel-js/routing/react';
export type { Dispatcher, DispatcherContext, KeyReach, InputEvent, BindingScope, ScopedBinding, MatchResult, ResolveOnlyResult, ResolvedCandidate, ResolveAllOptions } from '@weasel-js/routing';
export type {
  DispatchRecord, DispatchRecordInput, RecordCandidate, DroppedCandidate,
  RankedCandidate, PlacedBy, WalkStep, SpecificityPart,
} from '@weasel-js/routing';
export type { UseGestureDispatcherOptions, DispatcherChannels } from '@weasel-js/routing/react';

// ─── Tools: dispatcher, registry, declarative routing, built-ins ────────────
export * from '../tools';
// Route *reflection* — the route grammar, registry, and conflict checker —
// is the `@weasel-js/core/routing` subpath. Tool authoring (`defineTool`,
// `ToolDef`) is on this barrel, via `./tools` above.

// ─── Gesture/action types (ModifierState, GestureContext, per-action interfaces) ─
export type {
  ModifierState,
  PointerState,
  GestureContext,
  GestureFrames,
  ActionBehavior,
  BehaviorResult,
  GroupTransform,
  MoveBehavior,
  ResizeAnchor,
  ResizeProposed,
  ResizeMoveResult,
  BoundsConstraint,
  ResizeOverlay,
  RotatedPose,
  RotateProposed,
  RotateMoveResult,
  RotateBehavior,
  RotateOverlay,
  InsertProposed,
  InsertMoveResult,
  InsertBehavior,
  InsertOverlay,
  AreaSelectOverlay,
  LassoSelectPose,
  LassoSelectProposed,
  LassoSelectMoveResult,
  LassoSelectBehavior,
  LassoSelectOverlay,
  BehaviorEnd,
  MoveEnd,
} from '../interactions/gestures/types';
export type { ClipboardSnapshot, PasteCtx, PasteOmission } from '../interactions/actions/clipboard/types';

// ─── Gesture specs ───
export { hitPredicate, bodyPredicate } from '@weasel-js/gestures';
export type {
  ModSpec,
  TargetSpec,
  TargetPredicate,
  KeySpec,
  KeyHeldSpec,
  WheelSpec,
  PinchSpec,
  ClickSpec,
  DragSpec,
  MultiTouchSpec,
  DropSpec,
  CarrySpec,
  PasteSpec,
  GestureSpec,
} from '../interactions/gestures/spec';

// ─── Typed scratch keys: shared typed access to ctx.scratch (behaviors) ─────
export { scratchKey, getScratch, setScratch, deleteScratch, type ScratchKey, type ScratchStore } from '@weasel-js/routing';
export type { UseLassoSelectOptions } from '../interactions/actions/lasso-select';
export {
  selectFromLasso,
  type SelectFromLassoOptions,
} from '../interactions/actions/lasso-select/behaviors/selectFromLasso';
