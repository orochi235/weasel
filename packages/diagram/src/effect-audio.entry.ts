/**
 * `@weasel-js/diagram/effect-audio` — plays an audio pipeline through a patchable
 * `@weasel-js/audio` graph, editing the graph as the pipeline changes.
 *
 * @packageDocumentation
 */
export { audioStageNodes } from './effect/audio/nodes';
export type { AudioSources, AudioStageNode, AudioStageNodes } from './effect/audio/nodes';
export { diffPlans } from './effect/audio/patches';
export type { BuildNode } from './effect/audio/patches';
export { EMPTY_PLAN, livePlan } from './effect/audio/plan';
export type { LivePlan, PlanEdge, PlanNode } from './effect/audio/plan';
export { createLiveAudioRunner } from './effect/audio/liveRunner';
export type { LiveAudioRunner, LiveAudioRunnerOptions, LiveAudioRunnerState } from './effect/audio/liveRunner';
export { drawScope, drawSpectrum } from './effect/audio/scope';
export type { AudioPreview } from './effect/audio/scope';
export { AUDIO_STAGE_TYPES } from './effect/audio/stageTypes';
export { useLiveAudioRunner } from './effect/audio/useLiveAudioRunner';
export type { LiveAudioRunnerHandle, UseLiveAudioRunnerOptions } from './effect/audio/useLiveAudioRunner';
