/**
 * Path effects: live geometry a node derives from other nodes' shapes — a
 * blend between two, one bent along another, copies along a path. The math
 * is `@weasel-js/geom`'s; this is the scene node that keeps it current.
 *
 * @packageDocumentation
 */
export {
  createPathEffectDerivations,
  PATH_EFFECT,
  pathEffectNode,
  pathEffectOf,
  pathEffectParts,
  registeredPathEffects,
  type PathEffectDerivations,
} from './derive';
export {
  effectParts,
  type BendAlongEffect,
  type BlendEffect,
  type PathEffect,
  type PathEffectOptions,
  type RepeatAlongEffect,
  type TextAlongEffect,
} from './effects';
export { textAlongParts } from './textAlong';
export type { EffectItem, EffectSource, EffectSourceReader } from './source';
export { noteFontRead } from '../fontReads';
export { derivedPartsOf, pathFromParts, resolvePartPaint, type DerivedPart } from '../derivedParts';
