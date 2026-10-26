/**
 * The kit's path effects, wired to its painters: the derivations a scene
 * holding blends, bends and repeats registers, and the registry helper that
 * registers them.
 */
import {
  createPathEffectDerivations, PATH_EFFECT, type PathEffectDerivations,
} from 'core/scene/pathEffects/derive';
import type { SceneRegistry } from 'core/scene/types';
import { readEffectSource } from './readSource';

export { readEffectSource };

/** The kit's path-effect derivations, reading sources through the painter
 *  registry. One pair for every scene, so a saved node finds them by key. */
export const PATH_EFFECT_DERIVATIONS: PathEffectDerivations = createPathEffectDerivations(readEffectSource);

/**
 * `registry` with the path-effect derivations under `kit:pathEffect`, for
 * `createScene({ registry })` or `sceneFromJSON(json, { registry })`. A scene
 * built without them cannot hold a path effect: the actions that make one are
 * disabled there, and a saved one does not load.
 */
export function withPathEffectsRegistry<TPose, TData = unknown, TLayer extends string = string>(
  registry: SceneRegistry<TPose, TData, TLayer> = {},
): SceneRegistry<TPose, TData, TLayer> {
  type Fns<K extends 'derivePath' | 'derivePose'> = NonNullable<SceneRegistry<TPose, TData, TLayer>[K]>[string];
  return {
    ...registry,
    derivePath: { [PATH_EFFECT]: PATH_EFFECT_DERIVATIONS.derivePath as unknown as Fns<'derivePath'>, ...registry.derivePath },
    derivePose: { [PATH_EFFECT]: PATH_EFFECT_DERIVATIONS.derivePose as unknown as Fns<'derivePose'>, ...registry.derivePose },
  };
}
