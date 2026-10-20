/**
 * `DepSchema` and every dep value type it names. Consumer apps add their own
 * entries by declaration-merging against `'@weasel-js/core'` in their own
 * files.
 */

import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import type { PlaneMap } from 'core/viewport/parallax';
import type { DecayLoopConfig } from 'core/viewport/useDecayLoop';
import type { ViewAnimationOptions } from 'core/viewport/useViewAnimation';
import type { Scene, NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { GestureLifecycleOptions } from './gestureLifecycle';
import type { RegionPickView } from 'core/adapters/types';
import type { History } from '@weasel-js/history';
import type { BoundsConstraint } from '../gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PoseDescriptor } from './resize/geometry';
import type { GeometryProjection } from './geometryProjection';
import type { DragSample, DebugSink, LongPressState } from '@weasel-js/routing';
import type { EditAnchorsDep, FinishedEditFrame } from './editAnchorsDep';
import type { SnapDep } from './snapDep';
import type { TransformFollower, TransformPreviewNode } from './transformFinish';

export type { EditAnchorsDep, FinishedEditFrame, TransformFollower, TransformPreviewNode };
export type { SnapDep, SnapGeometry } from './snapDep';

/** Minimal view API the action layer consumes. */
export interface ViewApi {
  get(): View;
  set(v: View): void;
  /** How this camera's world maps into the world the invocation edits in,
   *  when that is a parallax plane — set by `inPlane` on the view it hands a
   *  wrapped action. Absent or null: the camera's own world. */
  plane?(): PlaneMap | null;
  /** How the world the invocation edits in maps into the world `layer`'s
   *  nodes are stored in, read now — set by `inPlane` alongside `plane`.
   *  Absent or null: the same world. */
  planeOf?(layer: string): PlaneMap | null;
  /** Optional recenter callback. When wired, `viewportZoomAction`'s `reset`
   *  branch (Cmd-0) calls this instead of resetting to identity. Return the
   *  target `View` to let the action animate there; return nothing to keep
   *  dispatching the view yourself. */
  recenter?(): View | void;
  /** Optional canvas-local host dimensions (CSS px). When wired,
   *  `viewportZoomAction`'s keyboard branches (Cmd+= / Cmd+-) anchor at the
   *  host center instead of the top-left origin. Null when the host isn't
   *  measurable (unmounted). */
  hostSize?(): { width: number; height: number } | null;
  /** Optional camera animation. `<SceneCanvas>` wires these three; a consumer
   *  publishing their own `view` dep need not, and actions fall back to `set`. */
  animate?(to: View, opts?: ViewAnimationOptions): void;
  stopAnimation?(): void;
  /** Where an in-flight camera animation is heading, or null. Compute the next
   *  discrete step from this so repeated presses compound. */
  animationTarget?(): View | null;
  /** Optional momentum decay. `<SceneCanvas>` wires this from `useDecayLoop`;
   *  a consumer publishing their own `view` dep need not, and `viewport.dragPan`
   *  simply lands the pan without coasting. */
  decay?(config: DecayLoopConfig): void;
  stopDecay?(): void;
  /** Whether a scene layer reaches the screen in this view — its own
   *  `layerVisibility` / `layerOrder`, on top of the scene's `visible` flag.
   *  Absent: this view paints every layer the scene shows. Selecting actions
   *  pass over what the asking view does not paint. */
  layerIsPainted?(layerId: string): boolean;
}

/** The part of the asking view a region hit-test consults. `get` is its
 *  camera, which a parallax layer is picked through. */
export type HitTestView = RegionPickView;

/**
 * Topmost-node-at-world-point dep, for any action that needs a single-best
 * pick. The dep walks hits front-to-back and returns the first id not in
 * `exclude`. Pass moving-node roots + their descendants when the caller
 * wants to ignore the nodes it's manipulating.
 */
export type NodeAtPointDep = (
  point: { x: number; y: number },
  exclude?: Iterable<NodeId>,
) => NodeId | null;

/** What an area-selecting action needs: a way to ask what a region covers,
 *  and a way to read and replace the selection. */
export interface AreaSelectDep {
  /** Return ids of all scene nodes whose AABB overlaps `bounds`, skipping any
   *  on a layer `view` — the view the gesture ran in — does not paint. */
  hitTestArea(
    bounds: { x: number; y: number; width: number; height: number },
    view?: HitTestView,
  ): NodeId[];
  /** Return the current selection id list. */
  getSelection(): NodeId[];
  /** Replace the current selection. */
  setSelection(ids: NodeId[]): void;
}

/**
 * Adapter dep for `lassoSelectAction`: polygon-lasso hit-testing +
 * selection read/write.
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
    view?: HitTestView,
  ): string[];
  /** Return ids of nodes whose AABB overlaps the given rect (fallback). */
  hitTestArea(
    bounds: { x: number; y: number; width: number; height: number },
    view?: HitTestView,
  ): string[];
  /** Return the current selection id list. */
  getSelection(): string[];
  /** Replace the current selection. */
  setSelection(ids: string[]): void;
}

import type { SvgIngestOptions, SvgUnpacker, ClipboardIngestCtx, IngestionDep } from './ingestionDeps';
export type { SvgIngestOptions, SvgUnpacker, ClipboardIngestCtx, IngestionDep };

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
 * may use it as the node's pose even when richer geometry is available. Any may carry a `minSize`
 * (`{ width, height }`), which the kit's factories keep as `data.minSize` so a resize holds to it.
 */
export type InsertExtras =
  | { kind: 'rect' }
  | { kind: 'ellipse' }
  | { kind: 'line'; a: { x: number; y: number }; b: { x: number; y: number } }
  | { kind: 'polygon'; sides: number; rotation: number; center?: { x: number; y: number }; radius?: number }
  | { kind: 'star'; points: number; innerRadiusRatio: number; rotation: number; center?: { x: number; y: number }; outerRadius?: number }
  | { kind: 'pencil'; samples: ReadonlyArray<DragSample> }
  | { kind: 'text'; text?: string }
  /** A sticky note: a text node with a background, in the look its tool names. */
  | ({ kind: 'sticky'; text?: string } & import('../../tools/builtin/sticky/stickyNode').StickyStyle)
  /** A finished path in world coords, as the pen tool commits one. `bounds`
   *  is its AABB. An open path takes no fill. `data` is laid under the path
   *  and paint on the node's data: the form the path was drawn from
   *  (`data.representation`), say. */
  | {
      kind: 'path';
      path: import('@weasel-js/geom').PolygonPath;
      closed: boolean;
      data?: Readonly<Record<string, unknown>>;
    }
  | {
      kind: 'image';
      src?: string;
      opacity?: number;
      /** Chrome-only: what the in-flight drag paints. Read by the overlay
       *  layer, ignored by the insert dep. */
      preview?: 'bitmap' | 'outline';
    }
  | { kind: string; [extra: string]: unknown };


import type { InsertDep, InsertEnds, PathSymmetryDep, InsertIntoDep, InsertLive } from './insertDeps';
export type { InsertDep, InsertEnds, PathSymmetryDep, InsertIntoDep, InsertLive };

/**
 * Adapter dep for `resizeAction`: bounds-frame behaviors (e.g.
 * `clampMinSize`) and group-expansion (`expandIds`). Snapping is the `snap`
 * dep's.
 *
 * The generic is erased to `unknown` at the schema entry; consumers cast at
 * the call site.
 */
export interface ResizePolicy<TPose> extends GestureLifecycleOptions {
  /** Bounds-frame constraints. Constrained to `TPose extends Bounds` since
   *  constraints read/write `{x,y,width,height}`. For non-rect TPose pass `[]`. */
  constraints: TPose extends Bounds ? BoundsConstraint<TPose>[] : never[];
  /** Group-expansion at gesture start. Identity (`ids => ids`) when group
   *  resize isn't wanted. */
  expandIds: (ids: string[]) => string[];
}

import type { LayoutDep, CanDropIntoDep } from './layoutDeps';
export type { LayoutDep, CanDropIntoDep };

import type { TextEditDep, ClipboardDep, SliceDep } from './editDeps';
export type { TextEditDep, ClipboardDep, SliceDep };

/**
 * The names an action may declare in `requires`, and what each resolves to.
 *
 * This is the whole vocabulary of things an action can reach — selection,
 * scene, view, history, and the rest. The interface is declared in
 * `@weasel-js/routing`, which knows that an action names its dependencies but
 * owns only `activeTool` among them; these entries are the kit's, merged in from
 * outside exactly the way a consumer merges its own
 * (`declare module '@weasel-js/core'`).
 */
declare module '@weasel-js/routing' {
  interface DepSchema {
    /** Kit selection state — ids of currently selected nodes. */
    selection: SelectionApi;
    /** Current viewport — camera position + scale. */
    view: ViewApi;
    /**
     * Scene tree — structural reads + undoable mutations.
     *
     * The entry uses the fully-erased form `Scene<unknown, string, unknown>`
     * because `DepSchema` must be concrete; any `Scene<MyData, MyLayer,
     * MyPose>` is assignable to it. Actions that need a typed scene back
     * should cast: `deps.scene as Scene<MyData, MyLayer, MyPose>`.
     */
    scene: Scene<unknown, string, unknown>;
    /** Undo/redo history bound to the current scene. */
    history: History;
    /** Area-select dep — AABB hit-test + selection read/write. Override
     *  per-consumer for custom hit-testing (e.g. contain-mode). */
    areaSelect: AreaSelectDep;
    /** Topmost node at a world-space point. Optional: actions that read this
     *  (e.g. `moveAction` reparent-on-drop) fall back to a no-op when the dep
     *  isn't registered. */
    nodeAtPoint?: NodeAtPointDep;
    /** Insert dep — node factory for drag-to-insert. Override per-consumer to
     *  provide a typed node factory (e.g. with custom data payloads). */
    insert: InsertDep;
    /** Where `insertAction` keeps its gesture in flight, so
     *  `insert.adjustRotation` reaches the one in its own input scope.
     *  Sourced by `<SceneCanvas>`; without it the rotation does nothing. */
    insertLive?: InsertLive;
    /** The params an action starts with in this scope when its binding
     *  passes `given`, `<SceneCanvas tune>` included: what a tool's chrome
     *  reads to draw what the action it binds will make. Sourced by
     *  `<SceneCanvas>`. */
    actionParams?: (id: string, given?: Record<string, unknown>) => Record<string, unknown>;
    /** The container the `insert` dep puts new nodes into — every shape a
     *  tool draws and every dropped image or text. Absent, or answering
     *  `null`: the top of the tree. */
    insertInto?: InsertIntoDep;
    /** Snap dep: the sessions a gesture snaps through, over `<SceneCanvas
     *  snap>`'s sources. Absent means no snapping. */
    snap?: SnapDep;
    /** The store the snap readout layer draws, for an action's own marks. Sourced by `<SceneCanvas>`. */
    snapReadout?: import('../../features/snap/readoutDep').SnapReadoutDep;
    /**
     * The canvas's debug sink.
     * Sourced by `<SceneCanvas>`; absent while its `debug` overlay is off.
     * Actions report what they did here, and the overlay draws it.
     */
    debug?: DebugSink;
    /** Where an action's `preview` draws what it would make, over the canvas.
     *  Sourced by `<SceneCanvas>`. */
    previewPaths?: import('../../canvas/deps/previewPaths').PreviewPathsDep;
    /** Viewport point of a world point on this canvas, or null before it mounts.
     *  Sourced by `<SceneCanvas>`. */
    worldToClient?: (x: number, y: number) => { x: number; y: number } | null;
    /** Lasso-select dep — polygon hit-test + selection read/write. */
    lassoSelect: LassoSelectDep;
    /** Edit-anchors dep — narrow read/write of one polygon's path. If
     *  absent, `editAnchorsAction`'s `start` returns an empty handle (no-op). */
    editAnchors: EditAnchorsDep;
    /** What changes other nodes along with a whole-node transform, in order;
     *  add one with `useTransformFollower`. Absent: only what it transforms changes. */
    transformFollowers?: readonly TransformFollower[];
    /** The transforms a path being edited should stay its own image under.
     *  Absent: an anchor drag moves only what is dragged. */
    pathSymmetry?: PathSymmetryDep;
    /**
     * Text-edit dep — activates the in-place text editing overlay. Sourced
     * from consumer via `useTextEdit` / `useSceneTextEdit`.
     *
     * The optional `isTextNode` predicate guards against entering edit mode on
     * non-text nodes. A binding can pre-filter instead with a
     * `target: 'kind:text:selected'` spec; the guard remains for consumers who
     * bind the broader `'selected-body'` target or opted out of routing.
     */
    textEdit: TextEditDep;
    /**
     * Resize-policy dep — bounds constraints, point-snap behaviors and
     * group expansion for `resizeAction`. Optional: when omitted,
     * `resizeAction` falls back to identity defaults. Consumers wire via
     * `useDepSource('resizePolicy', ...)` or the `useResizePolicy` helper.
     */
    resizePolicy?: ResizePolicy<unknown>;
    /**
     * How to read and rewrite a pose — bounds, translate, remap, rotation. Every
     * built-in action that touches a pose reads it. Sourced by `<SceneCanvas>`
     * from its `poseDescriptor` prop; `AUTO_POSE_DESCRIPTOR` when absent.
     */
    poseDescriptor?: PoseDescriptor<unknown>;
    /** Whether the box resize, rotate, flip, align, and distribute work against
     *  includes the stroke. From `<SceneCanvas geometry.boundsIncludeStroke>`;
     *  absent means `true`. */
    boundsIncludeStroke?: boolean;
    /**
     * Booleans adapter — read selection ids, fetch world-space `Path`s,
     * compare z-order, and mint result nodes for Pathfinder ops.
     *
     * Consumers wire via `useBooleansAdapter(adapter)`.
     */
    booleansAdapter?: import('./booleans/booleans').BooleansAdapter;
    /**
     * Create Outlines adapter — read selection ids, resolve text nodes, and
     * mint the path nodes that replace them. Consumers wire it with
     * `useCreateOutlinesAdapter(adapter)`; the `createOutlines` action reads it
     * in both its `enabled` predicate and its invoker.
     */
    createOutlinesAdapter?: import('./outlines/createOutlines').CreateOutlinesAdapter;
    /** Gesture dispatcher control surface, so an action can abort an
     *  in-flight handle (Escape cancels a drag, etc.). */
    dispatcher?: { cancelAll(reason: 'commit' | 'cancel'): void };
    /**
     * Layout-strategy lookup. Sourced by `<SceneCanvas>` from the scene.
     * Optional: absent (or all-null) → `moveAction` skips reflow.
     */
    layout?: LayoutDep;
    /** Which containers a move may drop into; see {@link CanDropIntoDep}. */
    canDropInto?: CanDropIntoDep;
    /**
     * Slice dep — the commit for the Slice action. `<SceneCanvas>` publishes
     * `useSliceDepSource`; a consumer overrides it with `useSliceDep`.
     *
     * Optional: when absent, `sliceAction` is a no-op.
     */
    slice?: SliceDep;
    /** Clipboard dep; see {@link ClipboardDep}. `clipboard.copy` and
     *  `clipboard.cut` both no-op when it is absent. */
    clipboard?: ClipboardDep;
    /**
     * Optional consumer commit hook. When present, `moveAction` (and other
     * default actions) submit their committed ops through it instead of
     * `scene.applyBatch`, so apps with their own history integration
     * (checkpoint + push entry) capture the gesture as one undo entry.
     * When absent, commits fall back to `scene.applyBatch`.
     */
    applyOps?: (ops: Op[], label: string) => void;
    /**
     * Ingestion dep — canvas viewport rect + consumer file→src resolver.
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
     * emits only the pose op and leaves `data` untouched. Rotate intentionally
     * never consults this seam (rotation lives on the pose, baked at render).
     */
    geometryProjection?: GeometryProjection;
    /**
     * The surface's own camera. Inside a `<CanvasView>`, `view` answers that
     * view's camera and this one does not change: an action bound in a view
     * that must move the main camera — a minimap's pan — reads this.
     */
    rootView: ViewApi;
    /**
     * The pointer store in scope: where the pointer is, in which view. Shared
     * by every surface under one `<PointerContextProvider>`.
     */
    pointer?: import('@weasel-js/routing/react').PointerContextValue;
    /**
     * The touch or pen long-press being held, if any: where, since when, how
     * far through, and whether any binding would fire on it. Sourced by
     * `<SceneCanvas>` from its gesture dispatcher; press feedback reads it.
     */
    longPress?: LongPressState;
  }
}

/**
 * Re-exported so core's own call sites and every consumer name the merged
 * interface, not the empty one routing declares.
 */
export type { DepSchema, DepName } from '@weasel-js/routing';
