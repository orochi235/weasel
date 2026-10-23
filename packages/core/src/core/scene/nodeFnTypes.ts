import type { Affine, Path } from '@weasel-js/geom';
import type { InheritedPaint } from './inheritedPaint';
import type { Node } from './types';

/**
 * One dependency, as a derivation reads it: the node itself and the pose it is
 * painted at.
 *
 * The node comes along because a connector legitimately reads more than a box
 * — an edge that thickens with its endpoint's weight, or routes only to nodes
 * on a given layer, is answering off `data` and `layer`.
 */
export interface DerivedDep<TPose, TData = unknown, TLayer extends string = string> {
  node: Node<TData, TLayer, TPose>;
  /** Its override when it has one, else its own derived pose, else the pose
   *  the document stores — `effectivePose`, the same answer the renderer uses. */
  pose: TPose;
  /** The path a pose override shows it by, else the one it derives, else
   *  `null`; the document reading skips the override, and a `toPose` lookup
   *  carries it into the box its `toPose` answers. Read
   *  it to place something *along* a dependency: a label on a routed edge.
   *  Resolved on first read and memoized on the dependency. */
  readonly path: Path | null;
  /** What its `'inherit'` fill and stroke take from its containers, or
   *  `undefined` when it inherits nothing. A dependency built by hand rather
   *  than by the scene may leave it out, and then inherits nothing. */
  readonly inherited?: InheritedPaint;
}

/** `F` with its parameters checked bivariantly, as a method's are, so that a
 *  `Scene<D, L, MyPose>` is a `Scene<unknown, string, unknown>`. A callback for
 *  an unrelated pose is still rejected; one for a narrower pose is not. */
export type Bivariant<F extends (...args: never[]) => unknown> = {
  method(...args: Parameters<F>): ReturnType<F>;
}['method'];

/** Computes a node's path from its dependencies: the type of a node's
 *  `derivePath` and of each entry in `SceneRegistry.derivePath`. */
export type DerivePathFn<TPose, TData = unknown, TLayer extends string = string> = Bivariant<(
  node: Node<TData, TLayer, TPose>,
  deps: readonly (DerivedDep<TPose, TData, TLayer> | undefined)[],
) => Path | null>;

/** Computes a node's pose from its dependencies: the type of a node's
 *  `derivePose` and of each entry in `SceneRegistry.derivePose`. */
export type DerivePoseFn<TPose, TData = unknown, TLayer extends string = string> = Bivariant<(
  node: Node<TData, TLayer, TPose>,
  deps: readonly (DerivedDep<TPose, TData, TLayer> | undefined)[],
) => TPose | null>;

/** A container's clip, from its pose: the type of `clipFromPose`
 *  and of each entry in `SceneRegistry.clipFromPose`. */
export type ClipFromPoseFn<TPose> = Bivariant<(pose: TPose) => Path | null>;

/** The extra times a container draws its children: the type of
 *  `copiesFromPose` and of each entry in
 *  `SceneRegistry.copiesFromPose`. Each affine is in world coordinates and
 *  carries the children, as drawn, to one copy. */
export type CopiesFromPoseFn<TPose, TData = unknown, TLayer extends string = string> = Bivariant<(
  pose: TPose,
  node: Node<TData, TLayer, TPose>,
) => readonly Affine[] | null>;
