/**
 * Path effects: live geometry a node derives from other nodes' shapes — a
 * blend between two, one bent along another, copies along a path, one
 * roughened, zigzagged, or puckered and bloated. The math
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
  type PuckerBloatEffect,
  type RepeatAlongEffect,
  type RoughenEffect,
  type TextAlongEffect,
  type ZigzagEffect,
} from './effects';
export { textAlongParts } from './textAlong';
export type { EffectBand, EffectItem, EffectSource, EffectSourceReader } from './source';
export { noteFontRead } from '../fontReads';
export { derivedPartsOf, pathFromParts, resolvePartPaint, type DerivedPart } from '../derivedParts';
