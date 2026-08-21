/**
 * Kit-standard DepSchema augmentation.
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
 *   set(v: View): void }` is defined here; a future refinement may include
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
import type { Op } from 'core/ops/types';
import type { InsertAdapter } from 'core/adapters/types';
import type { History } from '@weasel-js/history';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import type { ActiveToolContextValue } from './activeToolContext';
import type { TextEditDep } from './defaults/enterTextEdit';
import type { SliceDep } from './defaults/slice';
import type { ClipboardDep } from './defaults/clipboard';
import type {
  PointSnapBehavior,
  BoundsConstraint,
  ResizePose,
} from '../gestures/types';
import type { PoseProjection } from './resize/geometry';
import type { GeometryProjection } from './geometryProjection';
import type { DragSample } from './invoker';

/** Minimal view API the action layer consumes. May be refined later. */
export interface ViewApi {
  get(): View;
  set(v: View): void;
  /** Optional recenter callback. When wired, `viewportZoomAction`'s
   *  `reset` branch (Cmd-0) calls this instead of resetting to identity —
   *  letting consumers re-fit the page (or other reference bounds) into
   *  the workspace. Receives no args; the consumer reads its own bounds
   *  + host dims and dispatches `setView(...)`. */
  recenter?(): void;
  /** Optional canvas-local host dimensions (CSS px). When wired,
   *  `viewportZoomAction`'s keyboard branches (Cmd+= / Cmd+-) anchor at the
   *  host center instead of the top-left origin. Null when the host isn't
   *  measurable (unmounted). */
  hostSize?(): { width: number; height: number } | null;
}

/**
 * Adapter dep for `areaSelectAction`.
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

/** What an area-selecting action needs: a way to ask what a region covers,
 *  and a way to read and replace the selection. */
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

  /**
   * Anchors currently selected within the edited path, as **flat anchor
   * indices** — the same numbering `enumerateAnchors` produces and the
   * `anchor:N` affordance kinds carry.
   *
   * Selection is transient UI state, deliberately not part of the scene:
   * it is cleared whenever `editingId` changes, and any edit that
   * renumbers anchors (insert, delete) is responsible for leaving it
   * coherent. Empty means "no anchor selected" — the keyboard actions
   * (nudge, delete) no-op rather than acting on all anchors, matching
   * Illustrator.
   */
  selectedAnchors: ReadonlySet<number>;
  /** Replace the anchor selection. Pass an empty iterable to clear. */
  setSelectedAnchors(next: Iterable<number>): void;

  /**
   * In-flight anchor-marquee rect in world coords, or null when no
   * marquee drag is active. Written by `marqueeAnchorsAction` and read by
   * the path-editing overlay — the same "ongoing action owns the preview,
   * chrome just draws it" split the move/resize ghosts use.
   */
  marquee: { x: number; y: number; width: number; height: number } | null;
  /** Set or clear the in-flight marquee rect. */
  setMarquee(rect: { x: number; y: number; width: number; height: number } | null): void;
}

/**
 * Adapter dep for `lassoSelectAction`.
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
 * Options for the kit `image/svg+xml` content handler, threaded from
 * SceneCanvas's `ingestion={{ svg }}` prop.
 */
export interface SvgIngestOptions {
  /** Parse dropped/pasted/picked SVG files into native scene nodes (path /
   *  text leaves under containers mirroring the source `<g>` structure)
   *  instead of the default single embedded-image node.
   *
   *  Pass `unpackSvgFiles` from `@weasel-js/svg`:
   *
   *  ```ts
   *  import { unpackSvgFiles } from '@weasel-js/svg';
   *  <SceneCanvas ingestion={{ svg: { unpack: unpackSvgFiles } }} />
   *  ```
   *
   *  It is injected rather than flagged on with `true` because the SVG parser
   *  lives in `@weasel-js/svg`, which depends on this package — core importing
   *  it back would make the two mutually dependent and unpublishable
   *  separately. Passing the function keeps the parser out of core's bundle
   *  for consumers who never unpack. */
  unpack?: SvgUnpacker;
}

/** Parses SVG files and inserts the resulting nodes into `ctx.scene`, as one
 *  `applyOps` batch per file. Implemented by `unpackSvgFiles` in
 *  `@weasel-js/svg`; see {@link SvgIngestOptions.unpack}. */
export type SvgUnpacker = (
  files: File[],
  ctx: import('../../features/ingestion/contentHandlers').IngestCtx,
) => Promise<void>;

/**
 * Clipboard-paste seam consumed by the kit weasel-JSON content handler
 * (`IngestCtx.clipboard`). Built by `<SceneCanvas>` from its own synthesized
 * adapter + the `ingestion.clipboard` prop; absent when the consumer set
 * `ingestion.clipboard.enabled === false` or the adapter lacks `commitPaste`.
 * Absence makes the handler decline inert (dwarn, nothing ingested) — its
 * matched items were already consumed at match time and do not fall through
 * to other handlers.
 */
export interface ClipboardIngestCtx {
  /** The hosting canvas's adapter — `commitPaste` materializes the pasted
   *  nodes (fresh ids, offset applied); insertion still goes through ops. */
  adapter: InsertAdapter<{ id: string }>;
  /** JSON reviver for the weasel wire payload (typed arrays etc.) — from
   *  `SceneCanvasProps.ingestion.clipboard.reviver`. */
  reviver?: (key: string, value: unknown) => unknown;
}

/**
 * Dep for the `ingest` action (external-content ingestion).
 * Sourced from `<SceneCanvas>` / `<StandardActionsRegistrar>` via
 * `useIngestionDepSource` — canvas rect + current view.
 */
export interface IngestionDep {
  /** Visible canvas area in world coordinates. */
  viewportWorldRect(): { x: number; y: number; width: number; height: number };
  /** Consumer file→src resolver (from SceneCanvas's `ingestion` prop).
   *  Live accessor — read it at use time. Destructuring (or copying the
   *  property early) snapshots the current value and won't track later
   *  prop changes across an `await`. */
  resolveSrc?: (file: File) => Promise<string>;
  /** Kit SVG-handler options (from SceneCanvas's `ingestion` prop).
   *  Live accessor, same caveat as `resolveSrc`. */
  svg?: SvgIngestOptions;
  /** Clipboard-paste seam for the kit weasel-JSON handler.
   *  Live accessor, same caveat as `resolveSrc`. */
  clipboard?: ClipboardIngestCtx;
}

/**
 * Per-kind extra geometry passed to `InsertDep.commit`.
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
  | { kind: 'pencil'; samples: ReadonlyArray<DragSample> }
  | { kind: 'text'; text?: string }
  | {
      kind: 'image';
      src?: string;
      opacity?: number;
      /** Chrome-only: what the in-flight drag paints. Read by the overlay
       *  layer, ignored by the insert dep. */
      preview?: 'bitmap' | 'outline';
    }
  | { kind: string; [extra: string]: unknown };

/**
 * World-space point snapping — grid, guides, or any consumer rule.
 *
 * Sourced by `<SceneCanvas>` from its `toolOptions.snapPoint`. Actions apply
 * it to the coords they ingest so the live preview and the committed
 * geometry agree; `insertAction` snaps the drag's start and current point.
 *
 * Optional: when the dep is absent, actions treat it as identity.
 */
export interface SnapDep {
  /** Snap a world-space point. Return `p` unchanged to opt out. */
  point(p: { x: number; y: number }): { x: number; y: number };
}

/**
 * Adapter dep for `insertAction`.
 *
 * Provided by `<SceneCanvas>` / `<StandardActionsRegistrar>`. The `extras`
 * carry the active tool's kind + per-kind geometry. Callers
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
 * Adapter dep for `resizeAction`.
 *
 * Carries the four behavior-shaping options the legacy `useResize` hook
 * exposed through `UseResizeOptions`: bounds-frame behaviors (e.g.
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

/**
 * Layout-strategy lookup by container id, consumed by `moveAction` to run
 * the drag-time reflow pass. Sourced by `<SceneCanvas>` from its `layouts`
 * prop. Optional: `getLayout` returns null for any container when no layout
 * is configured, so the reflow pass is a no-op then.
 */
export interface LayoutDep {
  getLayout(containerId: string): import('../../layout/types').LayoutStrategy<unknown> | null;
}

/**
 * The names an action may declare in `requires`, and what each resolves to.
 *
 * This is the whole vocabulary of things an action can reach — selection,
 * scene, view, history, and the rest. Consumers add their own entries by
 * augmenting the interface (`declare module '@weasel-js/core'`), which is what
 * makes a custom dep name type-check in `requires` and in the deps bag.
 */
export interface DepSchema {
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
   * Sourced from `<SceneCanvas>` via AABB overlap over all scene
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
   * Sourced from `<SceneCanvas>`. The `kind` param comes from
   * the active binding's `opts.params.kind`. Override per-consumer to
   * provide a typed node factory (e.g. with custom data payloads).
   */
  insert: InsertDep;
  /**
   * Snap dep — world-space point snapping (grid / guides).
   *
   * Sourced by `<SceneCanvas>` from `toolOptions.snapPoint`. Optional:
   * absent means no snapping (identity).
   */
  snap?: SnapDep;
  /**
   * Lasso-select dep — polygon hit-test + selection read/write.
   *
   * Sourced from `<SceneCanvas>` / `<StandardActionsRegistrar>`.
   * Falls back to AABB hit-test when `hitTestLasso` is absent.
   */
  lassoSelect: LassoSelectDep;
  /**
   * Edit-anchors dep — narrow read/write of one polygon's path pose.
   *
   * Sourced from consumer. Wraps `getPose`/`setPose`/`applyOps`
   * for the currently-being-edited polygon node.
   *
   * The `editAnchorsAction` requires this dep to be registered when anchor
   * editing is active. If absent, `start` returns an empty handle (no-op).
   */
  editAnchors: EditAnchorsDep;
  /**
   * Text-edit dep — activates the in-place text editing overlay.
   *
   * Sourced from consumer via `useTextEdit` / `useSceneTextEdit`.
   * The `enterTextEditAction` requires this dep to be registered by the text
   * tool when text editing is available.
   *
   * The optional `isTextNode` predicate guards against entering edit mode on
   * non-text nodes. A binding can pre-filter instead with a
   * `target: 'kind:text:selected'` spec; the guard remains for consumers who
   * bind the broader `'selected-body'` target or opted out of routing.
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
  /**
   * Layout-strategy lookup. Sourced by `<SceneCanvas>` from `layouts`.
   * Optional: absent (or all-null) → `moveAction` skips reflow.
   */
  layout?: LayoutDep;
  /**
   * Slice dep — consumer-supplied commit for the Slice action.
   *
   * Receives the finite slice segment in world coordinates; the consumer
   * scans the scene, splits crossed paths via `splitPathByLine`, and
   * applies the result as one undoable batch.
   *
   * Optional: when absent, `sliceAction` is a no-op.
   */
  slice?: SliceDep;
  /**
   * Clipboard dep — the imperative surface `useClipboardOps` returns.
   *
   * Published by the consumer (`useDepSource('clipboard', …)` from under
   * `<SceneCanvas>`), because `useClipboardOps` needs an adapter and a
   * selection reader only the consumer has. Feeds `clipboard.copy` /
   * `clipboard.cut`; both no-op when the dep is absent.
   */
  clipboard?: ClipboardDep;
  /**
   * Optional consumer commit hook. When present, `moveAction` (and other
   * default actions) submit their committed ops through it instead of
   * `scene.applyBatch`, so apps with their own history integration
   * (checkpoint + push entry) capture the gesture as one undo entry.
   * When absent, commits fall back to `scene.applyBatch`.
   */
  applyOps?: (ops: Op[], label: string) => void;
  /** Optional pose-composition strategy for hierarchical (local-pose) scenes.
   *  When absent, defaults to IDENTITY (absolute-pose: nodes store world
   *  coords). Local-pose consumers supply { compose: composeRectPose,
   *  decompose: decomposeRectPose } (or their pose shape's equivalent). */
  poseComposition?: import('../../features/groups/composePose').PoseComposition<unknown>;
  /**
   * Ingestion dep — canvas viewport rect + consumer file→src resolver.
   *
   * Sourced from `<SceneCanvas>` / `<StandardActionsRegistrar>` via
   * `useIngestionDepSource`. Feeds `ingestAction` with the world-space
   * viewport rect for paste-placement and image fit-clamping, and forwards
   * the consumer's optional `resolveSrc` seam.
   *
   * Optional: when absent, the `ingest` action no-ops (there is no
   * placement geometry to work with).
   */
  ingestion?: IngestionDep;
  /**
   * Optional consumer seam for the eager-sync layer: lets pose-transform
   * actions (resize/move/nudge/flip — NOT rotate) ALSO rewrite a node's
   * data-held geometry. Given a node and the affine `m` applied to its pose,
   * `transform(node, m)` returns updated `data` (geometry mapped by `m`) or
   * `null` for nodes with no data-held geometry.
   *
   * Strictly opt-in: when absent (or when `transform` returns null), the kit
   * emits only the pose op and leaves `data` untouched. apps/draw wires this
   * to mirror `data.path` through `transformPath`. Rotate intentionally never
   * consults this seam (rotation lives on the pose, baked at render).
   */
  geometryProjection?: GeometryProjection;
}

/**
 * Every dep name the registry knows about — derived from {@link DepSchema} so
 * the two can't drift.
 *
 * Declared here rather than beside the registry so that this `keyof` reference
 * resolves to the exported `DepSchema` declaration; from another module it
 * resolves to that module's import alias, which the API docs can't link.
 */
export type DepName = keyof DepSchema;
