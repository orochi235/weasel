export type {
  Affordance,
  AffordanceBinding,
  AffordanceRegion,
  CustomPaintContext,
} from './types';
export { composeAffordanceLayer } from './composeAffordanceLayer';
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
