/**
 * The shapes a reach tree is built from and asked with. Nothing here is 2D:
 * a box is `[min…, max…]` in the tree's dimension.
 */
import type { HalfSpace } from '@weasel-js/geom/nd';
import type { SceneTouches } from 'core/scene/sceneTouches';

/** What a box holds: nothing, a finite box, or everything (a node nothing can bound). */
export type BoxKind = 0 | 1 | 2;
export const BOX_NONE: BoxKind = 0;
export const BOX_SOME: BoxKind = 1;
export const BOX_ALL: BoxKind = 2;

/** A ray from `origin` along `dir`, out to `tMax` in units of `dir`. A reader may shorten `tMax` as it finds
 *  nearer hits; the tree reads it at each test. */
export interface ReachRay { readonly origin: ArrayLike<number>; readonly dir: ArrayLike<number>; tMax: number }

/** Where a query looks: a box, the inside of every half-space (a frustum, a screen rect seen in 3D), or a ray. */
export type ReachRegion =
  | { readonly box: ArrayLike<number> }
  | { readonly planes: readonly HalfSpace[] }
  | { readonly ray: ReachRay };

/**
 * A question to a reach tree. Each node carries tag bits (the render index's
 * are its layer's), and a node meets the query when one of its bits is in
 * `wanted` and its box meets that bit's region; a wanted bit with no region
 * meets everywhere.
 */
export interface ReachQuery {
  readonly wanted: number;
  readonly regions: readonly (ReachRegion | undefined)[];
}

/** Where a container paints its children again: the image of a box under one copy. */
export type BoxImage = (src: Float64Array, at: number, out: Float64Array, outAt: number) => void;

/** The tree a reach tree indexes, and the box each of its nodes owns. */
export interface ReachSource {
  readonly dim: number;
  /** The scene's touched-ids feed, which the tree updates from. */
  changesSince(token?: number): SceneTouches;
  /** Children in paint order; `null` is the roots. */
  childrenOf(id: string | null): readonly string[];
  /** The parent of a node in the scene (`null` for a root), `undefined` for one not in it. */
  parentOf(id: string): string | null | undefined;
  /** Write the node's own box at `out[at…]` and say what it holds. */
  ownBox(id: string, out: Float64Array, at: number): BoxKind;
  tagsOf(id: string): number;
  /** The copies a container paints its children in, or null for none. */
  imagesOf?(id: string): readonly BoxImage[] | null;
}
