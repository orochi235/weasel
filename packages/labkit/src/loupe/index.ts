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
export { drawCanvasLens, lensCamera, lensSourceRect, stackSources } from './canvasLens';
export type { DomLoupeProps } from './DomLoupe';
export { DomLoupe } from './DomLoupe';
export type { LoupeBubbleProps } from './LoupeBubble';
export { LoupeBubble } from './LoupeBubble';
export type { LoupeGesturesProps } from './LoupeGestures';
export { LoupeGestures } from './LoupeGestures';
export type { CloneSource, CloneSourceOptions } from './lens/cloneSource';
export { createCloneSource } from './lens/cloneSource';
export { LabLoupe, labLoupe } from './lens/LabLoupe';
export type { LensActionsProps } from './lens/LensActions';
export { LensActions } from './lens/LensActions';
export type { LensAttachment, LensOverlayProps, LensReadoutProps } from './lens/LensOverlay';
export { LensOverlay, VIEWPORT_ATTACHMENT } from './lens/LensOverlay';
export { useShownSource } from './lens/LensSlot';
export type { LensActionApi } from './lens/lensActionDefs';
export {
  createLensActions,
  createLoupeKeymap,
  LENS_ACTION_IDS,
  LENS_KEYS,
  LOUPE_LEADER,
  MAX_LENSES,
  QUICK_KEY,
  QUICK_TAP_MS,
} from './lens/lensActionDefs';
export type { LensApiRefs } from './lens/lensApi';
export { createLensApi, lensClient, useLensFocus } from './lens/lensApi';
export {
  addLensOps,
  createLensScene,
  lensClosure,
  lensesOf,
  lensIdsOf,
  reticleAt,
  setAimOps,
  setLensOps,
  settingsOf,
} from './lens/lensScene';
export type {
  LensCapture,
  LensDescribeContext,
  LensResolution,
  LensSlotProps,
  LensSource,
  LensSourceHandle,
  LensSourceRequest,
  LensSourceStatus,
  LensSources,
} from './lens/lensSource';
export { requestsOf, resolveSource, unavailableText } from './lens/lensSource';
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
  LENS_DEFAULTS,
  LENS_REST_MS,
} from './lens/lensTypes';
export { readBitmap } from './lens/pixelGrid';
export type { LensProbe } from './lens/probeUnderLens';
export { probeUnderLens } from './lens/probeUnderLens';
export { useFrameSchedule } from './lens/useFrameSchedule';
export type { Remeasurable } from './lens/useLensRemeasure';
export { useLensRemeasure } from './lens/useLensRemeasure';
export type { SceneLoupeProps, SceneViewSource } from './SceneLoupe';
export { SceneLoupe } from './SceneLoupe';
export type { SourceLoupeProps } from './SourceLoupe';
export { SourceLoupe } from './SourceLoupe';
export type { LoupeSource, LoupeSourceTarget } from './sourceLens';
export { drawSourceLens, resolveLoupeSource, sourceBoxIn } from './sourceLens';
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
