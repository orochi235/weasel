/**
 * The path effects, each as the parts it paints from its sources: a blend's
 * steps between two shapes, a shape bent along a spine, copies of a shape
 * along a path.
 */
import {
  bendAlongPath, prepareBlend, repeatAlongPath, rotatePathAround,
  type BendAlongPathOptions, type BlendPathsOptions, type RepeatAlongPathOptions,
} from '@weasel-js/geom';
import { lerpFill, lerpStroke } from '@weasel-js/paint';
import type { DerivedPart } from '../derivedParts';
import type { EffectSource } from './source';

/** Steps between two shapes. Its sources are `[from, to]`. */
export interface BlendEffect extends BlendPathsOptions {
  kind: 'blend';
  /** How many shapes stand between the two sources. */
  steps: number;
  /**
   * Interpolate each source's rotation as a turn about its middle, rather
   * than moving every point in a straight line — so a shape turned 90° at
   * one end turns through 45° halfway instead of shrinking there. Default
   * `true`; it applies where both sources are turned boxes.
   */
  rotate?: boolean;
}

/** A shape bent along a spine. Its sources are `[shape, spine]`. */
export interface BendAlongEffect extends BendAlongPathOptions {
  kind: 'bendAlong';
}

/** Copies of a shape along a path. Its sources are `[shape, path]`. */
export interface RepeatAlongEffect extends Omit<RepeatAlongPathOptions, 'flattenTolerance'> {
  kind: 'repeatAlong';
}

/** A path effect, as a node's `data.pathEffect` holds it. */
export type PathEffect = BlendEffect | BendAlongEffect | RepeatAlongEffect;

/** The parts `effect` paints from `sources`, in its sources' order, or
 *  `null` when a source it needs is missing. */
export function effectParts(effect: PathEffect, sources: readonly (EffectSource | null)[]): DerivedPart[] | null {
  const [a, b] = sources;
  if (!a || !b) return null;
  switch (effect.kind) {
    case 'blend': return blendParts(effect, a, b);
    case 'bendAlong': {
      const path = bendAlongPath(a.world, b.world, effect);
      return path === null ? null : [{ path, fill: a.fill, stroke: a.stroke }];
    }
    case 'repeatAlong':
      return repeatAlongPath(a.world, b.world, effect).map((path) => ({ path, fill: a.fill, stroke: a.stroke }));
  }
}

function blendParts(effect: BlendEffect, a: EffectSource, b: EffectSource): DerivedPart[] {
  const steps = Math.max(Math.floor(effect.steps), 0);
  if (steps === 0) return [];
  const turned = (effect.rotate ?? true) && a.framed !== undefined && b.framed !== undefined
    ? { a: a.framed, b: b.framed }
    : null;
  const blend = turned
    ? prepareBlend(turned.a.path, turned.b.path, effect)
    : prepareBlend(a.world, b.world, effect);
  // The shorter way round, so a turn of 350° reads as -10°.
  const turn = turned
    ? Math.atan2(Math.sin(turned.b.rotation - turned.a.rotation), Math.cos(turned.b.rotation - turned.a.rotation))
    : 0;
  const parts: DerivedPart[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    let path = blend.at(t);
    if (turned) {
      const cx = turned.a.cx + (turned.b.cx - turned.a.cx) * t;
      const cy = turned.a.cy + (turned.b.cy - turned.a.cy) * t;
      const rotation = turned.a.rotation + turn * t;
      if (rotation !== 0) path = rotatePathAround(path, cx, cy, rotation);
    }
    parts.push({ path, fill: lerpFill(a.fill, b.fill, t) ?? null, stroke: lerpStroke(a.stroke, b.stroke, t) ?? null });
  }
  return parts;
}
