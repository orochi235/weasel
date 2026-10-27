import type { LayoutStrategy } from '../../layout/types';
import type { ClipFromPoseFn, CopiesFromPoseFn, DerivePathFn, DerivePoseFn } from './nodeFnTypes';

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
  // A new function field is a row in `NODE_FN_FIELDS` (core/scene/nodeFnFields.ts)
  // plus its entry here; the field name is the registry key by construction.
}
