/**
 * `@weasel-js/diagram/effect` — a chart of an effects pipeline: the stages,
 * what each reads and writes, and where a decision sends the signal.
 */
export { checkPipeline } from './effect/check';
export type { EffectProblem } from './effect/check';
export {
  PROBLEM_COLOR,
  drawableWires,
  exitLabel,
  isControl,
  kindOf,
  portOn,
  stageRows,
  stageStyle,
  typeColors,
  uniqueGroups,
  uniqueStages,
  wireStyle,
} from './effect/draw';
export type { DrawableWire, EffectLook, EffectLookResult, TypeColor } from './effect/draw';
export { EffectChart } from './effect/EffectChart';
export type { EffectChartProps } from './effect/EffectChart';
export { EFFECT_LOOKS } from './effect/looks';
export { mainChain } from './effect/mainChain';
export { nodeGraph } from './effect/nodeGraph';
export type { NodeGraphOptions } from './effect/nodeGraph';
export { rack } from './effect/rack';
export type { RackOptions } from './effect/rack';
export { BRANCH_SYMBOLS, branchNode, symbolNameFor } from './effect/symbols';
export type { BranchChoice, BranchNode, BranchSymbol } from './effect/symbols';
export type {
  EffectGroup,
  EffectPipeline,
  EffectPort,
  EffectStage,
  EffectType,
  EffectWire,
} from './effect/types';
