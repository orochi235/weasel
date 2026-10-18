/**
 * A blend's steps: where each sits between its two sources — evenly by
 * count, or a fixed distance apart — and, with a spine, laid along it.
 */
import {
  boundsOfPath, measurePath, multiply, prepareBlend, rotate, rotatePathAround, transformPath, translate,
  type BlendPathsOptions, type Path, type PathMeasure,
} from '@weasel-js/geom';
import { lerpFill, lerpStroke } from '@weasel-js/paint';
import type { DerivedPart } from '../derivedParts';
import type { EffectSource } from './source';

/** Steps between two shapes. Its sources are `[from, to]`, or
 *  `[from, to, spine]` to lay the steps along a third path. */
export interface BlendEffect extends BlendPathsOptions {
  kind: 'blend';
  /** How many shapes stand between the two sources, spacing by count. */
  steps: number;
  /**
   * How the steps are spaced. `'count'` puts `steps` of them evenly between
   * the sources; `'distance'` puts one every `distance` along the run from
   * the first source, as many as fit short of the second, so the last gap is
   * whatever is left. Default `'count'`.
   */
  spaceBy?: 'count' | 'distance';
  /** Distance from one shape's middle to the next, spacing by distance —
   *  along the spine where there is one. Spacing by count when unset. */
  distance?: number;
  /**
   * Interpolate each source's rotation as a turn about its middle, rather
   * than moving every point in a straight line — so a shape turned 90° at
   * one end turns through 45° halfway instead of shrinking there. Default
   * `true`; it applies where both sources are turned boxes.
   */
  rotate?: boolean;
  /** With a spine, turn each step by how far the spine's heading where it
   *  sits differs from the straight run between the sources. Default
   *  `false`, which only moves them. */
  orient?: boolean;
}

const EPS = 1e-9;

/** The fractions of the way from the first source to the second that the
 *  steps sit at, over a run `length` long. */
export function blendStations(effect: BlendEffect, length: number): number[] {
  const out: number[] = [];
  const d = effect.distance;
  if (effect.spaceBy === 'distance' && d !== undefined && d > 0) {
    if (!(length > 0)) return out;
    for (let s = d; s < length - EPS * Math.max(length, 1); s += d) out.push(s / length);
    return out;
  }
  const steps = Math.max(Math.floor(effect.steps), 0);
  for (let i = 1; i <= steps; i++) out.push(i / (steps + 1));
  return out;
}

/** The middle a source's steps are interpolated about: its turn's center
 *  where it is a turned box, else its outline's bounds' middle. */
function middleOf(source: EffectSource): { x: number; y: number } {
  if (source.framed) return { x: source.framed.cx, y: source.framed.cy };
  const b = boundsOfPath(source.world);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** The parts of `effect` between `a` and `b`, along `spine` when given.
 *  `null` when the spine has no length to measure. */
export function blendParts(effect: BlendEffect, a: EffectSource, b: EffectSource, spine?: Path): DerivedPart[] | null {
  const from = middleOf(a);
  const to = middleOf(b);
  const along: PathMeasure | null = spine === undefined ? null : measurePath(spine);
  if (spine !== undefined && along === null) return null;
  const stations = blendStations(effect, along ? along.length : Math.hypot(to.x - from.x, to.y - from.y));
  if (stations.length === 0) return [];

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
  const chord = Math.atan2(to.y - from.y, to.x - from.x);
  return stations.map((t) => {
    let path: Path = blend.at(t);
    if (turned) {
      const cx = turned.a.cx + (turned.b.cx - turned.a.cx) * t;
      const cy = turned.a.cy + (turned.b.cy - turned.a.cy) * t;
      const rotation = turned.a.rotation + turn * t;
      if (rotation !== 0) path = rotatePathAround(path, cx, cy, rotation);
    }
    if (along) {
      const { point, tangent } = along.at(t * along.length);
      const angle = effect.orient ? Math.atan2(tangent.y, tangent.x) - chord : 0;
      const middle = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      path = transformPath(path, multiply(translate(point.x, point.y), multiply(rotate(angle), translate(-middle.x, -middle.y))));
    }
    return { path, fill: lerpFill(a.fill, b.fill, t) ?? null, stroke: lerpStroke(a.stroke, b.stroke, t) ?? null };
  });
}
