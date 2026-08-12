export type {
  Affordance,
  AffordanceBinding,
  AffordanceRegion,
  CommonAffordanceScratch,
  CustomPaintContext,
  LayerHit,
  ClaimableGesture,
} from './types';
export { composeAffordanceLayer } from './composeAffordanceLayer';
export {
  hitAffordanceRegions,
  annulusSemiAxes,
  type AffordanceRegionHit,
} from './hitAffordanceRegions';
export {
  createCornerResizeAffordance,
  type CornerResizeAffordanceOptions,
  type CornerResizeScratch,
} from './cornerResize';
export {
  createRotationAffordance,
  type RotationAffordanceOptions,
  type RotationScratch,
} from './rotationHandle';
export {
  createPathAnchorAffordances,
  PATH_ANCHOR_CHROME_ID,
  type AnchorState,
  type AnchorScratch,
  type PathAnchorAffordanceOptions,
} from './pathAnchors';
