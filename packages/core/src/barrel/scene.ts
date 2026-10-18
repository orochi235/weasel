/** Part of the `@weasel-js/core` barrel. The scene, its ops, history, groups, and adapters. */

// ─── Op model: every scene mutation routes through here ─────────────────────
export * from '../core/ops';

// ─── Mixed sentinel: cross-cutting "these values disagree" marker ──────────
export { MIXED } from '@weasel-js/registry';
export type { Mixed } from '@weasel-js/registry';

// ─── Group/parent composition: world pose, rebase, ordered groups ───────────
export {
  composesFrames,
  composeWorldPose,
  composeRectPose,
  decomposeRectPose,
  composeRigidPose,
  decomposeRigidPose,
  rebaseLocalPose,
  translateRectPose,
  worldPoseLookup,
  IDENTITY_POSE_COMPOSITION,
  RECT_POSE_COMPOSITION,
  RIGID_POSE_COMPOSITION,
} from 'core/scene/composePose';
export type { PoseAdapter, PoseComposition, PoseClosure } from 'core/scene/composePose';
export { scenePoseAdapter } from 'core/scene/scenePoseAdapter';
export { nestedHitTester } from 'core/scene/nestedHit';
export { unionOfChildrenVia } from 'core/scene/unionOfChildren';
export type {
  NestedHitOpts,
  NestedHitTester,
} from 'core/scene/nestedHit';

// ─── Groups: union the bounds of a node set ─────────────────────────────────
export { unionBounds, unionAABB, axisAlignedBounds } from '../core/geometry/unionBounds';
export type { RectPose } from '../core/geometry/unionBounds';

// ─── Undo history: createHistory + entry shape ──────────────────────────────
// Core's `createHistory` stands in for the engine's own: the wrapper injects
// the global op-factory registry as the restore-time rebuild hook (see
// ./core/ops/createHistory). The engine's types are named rather than
// `export *`: esbuild cannot enumerate a star re-export across a package
// boundary and emits no binding for it.
export { createHistory } from '../core/ops/createHistory';
export type {
  History,
  CreateHistoryOptions,
  HistoryEntry,
  EvictedEntry,
  SerializedOp,
  SerializedHistoryEntry,
  SerializedHistory,
  HistoryLogger,
  HistorySelection,
  HistoryBranch,
  RecordEntryOptions,
  Op,
  Journal,
  BeginJournalOptions,
  SwapArgs,
  SwapOpOptions,
} from '@weasel-js/history';
export { swapOp } from '@weasel-js/history';

// ─── Adapters: the contracts the interaction layer reads ────────────────────
export * from '../core/adapters/types';

// ─── Scene primitive (kit-owned tree of leaves and containers) ──────────────
export {
  createScene, sceneFromJSON, sceneSelectionStore, useScene, asNodeId, SCENE_HISTORY_FORM,
  createPoseFeed, createPoseOverrides, definesFrame, derivedDepOf, derivedPose, documentPose, effectivePose,
  UNION_OF_CHILDREN, unionOfChildren, SceneArrivalRefused, reconcileSpecs, sceneUnitScopes,
} from '../core/scene';
export type { PoseSource, PosedNode, ScopedScene } from '../core/scene';
export type {
  AddLayerSpec,
  AddNodeSpec,
  Bivariant,
  ClipFromPoseFn,
  CopiesFromPoseFn,
  DerivedDep,
  DerivePathFn,
  DerivePoseFn,
  ContainerNode,
  FeedDelta,
  FeedNode,
  LayerRecord,
  LayoutFrame,
  LayoutMove,
  LeafNode,
  Node as SceneNode,
  NodeId,
  PoseFeed,
  PoseOverride,
  PoseHold,
  PoseOverrides,
  RegisteredOp,
  Scene,
  SceneArrivalHandler,
  SceneRegistry,
  SerializedLayer,
  SerializedNode,
  SerializedScene,
  SerializedSceneHistory,
  SystemLayerRecord,
  SystemLayerSpec,
  UserLayerRecord,
  UseSceneOptions,
} from '../core/scene';

// ─── Reorder: ops ───────────────────────────────────────────────────────────
export {
  createReorderOp,
  createMoveToIndexOp,
  canBringForward,
  canSendBackward,
} from '../core/ops/reorder';
export type { ReorderDirection } from '../core/ops/reorder';

// ─── Annotation layers, and the measurements kept on them ───────────────────
export { isAnnotationLayer, isAnnotationNode, annotationLayerIds } from 'core/scene/annotation';

// ─── Whether a node is shown and in reach ────────────────────────────────────
export { nodeGates, isNodeHidden, isNodeLocked, hidesSubtree } from 'core/scene/nodeGates';
export type { NodeGates, GateSource, GatedNode, GatedLayer } from 'core/scene/nodeGates';
export * from '../features/measure';
