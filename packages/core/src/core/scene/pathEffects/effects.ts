/**
 * The path effects, each as the parts it paints from its sources: a blend's
 * steps between two shapes, a shape bent along a spine, copies of a shape
 * along a path, text laid along a path, and one shape roughened, zigzagged,
 * or puckered and bloated.
 */
import {
  bendAlongPath, puckerBloatPath, repeatAlongPath, roughenPath, zigzagPath, type BendAlongPathOptions,
  type PuckerBloatPathOptions, type RepeatAlongPathOptions, type RoughenPathOptions, type ZigzagPathOptions,
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

/** A shape with every point of its outline moved at random. Its source is `[shape]`. */
export interface RoughenEffect extends RoughenPathOptions, PathEffectOptions {
  kind: 'roughen';
}

/** A shape with its outline pushed alternately to either side. Its source is `[shape]`. */
export interface ZigzagEffect extends ZigzagPathOptions, PathEffectOptions {
  kind: 'zigzag';
}

/** A shape with its anchors pulled toward its middle and its handles pushed
 *  away, or the reverse. Its source is `[shape]`. */
export interface PuckerBloatEffect extends PuckerBloatPathOptions, PathEffectOptions {
  kind: 'puckerBloat';
}

/** A path effect, as a node's `data.pathEffect` holds it. */
export type PathEffect =
  | BlendEffect | BendAlongEffect | RepeatAlongEffect | TextAlongEffect | RoughenEffect | ZigzagEffect | PuckerBloatEffect;

/** The parts `effect` paints from `sources`, in its sources' order, or
 *  `null` when a source it needs is missing — a blend's spine among them,
 *  where it names one. */
export function effectParts(effect: PathEffect, sources: readonly (EffectSource | null)[]): DerivedPart[] | null {
  const [a, b] = sources;
  if (!a) return null;
  switch (effect.kind) {
    case 'roughen':
      return [{ path: roughenPath(a.world, effect), fill: a.fill, stroke: a.stroke }];
    case 'zigzag':
      return [{ path: zigzagPath(a.world, effect), fill: a.fill, stroke: a.stroke }];
    case 'puckerBloat':
      return [{ path: puckerBloatPath(a.world, effect), fill: a.fill, stroke: a.stroke }];
  }
  if (!b) return null;
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
