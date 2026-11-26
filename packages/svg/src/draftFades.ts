/**
 * Which animated opacities reach a draft. An element's `opacity` is multiplied into the paints of
 * every leaf under it (`svgNodesToKitDrafts`), so a clip moving one needs each leaf to say which
 * animated elements it is faded by, and by how much everything else fades it.
 */
import type { Clip } from '@weasel-js/animator';
import type { SvgKitLeafData } from './fromKit';
import type { SvgNode } from './types';

/** What fades a leaf: the static `opacity` of each animated element over it or on it, by id, and
 *  the product of every other opacity that does. */
export interface Fades {
  readonly by: Readonly<Record<string, number>>;
  readonly rest: number;
}

/** A leaf draft's fades, and its paints as they are before any opacity fades them. */
export interface DraftFade extends Fades {
  readonly unfaded: SvgKitLeafData;
}

export const NO_FADES: Fades = { by: {}, rest: 1 };

/** The ids whose opacity `clip` moves. */
function fadersOf(clip: Clip | undefined): ReadonlySet<string> {
  const opacity = new Set<string>();
  for (const t of clip?.tracks ?? []) {
    if (t.kind === 'sampled' && t.target?.endsWith('.opacity')) opacity.add(t.target.slice(0, -'.opacity'.length));
  }
  return opacity;
}

/** `fades` with `n`'s own opacity taken in. */
function fadesUnder(fades: Fades, n: SvgNode, animated: ReadonlySet<string>): Fades {
  const o = n.opacity ?? 1;
  if (n.id !== undefined && animated.has(n.id)) return { by: { ...fades.by, [n.id]: o }, rest: fades.rest };
  return o === 1 ? fades : { by: fades.by, rest: fades.rest * o };
}

/** The fades of a walk down a tree: `now` is what fades the node being visited, and `under(n, visit)` visits beneath `n`. */
export interface FadeWalk {
  readonly now: Fades;
  under<T>(n: SvgNode, visit: () => T): T;
  /** The `fade` a leaf `source` drafted now carries, or undefined where no animation reaches it. */
  fadeOf(source: SvgNode, unfaded: () => SvgKitLeafData): DraftFade | undefined;
}

/** A walk of the fades `clip` animates. */
export function createFadeWalk(clip: Clip | undefined): FadeWalk {
  const faders = fadersOf(clip);
  const walk: FadeWalk = {
    now: NO_FADES,
    under(n, visit) {
      const outer = walk.now;
      (walk as { now: Fades }).now = fadesUnder(outer, n, faders);
      try {
        return visit();
      } finally {
        (walk as { now: Fades }).now = outer;
      }
    },
    fadeOf(source, unfaded) {
      const from = source.animatedFrom;
      const reached = Object.keys(walk.now.by).length > 0 || from?.['fill-opacity'] !== undefined || from?.['stroke-opacity'] !== undefined;
      return reached ? { ...walk.now, unfaded: unfaded() } : undefined;
    },
  };
  return walk;
}
