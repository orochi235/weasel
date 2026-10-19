/**
 * `@weasel-js/diagram/effect` — a chart of an effects pipeline: the stages,
 * what each reads and writes, and where a decision sends the signal.
 *
 * @packageDocumentation
 */
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
  stageRows,
  stageStyle,
  typeColors,
  uniqueGroups,
  uniqueStages,
  valueRowId,
  wireEdges,
  wireStyle,
} from './effect/draw';
export type { DrawableWire, EffectLook, EffectLookResult, RunRowOptions, TypeColor } from './effect/draw';
export { EFFECT_MIN_SCALE, EffectChart } from './effect/EffectChart';
export type { EffectChartProps } from './effect/EffectChart';
export { LANE_INSET, laneId, lanes } from './effect/lanes';
export type { LanesOptions } from './effect/lanes';
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
  setParam,
} from './effect/edit';
export { formatParam, stageFromType } from './effect/stageTypes';
export type { EffectStageType } from './effect/stageTypes';
export { EFFECT_LOOKS } from './effect/looks';
export { mainChain } from './effect/mainChain';
export { nodeGraph } from './effect/nodeGraph';
export type { NodeGraphOptions } from './effect/nodeGraph';
export { rack } from './effect/rack';
export type { RackOptions } from './effect/rack';
export { costText, paintRun } from './effect/run';
export { BRANCH_SYMBOLS, branchNode, symbolNameFor } from './effect/symbols';
export type { BranchChoice, BranchNode, BranchOptions, BranchSymbol } from './effect/symbols';
export type {
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
} from './effect/types';
