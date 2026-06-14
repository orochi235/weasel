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
import type { History } from '@weasel-js/history';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import type { ActiveToolContextValue } from './activeToolContext';
import type { TextEditDep } from './defaults/enterTextEdit';
import type {
  PointSnapBehavior,
  BoundsConstraint,
  ResizePose,
} from '../gestures/types';
import type { PoseProjection } from './resize/geometry';

/** Minimal view API the action layer consumes. Phase 5+ may refine. */
export interface ViewApi {
  get(): View;
  set(v: View): void;
  /** Optional recenter callback. When wired, `viewportZoomAction`'s
   *  `reset` branch (Cmd-0) calls this instead of resetting to identity —
   *  letting consumers re-fit the page (or other reference bounds) into
   *  the workspace. Receives no args; the consumer reads its own bounds
   *  + host dims and dispatches `setView(...)`. */
  recenter?(): void;
}

/**
 * Adapter dep for `areaSelectAction` (Phase 11).
 *
 * Provided by `<SceneCanvas>` / `<StandardActionsRegistrar>` via AABB
 * overlap over scene nodes. Consumers with custom hit-testing override this
 * dep entry in their own registrar.
 */
/**
 * Topmost-node-at-world-point dep, consumed by `moveAction` for
 * reparent-on-drop and available to any action that needs a single-best
 * pick. Mirrors the same hit-test plumbing `<SceneCanvas>` feeds to the
 * tool dispatcher; consumers with custom hit-testing override here.
 *
 * `exclude` is iterated once per call and treated as a set membership
 * test — the dep walks hits front-to-back and returns the first id not
 * in the exclude set. Pass moving-node roots + their descendants when
 * the caller wants to ignore the nodes it's manipulating.
 */
export type NodeAtPointDep = (
  point: { x: number; y: number },
  exclude?: Iterable<NodeId>,
) => NodeId | null;

export interface AreaSelectDep {
  /** Return ids of all scene nodes whose AABB overlaps `bounds`. */
  hitTestArea(bounds: { x: number; y: number; width: number; height: number }): NodeId[];
  /** Return the current selection id list. */
  getSelection(): NodeId[];
  /** Replace the current selection. */
  setSelection(ids: NodeId[]): void;
}

/**
 * Adapter dep for `editAnchorsAction`.
 *
 * Provides narrow read/write access to the editable polygon for a single
 * node. Consumers register this dep so anchor-edit actions can read/write
 * the polygon WITHOUT knowing whether it lives directly on the node's
 * pose (`pose.kind === 'polygon'`) or on `node.data.path` (the kit's
 * built-in pen-tool default, also WeaselDraw's shape).
 *
 * Note on live previews: in-flight edit state is surfaced through the
 * dispatcher's standard `OngoingHandle.previewIds/previewPose/previewData`
 * triple (not this dep), so chrome and preview-ghost stay in lock-step
 * via one source of truth.
 */
export interface EditAnchorsDep {
  /** Id of the node currently being edited. Empty string means no node is
   *  currently in edit mode — the chrome and gesture both opt out. */
  editingId: string;
  /** Enter/exit edit mode for a specific node. Pass `null` (or an empty
   *  string) to exit. `enterPathEditAction` and `exitPathEditAction` call
   *  this; consumers can call it directly to drive edit mode programmatically. */
  setEditingId(id: string | null): void;
  /** Returns the COMMITTED editable polygon in world coordinates, or
   *  null if this node has no editable polygon. Does NOT consult in-
   *  flight previews — callers that need live state read the dispatcher's
   *  in-flight handles. */
  getEditablePath(id: string): unknown;
  /** Returns where the polygon is stored — `'pose'` when `node.pose`
   *  IS the polygon, `'data'` when it lives on `node.data.path` with a
   *  rect pose, or `null` when the node has no editable polygon. The
   *  action uses this to know which preview-ghost axis to populate
   *  (`previewPose` only / `previewData` + `previewPose` for data.path). */
  getStorageKind(id: string): 'pose' | 'data' | null;
  /** Returns the node's raw `pose` and `data` so storage-aware actions
   *  can capture origin state at gesture-start and synthesize a matching
   *  `previewPose` / `previewData` during `onMove`. Used by
   *  `editAnchorsAction` for the data.path branch (rect pose + data
   *  carrying extra fields like fill / stroke that must be preserved
   *  through the preview). Returns null when the node is gone. */
  getNodeShape(id: string): { pose: unknown; data: unknown } | null;
  /** Commit `worldPath` as the new value for `id`. Implementation routes
   *  to setPose (when pose IS the polygon) or batched setPose+update
   *  (when the polygon lives on data.path). Records one history entry
   *  labelled `label`. */
  applyEdit(id: string, worldPath: unknown, label: string): void;
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
 * Per-kind extra geometry passed to `InsertDep.commit` (Phase 14c.3).
 *
 * Built-in tools populate a typed variant so the kit's default factory can
 * render the true tool params (line endpoints, polygon side count, star
 * geometry, pencil sample list). Consumer-defined tools may pass any
 * `{ kind: string; ... }` payload; the kit's factory falls back to AABB
 * inscription for unknown kinds.
 *
 * `bounds` is still passed alongside as a useful AABB pose hint — factories
 * may use it as the node's pose even when richer geometry is available.
 */
export type InsertExtras =
  | { kind: 'rect' }
  | { kind: 'ellipse' }
  | { kind: 'line'; a: { x: number; y: number }; b: { x: number; y: number } }
  | { kind: 'polygon'; sides: number; rotation: number; center?: { x: number; y: number }; radius?: number }
  | { kind: 'star'; points: number; innerRadiusRatio: number; rotation: number; center?: { x: number; y: number }; outerRadius?: number }
  | { kind: 'pencil'; samples: ReadonlyArray<{ x: number; y: number }> }
  | { kind: string; [extra: string]: unknown };

/**
 * Adapter dep for `insertAction` (Phase 11).
 *
 * Provided by `<SceneCanvas>` / `<StandardActionsRegistrar>`. The `extras`
 * carry the active tool's kind + per-kind geometry (Phase 14c.3). Callers
 * that need typed data must supply a richer `insert` dep.
 */
export interface InsertDep {
  /**
   * Materialise a new node from the given drag-rect bounds and typed
   * per-kind extras. Returns the new node's id, or `null` if the consumer
   * rejected the insert (e.g. sub-threshold bounds, unknown kind).
   */
  commit(
    bounds: { x: number; y: number; width: number; height: number },
    extras: InsertExtras,
  ): NodeId | null;
}

/**
 * Adapter dep for `resizeAction` (Phase 14e — resize-behaviors-api).
 *
 * Carries the four behavior-shaping options the legacy `useResize` hook
 * exposes through `UseResizeOptions`: bounds-frame behaviors (e.g.
 * `lockAspectWithModifier`), world-space anchor-point snap behaviors (e.g.
 * `pointSnapToGrid`), group-expansion (`expandIds`), and pose↔bounds
 * projection (`geometry`).
 *
 * Optional in `DepSchema`: when absent, `resizeAction` falls back to
 * identity defaults (no behaviors, identity expandIds, `RECT_POSE_DESCRIPTOR`
 * geometry). Consumers wire the dep via `useDepSource('resizePolicy', ...)`
 * from any descendant of `<DepRegistryProvider>` / `<SceneCanvas>`.
 *
 * The generic is erased to `unknown` at the schema entry; consumers cast at
 * the call site (mirrors the `scene` entry's convention).
 */
export interface ResizePolicy<TPose> {
  /** Bounds-frame constraints. Constrained to `TPose extends ResizePose` since
   *  constraints read/write `{x,y,width,height}`. For non-rect TPose pass `[]`. */
  constraints: TPose extends ResizePose ? BoundsConstraint<TPose>[] : never[];
  /** World-space anchor-point snap behaviors. Same TPose constraint as
   *  `constraints`. */
  pointSnap: TPose extends ResizePose ? PointSnapBehavior<TPose>[] : never[];
  /** Group-expansion at gesture start. Identity (`ids => ids`) when group
   *  resize isn't wanted. */
  expandIds: (ids: string[]) => string[];
  /** Projection from `TPose` to bounds and back. Use `RECT_POSE_DESCRIPTOR`
   *  for plain rect poses. */
  projection: PoseProjection<TPose>;
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
     * Topmost node at a world-space point. Sourced by `<SceneCanvas>` from
     * the same picker that feeds the tool dispatcher's `getNodeAtPoint`.
     * Optional: actions that read this (e.g. `moveAction` reparent-on-drop)
     * fall back to a no-op when the dep isn't registered.
     */
    nodeAtPoint?: NodeAtPointDep;
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
    /**
     * Text-edit dep — activates the in-place text editing overlay.
     *
     * Phase 14c.3: sourced from consumer via `useTextEdit` / `useSceneTextEdit`.
     * The `enterTextEditAction` requires this dep to be registered by the text
     * tool when text editing is available.
     *
     * The optional `isTextNode` predicate guards against entering edit mode on
     * non-text nodes when no per-kind binding filter is available (Phase 14e
     * follow-up will add per-kind classification to `classifyTarget`).
     */
    textEdit: TextEditDep;
    /**
     * Resize-policy dep — bounds constraints, point-snap behaviors,
     * group expansion, and pose↔bounds projection for `resizeAction`.
     *
     * Optional: when omitted, `resizeAction` falls back to identity defaults
     * (no constraints, no snap, identity expandIds, `RECT_POSE_DESCRIPTOR`).
     * Consumers wire via `useDepSource('resizePolicy', ...)` or the
     * `useResizePolicy` helper.
     */
    resizePolicy?: ResizePolicy<unknown>;
    /**
     * Booleans adapter — read selection ids, fetch world-space `Path`s,
     * compare z-order, and mint result nodes for Pathfinder ops.
     *
     * Consumers wire via `useBooleansAdapter(adapter)` (a thin wrapper
     * around `useDepSource('booleansAdapter', ...)`). The descriptor's
     * `enabled` predicate reads `deps.selection` for the count check; the
     * invoker reads `deps.booleansAdapter` to execute the op.
     */
    booleansAdapter?: import('./booleans/booleans').BooleansAdapter;
    /**
     * Gesture dispatcher control surface — exposes `cancelAll(reason)` so
     * actions that need to abort an in-flight handle (Escape cancels a
     * drag, etc.) can do so. Sourced by `<SceneCanvas>` from the
     * dispatcher instance it already owns.
     */
    dispatcher?: { cancelAll(reason: 'commit' | 'cancel'): void };
  }
}

export {};
