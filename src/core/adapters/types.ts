import type { Op } from '../ops/types';

/**
 * Opaque clipboard payload. `items` is `unknown[]` so each app's clipboard
 * adapter stores whatever shape it wants; the kit never inspects entries.
 *
 * The adapter is responsible for both producing snapshots
 * (`snapshotSelection`) and consuming them (`commitPaste`). Type safety lives
 * at that boundary, not in the kit.
 */
export interface ClipboardSnapshot {
  items: unknown[];
}

/**
 * SnapTarget — where a dragged object would re-parent to if released.
 *
 * `slotPose` is the pose (in world coordinates) the object should snap to
 * within the target. `metadata` is an opaque pass-through for app-specific
 * snap details (slot index, visual hint, etc.).
 */
export interface SnapTarget<TPose = unknown> {
  parentId: string;
  slotPose: TPose;
  metadata?: unknown;
}

/**
 * Full scene adapter. Most consumers implement narrow per-hook subsets
 * (MoveAdapter, ResizeAdapter, ClipboardAdapter, ...) — TypeScript's
 * structural typing means a wider adapter satisfies any narrower interface.
 *
 * **Pose semantics:** `getPose` / `setPose` work in **local** coordinates —
 * relative to the object's direct parent (or world, for root-parented
 * objects). The kit composes world poses via `composeWorldPose` when it
 * needs to render, hit-test, or snap. For the common axis-aligned rect pose,
 * `composeRectPose` / `decomposeRectPose` ship as the canonical compose pair.
 */
export interface SceneAdapter<TObject extends { id: string }, TPose> {
  // Pull (gesture-time queries)
  getObjects(): TObject[];
  getObject(id: string): TObject | undefined;
  getSelection(): string[];
  hitTest(worldX: number, worldY: number): string | null;
  getPose(id: string): TPose;
  getParent(id: string): string | null;

  // Mutators (called by op apply methods)
  setPose(id: string, pose: TPose): void;
  setParent(id: string, parentId: string | null): void;
  insertObject(object: TObject): void;
  removeObject(id: string): void;
  setSelection(ids: string[]): void;

  // Op submission (gesture commit point). Optional — when omitted, hooks
  // fall back to a built-in dispatcher that applies each op against the
  // adapter directly. Apps with custom history integration override this.
  applyBatch?(ops: Op[], label: string): void;
}

/**
 * Narrow adapter for `useMove`. Includes optional snap-target
 * lookup; apps without container-snapping leave it out.
 */
export interface MoveAdapter<TObject extends { id: string }, TPose> {
  getObject(id: string): TObject | undefined;
  /** Enumerate all objects. `<Canvas>` derives a default rect-pose `pickEvery`
   *  and the scene-iteration loop from this. */
  getObjects(): TObject[];
  getPose(id: string): TPose;
  /** Optional. Required only by hierarchy-aware paths: layout-pass drop
   *  targeting (`getLayout` present), nested-group hit collapse
   *  (`pickTopMostHit`), and group-pose composition. Flat scenes may omit. */
  getParent?(id: string): string | null;
  setPose(id: string, pose: TPose): void;
  /** Optional. Used only by reparent ops (e.g. drag-into-container drops via
   *  layout strategies). Flat scenes that never reparent may omit. */
  setParent?(id: string, parentId: string | null): void;
  /** Optional: see SceneAdapter.applyBatch. */
  applyBatch?(ops: Op[], label: string): void;
  findSnapTarget?(
    draggedId: string,
    worldX: number,
    worldY: number,
  ): SnapTarget<TPose> | null;
  /** Optional: direct children of `id`. When present (alongside the
   *  `cascadeWorldPose` option on `useMove`), dragging an object
   *  auto-cascades its descendants in the live overlay so structurally-
   *  grouped children visually follow the parent during the drag. No
   *  additional ops are generated — children's local poses don't change
   *  when the parent's local pose moves. */
  getChildren?(id: string): string[];
  /** Optional: layout strategy attached to a container, or null if the
   *  container uses absolute positioning (default behavior). When present,
   *  `useMove` uses the strategy to compute drop targets, sibling reflow,
   *  and the commit op batch when a drag ends over the container. */
  getLayout?(containerId: string): import('../../layout/types').LayoutStrategy<TPose> | null;
}

/**
 * Narrow adapter for `useResize`. Mirrors `MoveAdapter`'s shape
 * minus reparenting and snap-target lookup.
 * TPose is constrained to { x, y, width, height } inline to avoid a circular
 * import with interactions/types.ts.
 */
export interface ResizeAdapter<
  TObject extends { id: string },
  TPose,
> {
  getObject(id: string): TObject | undefined;
  getPose(id: string): TPose;
  setPose(id: string, pose: TPose): void;
  /** Optional: see SceneAdapter.applyBatch. */
  applyBatch?(ops: Op[], label: string): void;
}

/**
 * Narrow adapter for `useRotate`. Mirrors `ResizeAdapter`'s shape — rotate
 * mutates pose only and never reparents. TPose is left fully generic so
 * non-rect rotated poses (e.g. a `RotatedPath`) compose without changes.
 */
export interface RotateAdapter<
  TObject extends { id: string },
  TPose,
> {
  getObject(id: string): TObject | undefined;
  getPose(id: string): TPose;
  setPose(id: string, pose: TPose): void;
  /** Optional: see SceneAdapter.applyBatch. */
  applyBatch?(ops: Op[], label: string): void;
}

/**
 * Narrow adapter for `useAreaSelect`. Transient: no checkpoint, no
 * history. The hook calls `applyOps(ops)` instead of `applyBatch(ops, label)`.
 */
/**
 * Narrow adapter for `useAreaSelect`. Transient: no checkpoint, no
 * history. The hook calls `applyOps(ops)` instead of `applyBatch(ops, label)`.
 *
 * All fields are **optional** — area-select is opt-in. `useSelectTool` only
 * wires the default marquee behavior when `hitTestArea`, `getSelection`,
 * `setSelection`, and `applyOps` are all present on the adapter; otherwise
 * the gesture short-circuits (empty-space drags do nothing, sub-threshold
 * empty clicks still clear selection via the tool's `onClick` path).
 * Demos that don't need marquee selection can omit these methods entirely.
 */
export interface AreaSelectAdapter {
  /** Returns ids of objects intersecting the world-space rect. */
  hitTestArea?(rect: { x: number; y: number; width: number; height: number }): string[];
  /** Current selection — read by behaviors to compute additive merges. */
  getSelection?(): string[];
  /** Mutator wired by `setSelection` op. */
  setSelection?(ids: string[]): void;
  /** Apply ops without checkpointing or pushing a history entry. */
  applyOps?(ops: Op[]): void;
}

/**
 * Hit mode for `LassoSelectAdapter.hitTestLasso`:
 *   - 'centers'   — bounds center inside polygon.
 *   - 'intersect' — bounds intersect polygon (any overlap).
 *   - 'enclosed'  — bounds fully inside polygon.
 */
export type LassoHitMode = 'centers' | 'intersect' | 'enclosed';

/**
 * Narrow adapter for `useLassoSelect`. Extends `AreaSelectAdapter` with a
 * polygon hit-test method. Transient — uses `applyOps` like its rectangular
 * sibling. `hitTestLasso` is optional; when omitted, `useLassoTool` skips
 * wiring the default behavior (same opt-in pattern as `hitTestArea`).
 */
export interface LassoSelectAdapter extends AreaSelectAdapter {
  /** Hit-test against a closed polygon. Vertex order may be CW or CCW; the
   *  closing edge from last → first is implicit. */
  hitTestLasso?(
    polygon: ReadonlyArray<{ x: number; y: number }>,
    mode: LassoHitMode,
  ): string[];
}

/**
 * Narrow adapter for `useInsert` and `useClipboardOps`. The kit knows
 * nothing about what tool is active or what shape to construct; it asks the
 * adapter to produce object(s) given gesture or paste inputs.
 *
 * Drag-rectangle path: `commitInsert(bounds)` returns one new object or null.
 * Clipboard paste path: `commitPaste(clipboard, offset)` returns the array of
 *   newly-materialized objects (in order). Both empty array and array of
 *   length N are valid; the kit wraps each entry in an `InsertOp`.
 *
 * `snapshotSelection(ids)` builds the payload that paste later consumes.
 * `getPasteOffset` is optional; the kit defaults to a fixed grid-cell offset
 * supplied by the consumer (passed to `useClipboardOps` options if needed; see
 * the hook for resolution order).
 */
export interface InsertAdapter<TObject extends { id: string }> {
  commitInsert(bounds: { x: number; y: number; width: number; height: number }): TObject | null;
  commitPaste(
    clipboard: ClipboardSnapshot,
    offset: { dx: number; dy: number },
    ctx?: { dropPoint?: { worldX: number; worldY: number } },
  ): TObject[];
  snapshotSelection(ids: string[]): ClipboardSnapshot;
  getPasteOffset?(clipboard: ClipboardSnapshot): { dx: number; dy: number };
  /** Mutator wired by `insertObject`-using ops (kit-side InsertOp). */
  insertObject(object: TObject): void;
  /** Mutator wired by `setSelection` ops batched alongside paste. */
  setSelection(ids: string[]): void;
  /** Optional: see SceneAdapter.applyBatch. */
  applyBatch?(ops: Op[], label: string): void;
  /** Returns the current selection. Used by clone behaviors. */
  getSelection(): string[];
}

/**
 * Optional adapter mixin for sibling z-order.
 *
 * Both methods are optional. Reorder ops and `useReorder` no-op when
 * either is absent — adopt z-order incrementally without breaking existing
 * adapters.
 *
 * **Convention:** array order IS z-order. Index 0 is the bottom of the
 * stack, the last index is the top. Hit-testing should iterate the returned
 * list in REVERSE (top to bottom). Render layers iterate FORWARD (bottom to
 * top).
 *
 * For groups, `parentId` may be a group id; the group adapter routes
 * `getChildren`/`setChildOrder` to the group's `members[]` array.
 */
export interface OrderedAdapter {
  /** Ordered children of `parentId` (or root siblings if null), in z-order:
   *  index 0 is bottom, last index is top. */
  getChildren?(parentId: string | null): string[];

  /** Rewrite the order of `parentId`'s children. Length and contents must
   *  match the existing children — reorder only, no add/remove. */
  setChildOrder?(parentId: string | null, ids: string[]): void;
}
