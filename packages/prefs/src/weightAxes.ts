import type { PrefWeights } from './locus';

/** How a {@link PrefWeights} maps to numbers: the shape `@weasel-js/animator`'s `createTarget` takes as `axes`. */
export interface PrefWeightAxes {
  readonly count: number;
  /** `<selector>.<option>` for each axis, so an animation naming a selector reaches every one of its options. */
  readonly names: readonly string[];
  to(weights: PrefWeights): number[];
  from(axes: ArrayLike<number>): PrefWeights;
}

/**
 * The weights over `options`, each selector's listed options, as one number apiece: what an animator moves to
 * carry a read from one option to another. An option the weights leave out reads as 0, and one outside `options`
 * is dropped.
 */
export function prefWeightAxes(options: Readonly<Record<string, readonly string[]>>): PrefWeightAxes {
  const pairs = Object.entries(options).flatMap(([by, of]) => of.map((option) => [by, option] as const));
  return {
    count: pairs.length,
    names: pairs.map(([by, option]) => `${by}.${option}`),
    to: (weights) => pairs.map(([by, option]) => weights[by]?.[option] ?? 0),
    from: (axes) => {
      const out: Record<string, Record<string, number>> = {};
      pairs.forEach(([by, option], i) => {
        (out[by] ??= {})[option] = axes[i] ?? 0;
      });
      return out;
    },
  };
}
