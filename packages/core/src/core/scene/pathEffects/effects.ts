/**
 * The path effects, each as the parts it paints from its sources: a blend's
 * steps between two shapes, a shape bent along a spine, copies of a shape
 * along a path, text laid along a path.
 */
import {
  bendAlongPath, repeatAlongPath, type BendAlongPathOptions, type RepeatAlongPathOptions,
} from '@weasel-js/geom';
import type { DerivedPart } from '../derivedParts';
import { blendParts, type BlendEffect } from './blend';
import type { EffectSource, PathEffectOptions } from './source';
import { textAlongParts, wholeItem, type TextAlongEffect } from './textAlong';

export type { BlendEffect, PathEffectOptions, TextAlongEffect };

/** A shape bent along a spine. Its sources are `[shape, spine]`. */
export interface BendAlongEffect extends BendAlongPathOptions, PathEffectOptions {
  kind: 'bendAlong';
}

/** Copies of a shape along a path. Its sources are `[shape, path]`. */
export interface RepeatAlongEffect extends Omit<RepeatAlongPathOptions, 'flattenTolerance'>, PathEffectOptions {
  kind: 'repeatAlong';
}

/** A path effect, as a node's `data.pathEffect` holds it. */
export type PathEffect = BlendEffect | BendAlongEffect | RepeatAlongEffect | TextAlongEffect;

/** The parts `effect` paints from `sources`, in its sources' order, or
 *  `null` when a source it needs is missing — a blend's spine among them,
 *  where it names one. */
export function effectParts(effect: PathEffect, sources: readonly (EffectSource | null)[]): DerivedPart[] | null {
  const [a, b] = sources;
  if (!a || !b) return null;
  switch (effect.kind) {
    case 'blend': {
      if (sources.length < 3) return blendParts(effect, a, b);
      const spine = sources[2];
      return spine ? blendParts(effect, a, b, spine.world) : null;
    }
    case 'bendAlong': {
      const path = bendAlongPath(a.world, b.world, effect);
      return path === null ? null : [{ path, fill: a.fill, stroke: a.stroke }];
    }
    case 'repeatAlong':
      return repeatAlongPath(a.world, b.world, effect).map((path) => ({ path, fill: a.fill, stroke: a.stroke }));
    case 'textAlong':
      return textAlongParts(effect, a.items?.() ?? [wholeItem(a)], b.world);
  }
}
