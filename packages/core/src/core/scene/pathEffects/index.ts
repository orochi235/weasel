/**
 * Path effects: live geometry a node derives from other nodes' shapes — a
 * blend between two, one bent along another, copies along a path. The math
 * is `@weasel-js/geom`'s; this is the scene node that keeps it current.
 */
export {
  PATH_EFFECT,
  pathEffectDerivePath,
  pathEffectDerivePose,
  pathEffectNode,
  pathEffectOf,
  pathEffectParts,
} from './derive';
export {
  effectParts,
  type BendAlongEffect,
  type BlendEffect,
  type PathEffect,
  type RepeatAlongEffect,
} from './effects';
export { type EffectSource } from './source';
export { derivedPartsOf, pathFromParts, type DerivedPart } from '../derivedParts';
