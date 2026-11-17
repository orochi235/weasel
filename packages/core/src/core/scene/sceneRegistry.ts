import type { LayoutStrategy } from '../../layout/types';
import type { ClipFromPoseFn, CopiesFromPoseFn, DerivePathFn, DerivePoseFn } from './nodeFnTypes';
import type { SerializedNode, SerializedNodeV1 } from './serializedTypes';

/** A node as a save of any version holds it, before anything is resolved. */
export type SavedNode = SerializedNode<unknown, string, unknown> | SerializedNodeV1<unknown, string, unknown>;

/**
 * Rewrites one saved node from an older shape to the current one, run on every node of a save
 * before it loads: the way a package renames a field of its node data, or a registry key, without
 * breaking saves written under the old name. Returns a new node, never changes the one it is
 * handed, and returns a node already in the current shape as it is.
 */
export type NodeUpgrade = (node: SavedNode) => SavedNode;

/** Per-scene registry mapping string keys to live function references.
 *  Passed to `createScene({ ..., registry })` and `sceneFromJSON(json, { registry })`.
 *  Each function-field type has its own keyed map. */
export interface SceneRegistry<TPose, TData = unknown, TLayer extends string = string> {
  /** Maps registry keys to `clipFromPose` factory functions for nodes. */
  clipFromPose?: Readonly<Record<string, ClipFromPoseFn<TPose>>>;
  /** Maps registry keys to `copiesFromPose` functions for nodes. */
  copiesFromPose?: Readonly<Record<string, CopiesFromPoseFn<TPose, TData, TLayer>>>;
  /** Maps registry keys to `derivePath` functions for nodes with `dependsOn`. */
  derivePath?: Readonly<Record<string, DerivePathFn<TPose, TData, TLayer>>>;
  /** Maps registry keys to `derivePose` functions for nodes with `dependsOn`. */
  derivePose?: Readonly<Record<string, DerivePoseFn<TPose, TData, TLayer>>>;
  /** Maps registry keys to layout strategies. */
  layout?: Readonly<Record<string, LayoutStrategy<TPose>>>;
  /** Upgrades run on each saved node as it loads, in key order. Keyed, so merging two registries
   *  that both carry one keeps a single copy. Never written to a save. */
  upgrades?: Readonly<Record<string, NodeUpgrade>>;
  // A new function field is a row in `NODE_FN_FIELDS` (core/scene/nodeFnFields.ts)
  // plus its entry here; the field name is the registry key by construction. `upgrades` is not one.
}
