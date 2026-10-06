export { createLoupeModel } from './model';
export type {
  LoupeMode,
  LoupeModel,
  LoupeModelOptions,
  LoupeSurface,
} from './model';
export { loupeExtent, loupeInnerView, loupeSourcePoint, placeBand } from './geometry';
export type { BandPlacement, LoupePoint, LoupeRect, LoupeSize, PlaceBandArgs } from './geometry';
export { createCanvasSource, sourcePixel, sourceRegion } from './canvasSource';
export type {
  CanvasSource,
  CanvasSourceOptions,
  SourceBox,
  SourceCanvas,
  SourceContext,
} from './canvasSource';
