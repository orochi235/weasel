/**
 * `@weasel-js/diagram/effect` — a chart of an effects pipeline: the stages,
 * what each reads and writes, and where a decision sends the signal.
 *
 * @packageDocumentation
 */
export { canMoveInChain, chainLinks, moveInChain } from './effect/chainEdit';
export type { ChainLinks } from './effect/chainEdit';
export { checkPipeline } from './effect/check';
export { COMPACT_PADDING, compact } from './effect/compact';
export type { CompactOptions } from './effect/compact';
export type { EffectProblem } from './effect/check';
export {
  NO_VALUE,
  PREVIEW_SIZE,
  PROBLEM_COLOR,
  drawableWires,
  exitLabel,
  isControl,
  kindOf,
  portOn,
  previewRowId,
  shownPorts,
  stageRows,
  stageStyle,
  typeColors,
  uniqueGroups,
  uniqueStages,
  valueRowId,
  wireEdges,
  wireStyle,
  LOOK_THEME,
} from './effect/draw';
export type { DrawableWire, EffectLook, EffectLookResult, LookOrder, LookThemeOptions, RunRowOptions, TypeColor } from './effect/draw';
export { EFFECT_MIN_SCALE, EffectChart } from './effect/EffectChart';
export type { EffectChartProps } from './effect/EffectChart';
export { EffectEditor } from './effect/EffectEditor';
export type { EffectEditorApi, EffectEditorBaseProps, EffectEditorLookProps, EffectEditorProps } from './effect/EffectEditor';
export { editorScene } from './effect/editorMapping';
export type { EditorLook, EditorLookOptions, EditorScene } from './effect/editorMapping';
export { REORDER_LANES_ACTION_ID } from './effect/editorReorder';
export { LANE_INSET, laneId, laneTypeOf, lanes } from './effect/lanes';
export type { LanesOptions } from './effect/lanes';
export { applyLookRoutes, pruneLookRoutes, setLookRoute, wireEnds } from './effect/lookRoutes';
export type { RoutedLook } from './effect/lookRoutes';
export {
  addStage,
  addWire,
  canWire,
  ensureWireIds,
  moveStages,
  nextStageId,
  nextWireId,
  reconnectWire,
  removeStages,
  removeWires,
  setLaneOrder,
  setParam,
  setWireRoute,
} from './effect/edit';
export {
  groupContents,
  groupStages,
  moveGroup,
  moveToGroup,
  nextGroupId,
  renameGroup,
  setGroupBox,
  ungroup,
} from './effect/groupEdit';
export { formatParam, stageFromType } from './effect/stageTypes';
export type { EffectStageType } from './effect/stageTypes';
export { imageEvaluators } from './effect/image/evaluators';
export { IMAGE_STAGE_TYPES } from './effect/image/stageTypes';
export { testCard } from './effect/image/testCard';
export { imageValueKinds } from './effect/image/valueKinds';
export { EFFECT_LOOKS } from './effect/looks';
export { mainChain } from './effect/mainChain';
export { nodeGraph } from './effect/nodeGraph';
export type { NodeGraphOptions } from './effect/nodeGraph';
export { rack } from './effect/rack';
export type { RackOptions } from './effect/rack';
export { AT_COLOR, costText, paintRun } from './effect/run';
export { runOrder } from './effect/runner/order';
export type { RunOrder } from './effect/runner/order';
export { createPass } from './effect/runner/pass';
export type { EffectPass, RunPipelineOptions } from './effect/runner/pass';
export { runPipeline } from './effect/runner/runPipeline';
export { createEffectRunner } from './effect/runner/runner';
export type { EffectRunner, EffectRunnerOptions, EffectRunnerState } from './effect/runner/runner';
export type {
  EffectEvalContext,
  EffectEvalResult,
  EffectEvaluator,
  EffectEvaluators,
  EffectValueKind,
  EffectValueKinds,
} from './effect/runner/types';
export { useEffectRunner } from './effect/runner/useEffectRunner';
export type { EffectRunnerHandle, UseEffectRunnerOptions } from './effect/runner/useEffectRunner';
export { BRANCH_SYMBOLS, branchNode, symbolNameFor } from './effect/symbols';
export type { BranchChoice, BranchNode, BranchOptions, BranchSymbol } from './effect/symbols';
export type {
  EffectBox,
  EffectDoc,
  EffectGroup,
  EffectParam,
  EffectParamControl,
  EffectPlaces,
  EffectPipeline,
  EffectPort,
  EffectRun,
  EffectStage,
  EffectStageRun,
  EffectType,
  EffectWire,
  LookRoute,
  LookRoutes,
} from './effect/types';
