export type {
  BandPlacement,
  CanvasSource,
  CanvasSourceOptions,
  LoupeMode,
  LoupePoint,
  LoupeSize,
  PlaceBandArgs,
  SourceBox,
  SourceCanvas,
  SourceContext,
} from '@weasel-js/loupe';
export { createCanvasSource, loupeExtent, placeBand } from '@weasel-js/loupe';
export type { LoupeKitSettings } from '../kitSettings';
export type { CanvasLoupeProps } from './CanvasLoupe';
export { CanvasLoupe } from './CanvasLoupe';
export type { LensCamera, SourceRect } from './canvasLens';
export { drawCanvasLens, lensCamera, lensSourceRect, sampleStack } from './canvasLens';
export type { DomLoupeProps } from './DomLoupe';
export { DomLoupe } from './DomLoupe';
export type { LoupeBubbleProps } from './LoupeBubble';
export { LoupeBubble } from './LoupeBubble';
export type { LoupeGesturesProps } from './LoupeGestures';
export { LoupeGestures } from './LoupeGestures';
export type { LensActionsProps } from './lens/LensActions';
export { LensActions } from './lens/LensActions';
export type { LensAttachment, LensOverlayProps } from './lens/LensOverlay';
export { LensOverlay, VIEWPORT_ATTACHMENT } from './lens/LensOverlay';
export type { LensActionApi } from './lens/lensActionDefs';
export {
  createLensActions,
  createLoupeKeymap,
  LENS_ACTION_IDS,
  LENS_KEYS,
  LOUPE_LEADER,
  MAX_LENSES,
} from './lens/lensActionDefs';
export type { LensHitBox } from './lens/lensHitBoxes';
export { HANDLE_SLOP, hitBoxesOf } from './lens/lensHitBoxes';
export {
  addLensOps,
  createLensScene,
  LENS_REGISTRY,
  lensClosure,
  lensesOf,
  lensIdsOf,
  setAimOps,
  setLensOps,
  settingsOf,
} from './lens/lensScene';
export type {
  LensAim,
  LensBodyData,
  LensIds,
  LensLeaderData,
  LensNodeData,
  LensReadout,
  LensReticleData,
  LensScene,
  LensSettings,
  LensSourceKind,
  LensView,
} from './lens/lensTypes';
export {
  BODY_SIZE,
  GLASS_POSE_KEY,
  LEADER_PATH_KEY,
  LENS_DEFAULTS,
  RETICLE_SIZE,
} from './lens/lensTypes';
export type { LoupeInputApi } from './loupeActions';
export { createLoupeActions, LOUPE_MAGNIFY_ID, LOUPE_PEEK_ID } from './loupeActions';
export type { SourceLoupeProps } from './SourceLoupe';
export { SourceLoupe } from './SourceLoupe';
export type { LoupeSource, LoupeSourceTarget } from './sourceLens';
export { drawSourceLens, resolveLoupeSource, sampleSource, sourceBoxIn } from './sourceLens';
export type { TrialLoupeProps } from './TrialLoupe';
export { TrialLoupe } from './TrialLoupe';
export type {
  LoupeLens,
  LoupeOptions,
  LoupePlaceArgs,
  LoupePlacement,
  LoupeRenderArgs,
  LoupeShape,
  ResolvedLoupe,
} from './types';
export { LOUPE_DEFAULTS, resolveLoupe } from './types';
export type { LoupeState, UseLoupeOptions } from './useLoupe';
export { useLoupe } from './useLoupe';
