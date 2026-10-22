/**
 * Which paints a drafted node takes from its container as `'inherit'` rather
 * than as a copy — see `svgNodesToKitDrafts`.
 */
import type { SvgGroupNode, SvgNode, SvgPaint } from './types';

/** For each paint, the opacity its container's was faded by, where a child
 *  can take it whole: a solid one, which no child's box changes. */
export type Takes = { fill?: number; stroke?: number };
export const NO_TAKES: Takes = {};

/** Which paints `n` takes from its container as `'inherit'`: those it sets
 *  none of, when it is faded no further than the source was. */
export function takesOf(n: SvgNode, from: Takes, k: number): { fill: boolean; stroke: boolean } {
  const inherits = n.kind === 'path' || n.kind === 'text' || n.kind === 'group' ? n.inherits : undefined;
  return { fill: inherits?.fill === true && from.fill === k, stroke: inherits?.stroke === true && from.stroke === k };
}

const solidOrNone = (p: SvgPaint | undefined): boolean => p === undefined || p.kind === 'solid' || p.kind === 'none';

/** What `group`'s children can take from its container. */
export function groupTakes(group: SvgGroupNode, takes: { fill: boolean; stroke: boolean }, k: number): Takes {
  const fill = group.inherits?.fill ? takes.fill : solidOrNone(group.fill);
  const stroke = group.inherits?.stroke ? takes.stroke : solidOrNone(group.stroke?.paint);
  return { ...(fill ? { fill: k } : {}), ...(stroke ? { stroke: k } : {}) };
}
