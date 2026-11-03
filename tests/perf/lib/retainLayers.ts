/**
 * The world layers the retained-surface specs draw, imported by the page over
 * vite's `@fs` route, so it imports nothing.
 *
 * Each layer's content is laid out over twice the canvas each way and moved so
 * it centers on it, so a surface drawn with a pan margin really does run out
 * of it. Half solid, a third text, the rest image: no screen-unit paint, which
 * would keep a layer from moving with the view.
 */
import type { LeafBuilder } from './kinds';

export interface RetainLayer {
  id: string; label: string; draw: () => unknown[]; deps?: () => readonly unknown[]; retain?: boolean;
}

interface Kinds { solid: LeafBuilder; text: LeafBuilder; image: LeafBuilder; gradient: LeafBuilder }

const constDeps = [1] as const;

/** `n` layers of `m` commands each, retained when `retain`, each also holding
 *  a gradient in screen units when `fixed`. */
export function worldLayers(
  kinds: Kinds, n: number, m: number, w: number, h: number, { retain = true, fixed = false } = {},
): RetainLayer[] {
  const leaf = (i: number): unknown => {
    const k = i % 6;
    return k < 3 ? kinds.solid(i) : k < 5 ? kinds.text(i) : kinds.image(i);
  };
  const centered = new Float32Array([1, 0, 0, 0, 1, 0, -w / 2, -h / 2, 1]);
  const out: RetainLayer[] = [];
  for (let l = 0; l < n; l++) {
    const children = Array.from({ length: m }, (_, j) => leaf(l * 7919 + j));
    if (fixed) children.push(kinds.gradient(l));
    const cmds = [{ kind: 'group', transform: centered, children }];
    out.push({ id: `L${l}`, label: `L${l}`, draw: () => cmds, deps: () => constDeps, retain });
  }
  return out;
}
