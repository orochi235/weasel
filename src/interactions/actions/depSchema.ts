/**
 * Kit-standard DepSchema augmentation (Phase 4 of registry unification).
 *
 * Adds the named entries the kit's default actions consume. Consumer apps
 * add their own entries (e.g. `color`) via the same declaration-merging
 * pattern in their own files.
 *
 * Side-effect import: importing this file augments the shared DepSchema
 * type. Re-exported from `src/index.ts` so consumers get the entries
 * automatically.
 *
 * ## Improvisation notes
 *
 * - **`view`**: No `ViewApi` interface existed. A minimal `{ get(): View;
 *   set(v: View): void }` is defined here; Phase 5+ may refine to include
 *   animation helpers or fit-to-bounds.
 *
 * - **`scene`**: `Scene<TData, TLayer, TPose>` is a generic interface with no
 *   canonical "erased" alias. We use `Scene<unknown, string, unknown>` as the
 *   dep-schema entry; actions that need a typed scene should narrow at the
 *   call site. A future phase may introduce a `SceneApi` alias once the common
 *   subset stabilises.
 *
 * - **`pointer`**: `PointerContextValue` is marked `@experimental` upstream.
 *   Registered here as-is; if the contract changes, update this import and
 *   the augmentation below.
 *
 * @see docs/superpowers/specs/2026-05-16-registry-unification-design.md
 */

import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import type { Scene, NodeId } from 'core/scene/types';
import type { History } from 'core/history/history';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import type { ActiveToolContextValue } from './activeToolContext';

/** Minimal view API the action layer consumes. Phase 5+ may refine. */
export interface ViewApi {
  get(): View;
  set(v: View): void;
}

/**
 * Adapter dep for `areaSelectAction` (Phase 11).
 *
 * Provided by `<SceneCanvas>` / `<StandardActionsRegistrar>` via AABB
 * overlap over scene nodes. Consumers with custom hit-testing override this
 * dep entry in their own registrar.
 */
export interface AreaSelectDep {
  /** Return ids of all scene nodes whose AABB overlaps `bounds`. */
  hitTestArea(bounds: { x: number; y: number; width: number; height: number }): NodeId[];
  /** Return the current selection id list. */
  getSelection(): NodeId[];
  /** Replace the current selection. */
  setSelection(ids: NodeId[]): void;
}

/**
 * Adapter dep for `editAnchorsAction` (Phase 14b).
 *
 * Provides narrow read/write of a single polygon node's path pose.
 * The consumer registers this dep when anchor-edit mode is active.
 *
 * `editingId` identifies the polygon currently being edited.
 * `getPose(id)` returns the current path (must be a PolygonPath for editing).
 * `applyOps(ops, label)` commits a transform op to history.
 */
export interface EditAnchorsDep {
  /** Id of the node currently being edited. */
  editingId: string;
  /** Returns the polygon path for the given node. */
  getPose(id: string): unknown;
  /** Commits ops to history (erased form; dispatchApplyBatch handles narrowing). */
  applyOps?(ops: { apply(adapter: unknown): void }[], label?: string): void;
}

/**
 * Adapter dep for `lassoSelectAction` (Phase 14b).
 *
 * Provides polygon-lasso hit-testing + selection read/write.
 * Consumers that don't implement `hitTestLasso` can omit it; the action
 * falls back to a bounding-box AABB test via `hitTestArea`.
 */
export interface LassoSelectDep {
  /**
   * Hit-test against a closed polygon (vertex order CW or CCW; last→first
   * closing edge is implicit). Returns matching node ids.
   * Optional — when absent, `lassoSelectAction` falls back to AABB via
   * `hitTestArea`.
   */
  hitTestLasso?(
    polygon: ReadonlyArray<{ x: number; y: number }>,
    mode: 'centers' | 'intersect' | 'enclosed',
  ): string[];
  /** Return ids of nodes whose AABB overlaps the given rect (fallback). */
  hitTestArea(bounds: { x: number; y: number; width: number; height: number }): string[];
  /** Return the current selection id list. */
  getSelection(): string[];
  /** Replace the current selection. */
  setSelection(ids: string[]): void;
}

/**
 * Adapter dep for `insertAction` (Phase 11).
 *
 * Provided by `<SceneCanvas>` / `<StandardActionsRegistrar>`. The `kind`
 * is forwarded from the binding's `opts.params.kind` (set by the active
 * tool). Callers that need typed data must supply a richer `insert` dep.
 */
export interface InsertDep {
  /**
   * Materialise a new node of `kind` with the given drag-rect bounds.
   * Returns the new node's id, or `null` if the consumer rejected the insert
   * (e.g. sub-threshold bounds, unknown kind).
   */
  commit(bounds: { x: number; y: number; width: number; height: number }, kind: string): NodeId | null;
}

declare module './depRegistry' {
  interface DepSchema {
    /** Kit selection state — ids of currently selected nodes. */
    selection: SelectionApi;
    /** Current viewport — camera position + scale. */
    view: ViewApi;
    /**
     * Scene tree — structural reads + undoable mutations.
     *
     * The entry uses the fully-erased form `Scene<unknown, string, unknown>`
     * because `DepSchema` must be concrete. Actions that need a typed scene
     * should cast: `deps.scene as Scene<MyData, MyLayer, MyPose>`.
     */
    scene: Scene<unknown, string, unknown>;
    /** Undo/redo history bound to the current scene. */
    history: History;
    /**
     * Canvas pointer position in world space.
     *
     * Exposes `pointerRef` (mutable live ref) and `getDropPoint()` thunk.
     * Marked `@experimental` in the source.
     */
    pointer: PointerContextValue;
    /** Currently active tool id + hotkey-hold stack. */
    activeTool: ActiveToolContextValue;
    /**
     * Area-select dep — AABB hit-test + selection read/write.
     *
     * Phase 11: sourced from `<SceneCanvas>` via AABB overlap over all scene
     * nodes. Override per-consumer for custom hit-testing (e.g. contain-mode,
     * lock-aware filtering).
     */
    areaSelect: AreaSelectDep;
    /**
     * Insert dep — node factory for drag-to-insert.
     *
     * Phase 11: sourced from `<SceneCanvas>`. The `kind` param comes from
     * the active binding's `opts.params.kind`. Override per-consumer to
     * provide a typed node factory (e.g. with custom data payloads).
     */
    insert: InsertDep;
    /**
     * Lasso-select dep — polygon hit-test + selection read/write.
     *
     * Phase 14b: sourced from `<SceneCanvas>` / `<StandardActionsRegistrar>`.
     * Falls back to AABB hit-test when `hitTestLasso` is absent.
     */
    lassoSelect: LassoSelectDep;
    /**
     * Edit-anchors dep — narrow read/write of one polygon's path pose.
     *
     * Phase 14b: sourced from consumer. Wraps `getPose`/`setPose`/`applyOps`
     * for the currently-being-edited polygon node.
     *
     * The `editAnchorsAction` requires this dep to be registered when anchor
     * editing is active. If absent, `start` returns an empty handle (no-op).
     */
    editAnchors: EditAnchorsDep;
  }
}

export {};
