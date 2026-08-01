/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive.
 *
 * Synthesizes a `MoveAdapter & ResizeAdapter & RotateAdapter & AreaSelectAdapter`
 * from the passed `scene` (via `sceneToAdapter`) and constructs an internal
 * `useSelectTool` + `useTools` so consumers don't have to. The caller-facing
 * API still accepts `pickEvery`/`boundsOf`/`handleHitRadius`/`snap`/
 * `moveOptions`/`resizeOptions`/`rotateOptions`/`selectionOptions` — those
 * props are folded into the internal tool rather than forwarded to Canvas.
 *
 * If a consumer needs custom tools (e.g. `select` + `insert`), they can pass
 * `tools={useTools(...)}` directly and SceneCanvas forwards it as-is — the
 * internal default tool is ignored in that case.
 *
 * Cascade defaults: Scene v1 stores absolute poses, so dragging a container
 * needs (a) the live overlay to translate descendants and (b) commit-time
 * setPose to translate descendants too. SceneCanvas wires both by default
 * from `scene` knowledge (children-of-id + absolute pose lookup); consumers
 * can override either by passing their own `moveOptions.cascadeWorldPose`.
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { dwarn } from '../debug';
import type React from 'react';
import type { ReactNode } from 'react';
import { type Action, type ActionsProp } from 'interactions/actions/registry';
import { useStandardActions } from 'interactions/actions/useStandardActions';
import type { DrawCommand, ShaderProgramHandle } from '../renderer';
import { subscribeImageReady } from 'features/images/imageCache';
import { subscribeGlyphReady } from '@weasel-js/font';
import { defaultDrawOne } from './defaultDrawOne';
import type { FillStyle } from 'core/paint-types';
import { Canvas } from './Canvas';
import type { CanvasProps, LayersMap, CanvasSelectionMode, SelectionOverlaySlotConfig } from './Canvas';
import type { CanvasExtensionApi, SceneCanvasApi } from './canvasExtension';
import type { Animator } from '../animation/types';
import type { SceneToAdapterOptions } from './sceneAdapter';
import type { PanBounds } from 'core/viewport/useDecayLoop';
import type { View } from 'core/viewport/view';
import type { Node, Scene, SerializedScene } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import { sceneFromJSON } from 'core/scene/scene';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { usePublishSelection } from 'features/selection/SelectionContext';
import type { Bounds } from 'tools/builtin/select';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/select';
import { useTools, type ToolsApi } from 'tools/useTools';
import { useKeybindings } from 'tools/useKeybindings';
import type { AnyTool } from 'tools/types';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import { dlog } from '../debug/flag';
import { ActionsProviderIfRoot } from './SceneCanvas/ActionsProviderIfRoot';
import { useToolActions } from './SceneCanvas/useToolActions';
import { PointerProviderIfRoot, PointerPublisher } from './SceneCanvas/PointerProviderIfRoot';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import { useHandTool } from 'tools/builtin/hand';
import { usePreviewGhostLayer } from './SceneCanvas/usePreviewGhostLayer';
import { useDispatcherOverlayLayer } from './SceneCanvas/useDispatcherOverlayLayer';
import { createGestureSource } from './SceneCanvas/dispatcherGestureBounds';
import { createPenPreviewLayer } from 'features/paths/penPreviewLayer';
import { createPathEditingOverlayLayer } from 'features/paths/pathEditingOverlayLayer';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import type { PenScratch } from 'tools/builtin/pen';
import type { Tool } from 'tools/types';
import { useBuiltinShapeTools, type BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
import type { BuiltinShapeToolId } from './SceneCanvas/shapeKinds';
export type { BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
import { DepRegistryProviderIfRoot } from './SceneCanvas/DepRegistryProviderIfRoot';
import {
  useViewDepSource,
  useAreaSelectDepSource,
  useNodeAtPointDepSource,
  useInsertDepSource,
  useSnapDepSource,
  useLassoSelectDepSource,
  useTextEditDepSource,
  useEditAnchorsDepSource,
  useDispatcherDepSource,
  useResizePolicy,
  useLayoutDepSource,
  useGeometryProjection,
  useIngestionDepSource,
  type InsertNodeFactory,
} from './deps';
import {
  acquireKitContentHandlers,
  registerContentHandler,
  itemsFromFiles,
  type ContentHandlerEntry,
  type IngestItem,
} from 'features/ingestion';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';
import type { ClipboardIngestCtx, SvgIngestOptions } from 'interactions/actions/depSchema';
import type { InsertAdapter } from 'core/adapters/types';
import { resolveEditablePathOf } from './deps/editAnchors';
import type { PolygonPath } from 'features/paths/types';
import { useActionsPropResolver } from './SceneCanvas/useActionsPropResolver';
import { useViewportActions } from './SceneCanvas/useViewportActions';
import type { ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';
import { ActiveToolContextProviderIfRoot } from 'interactions/actions/activeToolContext';
import { useGestureDispatcher } from 'interactions/dispatcher/useGestureDispatcher';
import { createDispatcher, type Dispatcher } from 'interactions/dispatcher/dispatcher';
import { useActionsRegistry, type ActionsRegistry } from 'interactions/actions/registry';
import { buildAffordanceAt, buildClassifyTarget } from './affordanceAt';
import { clientToWorld as clientToWorldHelper } from 'core/viewport/clientToWorld';
import type { AnchorState } from './affordanceAt';
import type { Op } from 'core/ops/types';
import { useDepRegistry } from 'interactions/actions/depRegistry';
import { createNodeRouting, type NodeRoutingEntry } from '../core/scene/NodeRouting';
import { inferredNodeRouting } from './SceneCanvas/defaultNodeRouting';
import { installTestHookIfRequested } from '../test-hook/install';
import type { WeaselTestHook } from '../test-hook/types';
import {
  createSelectionOverlayLayer,
} from 'features/selection/overlay';
import { firstPreviewPose, firstPreviewBounds } from './toolPreview';
import { makeGetNodeAtPoint } from './getNodeAtPoint';
import {
  buildChromeCtx,
  never,
  resolveVisibility,
  useHoverTracking,
  DEFAULT_ALLOWED_CAPABILITIES,
} from 'features/chrome-caps';
import type { RuleCtx } from 'features/chrome-caps';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
export { rotateAroundAABBCenter } from './poseRotation';

/**
 * Minimal adapter surface the legacy bridge factories need for delete /
 * duplicate / group / ungroup. Extracted from `SceneCanvasAdapter` to avoid
 * threading the full generic type through `StandardActionsRegistrar` (which is
 * non-generic). The actual adapter supplied is always a `SceneCanvasAdapter`
 * so the cast is safe.
 */
interface BridgeAdapter {
  applyOps(ops: Op[], label?: string): void;
  insertNode(node: { id: string; [k: string]: unknown }): void;
  removeNode(id: string): void;
  setSelection(ids: string[]): void;
}

/** Default size in CSS pixels for selection corner-handles AND their
 *  hit-test radius. Used by the SceneCanvas defaults; consumers override
 *  via `selectTool.handleHitRadius` or `layers.selectionOverlay.handles.size`. */
export const DEFAULT_HANDLE_SIZE = 8;

// ---------------------------------------------------------------------------
// Dev-only coord trace
// ---------------------------------------------------------------------------

/** Records every `clientToWorld` call so dev tools (and agents) can
 *  reconcile cursor coords with computed world coords. Mirrors the
 *  dispatcher's trace log. Exposed on `window.__weaselCoordLog__`. */
export interface CoordTraceEntry {
  ts: number;
  clientX: number;
  clientY: number;
  rect: { left: number; top: number; width: number; height: number } | null;
  view: { x: number; y: number; scaleX: number; scaleY: number } | null;
  world: { x: number; y: number };
  /** True when canvas/view weren't available and we returned identity. */
  fallback: boolean;
}

/**
 * `import.meta.env.DEV`, read through a cast rather than off a typed
 * `ImportMeta`. Core must not depend on a bundler's ambient augmentation
 * (`vite/client`) to compile — until core moved into `packages/core/`, two
 * call sites below read `import.meta.env` bare and only type-checked because
 * `apps/site/vite-env.d.ts` leaked its `/// <reference types="vite/client" />`
 * into the shared root-tsconfig program. Isolating core's build surfaced it.
 * Mirrors the same cast in dispatcher.ts and buildDeps.ts.
 */
const IS_DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();

const COORD_TRACE_LIMIT = 200;
const coordTrace: CoordTraceEntry[] = [];
const COORD_DEV: boolean = IS_DEV;
if (COORD_DEV && typeof window !== 'undefined') {
  (window as unknown as { __weaselCoordLog__: CoordTraceEntry[] }).__weaselCoordLog__ = coordTrace;
}
function recordCoordTrace(entry: CoordTraceEntry): void {
  if (!COORD_DEV) return;
  coordTrace.push(entry);
  if (coordTrace.length > COORD_TRACE_LIMIT) coordTrace.shift();
}

export { defaultDrawOne } from './defaultDrawOne';

/** Deep-merge user-supplied `layers` with kit defaults. Slots the user
 *  doesn't mention get filled with defaults; slots explicitly set to
 *  `null` are dropped (the existing "disable this slot" convention).
 *  Partial slot configs (e.g. `{ scene: { drawOne: customFn } }`) are
 *  shallow-spread on top of the default slot config. */
export function mergeLayersWithDefaults<TData, TLayer extends string, TPose>(
  user: LayersMap<Node<TData, TLayer, TPose>, TPose> | undefined,
): LayersMap<Node<TData, TLayer, TPose>, TPose> {
  const defaults = {
    scene: { drawOne: defaultDrawOne as (
      node: Node<TData, TLayer, TPose>,
      pose: TPose,
    ) => DrawCommand[] },
    selectionOverlay: { handles: { size: DEFAULT_HANDLE_SIZE } },
  };

  if (!user) return defaults as LayersMap<Node<TData, TLayer, TPose>, TPose>;

  // Start from a shallow copy of the user map so unknown slots pass through.
  const result: LayersMap<Node<TData, TLayer, TPose>, TPose> = { ...user };

  if (!('scene' in user)) {
    result.scene = defaults.scene;
  } else if (user.scene === null) {
    result.scene = null;
  } else {
    result.scene = { ...defaults.scene, ...user.scene };
  }

  if (!('selectionOverlay' in user)) {
    result.selectionOverlay = defaults.selectionOverlay;
  } else if (user.selectionOverlay === null) {
    result.selectionOverlay = null;
  } else {
    result.selectionOverlay = { ...defaults.selectionOverlay, ...user.selectionOverlay };
  }

  return result;
}

/** Built-in tool ids SceneCanvas knows how to mount when no `tools` prop
 *  is supplied. Pass a subset via `defaultTools` to slim the registered set. */
export type BuiltinToolId =
  | 'select' | 'rotate' | 'hand'
  | BuiltinShapeToolId;

/** Named preset tool collections for the `toolBundle` prop. Maps to a
 *  `BuiltinToolId[]` consumed by SceneCanvas's internal `useTools`. */
export type ToolBundle = 'minimal' | 'standard' | 'exhaustive';

/** Tool-id contents of each named `ToolBundle`. Public so consumers (e.g.
 *  the Bundle Inspector) can introspect the same map SceneCanvas uses to
 *  expand `toolBundle` without mirroring it. The `src/index.barrel.test.ts`
 *  parity gate enforces that every `ToolBundle` id appears here with a
 *  non-empty tool list. */
export const BUNDLE_TOOLS: Record<ToolBundle, readonly BuiltinToolId[]> = {
  minimal: ['select', 'hand'],
  // No `pencil`: freehand is a specialist instrument, not part of the
  // everyday shape-drawing set. It stays in `exhaustive`, which means
  // everything.
  standard: ['select', 'rotate', 'hand', 'rect', 'ellipse', 'line'],
  exhaustive: [
    'select', 'rotate', 'hand',
    'rect', 'ellipse', 'line', 'polygon', 'star', 'pen', 'pencil',
    'lasso', 'text',
  ],
};

/** Minimal hit descriptor passed to `onDoubleClick`. Contains the fields
 *  modality dispatch needs; extends as the kit's `Hit` type evolves. */
export interface SceneCanvasHit {
  id: string;
  kind: string;
}

export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<
    CanvasProps<Node<TData, TLayer, TPose>, TPose>,
    | 'adapter'
    | 'moveOptions' | 'resizeOptions' | 'rotateOptions'
    | 'snap' | 'pickEvery' | 'boundsOf' | 'handleHitRadius'
    | 'selection' | 'selectionOptions' | 'tools' | 'geometry'
    | 'layers'          // stripped so we can re-add as optional below
    | 'onBackgroundClick' // SceneCanvas synthesizes this; not a consumer prop
    | 'getIsVisible'    // SceneCanvas synthesizes this from chromeVisibility
  >
  & {
    /** A `Scene` (typically from `useScene`) — or a `SerializedScene`
     *  JSON object, which SceneCanvas bakes into a Scene internally on
     *  first render. The serialized form is read once; subsequent
     *  changes to the prop are ignored. Pass a `key` prop on
     *  `<SceneCanvas>` to force a fresh canvas from updated JSON.
     *
     *  The accepted JSON shape is intentionally relaxed (`version:
     *  number` rather than `1` literal) so a `import json from './x.json'`
     *  result satisfies the type without an `as` cast — Vite infers
     *  number-literal types as `number` from JSON, which the strict
     *  `SerializedScene<…>` would reject. */
    scene:
      | Scene<TData, TLayer, TPose>
      | SerializedScene<TData, TLayer, TPose>
      | { version: number; systemLayers?: ReadonlyArray<{ id: string }>; nodes: ReadonlyArray<unknown> };

    /** Layer configuration. When omitted, SceneCanvas applies kit defaults
     *  (a scene slot that paints `node.data.color` rects + a default
     *  selection overlay). Partial slot configs deep-merge with the
     *  defaults; pass `slot: null` to suppress a default explicitly. */
    layers?: LayersMap<Node<TData, TLayer, TPose>, TPose>;

    /** Layout strategies keyed by container node id (or a resolver). Forwarded
     *  to `sceneToAdapter` so `useMove`'s layout pass runs on configured
     *  containers (reflow on enter, reparent + reflow on commit). */
    layouts?: SceneToAdapterOptions<TData, TLayer, TPose>['layouts'];

    /**
     * Optional consumer seam for eager geometry sync: lets pose-transform
     * actions (move, resize, nudge, flip — NOT rotate) also rewrite a node's
     * data-held geometry. Given a node and the affine `m` applied to its pose,
     * `transform(node, m)` returns updated `data` (geometry mapped by `m`) or
     * `null` for nodes with no data-held geometry.
     *
     * Strictly opt-in: when absent, the kit emits only the pose op and leaves
     * `data` untouched. Consumers wire this via `geometryProjection={myProjection}`.
     *
     * @see GeometryProjection
     */
    geometryProjection?: GeometryProjection;

    /**
     * Routing-trait classifiers — list of `NodeRoutingEntry` entries. The kit
     * constructs a `NodeRouting` registry per-`<SceneCanvas>` from this prop,
     * then uses the resulting classifier to derive each hit's `kind` when
     * building `getNodeAtPoint`. Tool routing tables (e.g.
     * `{ target: 'rect', actionId: 'move' }`) match against the produced
     * kind strings.
     *
     * Pass `defaultNodeRouting` to pick up the kit's built-in shape kinds
     * (rect, ellipse, polygon, …) for `data: { kind: '<shape>' }` nodes.
     * Spread additional entries for consumer-defined kinds.
     *
     * See `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`.
     *
     * **Memoize the `routing` value.** The kit memoizes the registry on the
     * prop's reference identity. Passing a fresh array each render
     * (e.g. `routing={[...defaultNodeRouting, custom]}` inline) rebuilds the
     * registry and cascades into a new adapter, churning gesture state.
     * Define the list as a module-level constant, or wrap it in `useMemo`.
     * (`defaultNodeRouting` alone is a stable module-level constant; spreading
     * it with extras is what needs the memo.)
     */
    routing?: readonly NodeRoutingEntry[];

    // --- Geometry: hit-test + bounds overrides consumed by the internal
    //     `useSelectTool`. Ignored if the consumer passes their own `tools`. ---
    geometry?: {
      /** Hit-test override. Return the topmost id, the full back-to-front hit
       *  stack (`string[]`), or `null` for empty space. The stack form lets a
       *  consumer with domain overlap ordering (e.g. children over their
       *  container) feed the kit's `pickTopMostHit` the true order instead of
       *  pre-collapsing to one id. Matches `Canvas`'s `pickEvery` shape. */
      pickEvery?: (worldX: number, worldY: number) => string | string[] | null;
      boundsOf?: (id: string) => Bounds | null;
      /**
       * What "the pointer is on this node" means for the default body-pick.
       *
       * - `'pose'` — the node's pose rect, rotation honored. What every
       *   consumer got before `'shape'` existed, and now the opt-out.
       * - `'shape'` (default) — the pose rect as a pre-filter, then the ink the painter
       *   actually lays down: its silhouette (`findShapeSilhouette`) filled
       *   or not per the painter's `ink`, plus its outline widened by the
       *   stroke half-width and `pickTolerancePx`. A click in the concave
       *   notch of a star, in the corner outside an ellipse, or in the blank
       *   half of a text box falls through to whatever is beneath; a click on
       *   the thin outline of an unfilled shape hits it.
       *
       * Painters with no silhouette are unaffected — they keep the pose-rect
       * answer either way, so this can never make a node unreachable.
       *
       * Ignored when `pickEvery` is supplied: that override owns the test.
       */
      picking?: 'pose' | 'shape';
      /**
       * Grab slop around a shape's outline, in **screen** pixels. Default 4.
       *
       * Screen pixels rather than world units so the target keeps its
       * apparent size at any zoom. It widens the outline test under
       * `picking: 'shape'` (a 1px hairline is otherwise a half-world-unit
       * target, which is unhittable), and it grows the pose-rect pre-filter
       * so those outline hits survive it. Set `0` for exact geometry.
       */
      pickTolerancePx?: number;
    };

    // --- Select tool options. Ignored if the consumer passes their own
    //     `tools` prop. ---
    selectTool?: {
      move?: UseMoveOptions<TPose>;
      resize?: UseResizeOptions<TPose>;
      /** Rotation options, or `false` to disable rotation entirely — drops the
       *  `rotate` action AND hides the selection rotation-handle chrome, so a
       *  consumer whose objects don't rotate (e.g. a floor-plan / garden
       *  editor) opts out with a single switch instead of pairing
       *  `actions={{ rotate: null }}` with a `chromeVisibility` override. */
      rotate?: UseRotateOptions<TPose> | false;
      snap?: SnapStrategy<TPose>;
      handleHitRadius?: number;
      /** Override the body-pick used on click/pointerdown. Alt-aware: receives
       *  the live alt state + current selection so consumers can implement
       *  alt-cycling through an overlapping stack. Default: top-most hit
       *  (alt ignored). */
      pickBest?: (worldX: number, worldY: number, alt: boolean, sel: readonly string[]) => string | null;
    };

    // --- Insert tool: when `create` is supplied, the synthesized adapter
    //     exposes `commitInsert` and inserted objects are added as leaves on
    //     `layer` (default `'default'`). ---
    insertTool?: {
      create: SceneToAdapterOptions<TData, TLayer, TPose>['commitInsert'];
      layer?: TLayer;
    };

    /** Consumer node factories for the `insert` action, keyed by tool `kind`.
     *  Each factory receives the drag AABB + tool `extras` and returns the
     *  node's `data` (in this canvas's own data shape) plus an optional `pose`.
     *  A factory for a kit kind (`rect`, `line`, …) replaces the kit's default
     *  `{ path, fill }` node for that kind; a factory for a novel kind (e.g.
     *  `text`) adds insert support the kit doesn't ship. The dep supplies id,
     *  layer, and the undoable op. Return `null` to reject an insert. */
    insertNodeFactories?: Record<string, InsertNodeFactory>;

    /** External-content ingestion (OS drop / clipboard paste / picker).
     *  `handlers` are consumer content handlers registered for this canvas's
     *  lifetime (priority 0 by default — they beat the kit's `image/*` /
     *  `image/svg+xml` handlers at -100/-90). `resolveSrc` overrides the
     *  image handler's `data:`-URI embed (e.g. upload to an asset store,
     *  return the URL). `svg.unpack` makes the kit SVG handler parse dropped
     *  SVG files into native scene nodes instead of keeping each one a
     *  single embedded-image node.
     *  `clipboard` configures the kit weasel-JSON paste handler: enabled by
     *  default (pastes of weasel clipboard payloads re-materialize through
     *  this canvas's adapter); `reviver` restores JSON-unfriendly values the
     *  copying side encoded via `jsonReplacer` (typed arrays etc.);
     *  `enabled: false` opts the canvas out — but note the kit handler
     *  still consumes weasel-matching items at match time; on a disabled
     *  canvas it declines inert (a dwarn, nothing ingested) rather than
     *  falling through. Only items that never match (non-weasel text)
     *  flow on to other handlers.
     *  Memoize `handlers` (useState/useMemo/module const) — an inline array
     *  literal re-registers the handlers on every render. The same applies
     *  to `clipboard.reviver`: an inline function identity-churns the
     *  memoized clipboard ctx each render (harmless but wasteful). */
    ingestion?: {
      handlers?: ContentHandlerEntry[];
      resolveSrc?: (file: File) => Promise<string>;
      svg?: SvgIngestOptions;
      clipboard?: {
        reviver?: (key: string, value: unknown) => unknown;
        enabled?: boolean;
      };
    };

    // --- Selection ---
    selection?: SelectionApi;
    selectionOptions?: UseSelectionOptions;

    /**
     * High-level selection semantics. Controls whether canvas interactions
     * mutate selection and whether multi-select chrome (union AABB) activates.
     *   - `'single'` (default) — click selects one id.
     *   - `'multi'` — shift-click extends/toggles.
     *   - `'none'` — canvas interactions never update selection.
     * See {@link CanvasSelectionMode}.
     */
    selectionMode?: CanvasSelectionMode;

    // --- Tools: extend, override, or take over ---
    /** Extra tools or overrides keyed by id, or a full `ToolsApi` takeover.
     *
     *  **Patch form** (`Record<string, AnyTool | true | false>`): merged
     *  into the built-in registry on top of whatever `defaultTools` /
     *  `toolBundle` already selected.
     *    - `true` pulls in the built-in for this id (`'pen'`, `'lasso'`,
     *      `'rotate'`, …) even when it's outside the active tier — useful
     *      for `toolBundle: 'minimal'` + `tools={{ pen: true }}`. Unknown
     *      built-in ids warn in dev and are ignored.
     *    - `AnyTool` adds a new id or replaces an existing one
     *      (dev-only warning on replace).
     *    - `false` omits a bundled tool entirely.
     *  Auto-wiring (keybindings, dispatcher, action registry) still runs.
     *
     *  **Takeover form** (`ToolsApi`): the internal default `useSelectTool`
     *  is bypassed and this `tools` value is forwarded to Canvas as-is —
     *  the consumer owns active-slot management. Keybindings are still
     *  auto-wired against the supplied registry; pass `enableKeybindings={false}`
     *  to opt out. */
    tools?: ToolsApi | Record<string, AnyTool | true | false>;

    /**
     * Auto-wire keyboard shortcuts. Default `true`. When `false`, SceneCanvas
     * still mounts its tools but routes no keyboard input to them: it neither
     * subscribes the legacy `useKeybindings` hook (tool hotkeys) nor lets the
     * gesture dispatcher attach its `keydown`/`keyup` listeners (modern
     * keyboard-bound actions like delete / escape / nudge). Pointer, wheel, and
     * contextmenu interactions are unaffected. Leaves the consumer free to call
     * `useKeybindings(tools, { ... })` themselves (e.g. with `disable`,
     * `overrides`, or `defaultTool`).
     */
    enableKeybindings?: boolean;

    /**
     * Auto-mount the gesture dispatcher (`useGestureDispatcher`) inside
     * `<SceneCanvas>`. Default `true`. When `false`, the dispatcher is not
     * wired — useful in tests or demos that drive actions through alternative
     * mechanisms, or that want to call `useGestureDispatcher` themselves.
     *
     * The dispatcher reads registered actions' `defaultBinding` fields and
     * routes matching window keydown / canvas pointer / wheel events to the
     * corresponding `invoker.run` (or `invoker.start` for ongoing gestures).
     */
    enableGestureDispatcher?: boolean;

    /**
     * Called once after SceneCanvas constructs (or receives) its
     * `ToolsApi`. Useful for introspection — e.g. the toolkit-builder
     * dev surface walks `tools.registry` to render the live route table.
     * Fires with the consumer-supplied `tools` prop when present, or with
     * the internally-synthesized one otherwise.
     */
    onToolsCreated?: (tools: ToolsApi) => void;

    /**
     * Named preset for the built-in tool set: `'minimal'` (select + hand),
     * `'standard'` (select + rotate + hand + rect + ellipse +
     * line + pencil), or `'exhaustive'` (every built-in including polygon,
     * star, lasso, text, clone). When set, defines the starting set;
     * `defaultTools` (if also passed) overrides it. Ignored when the
     * consumer supplies their own `tools` prop.
     */
    toolBundle?: ToolBundle;

    /**
     * Which built-in tools SceneCanvas registers in its internal `useTools`.
     * Default: `['select', 'rotate']` (plus `'hand'` when the
     * `viewport` feature is on). Pass a smaller array to slim — e.g.
     * `['select']` for move-only. Wins over `toolBundle` when both are
     * passed. Ignored when the consumer supplies their own `tools` prop.
     */
    defaultTools?: readonly BuiltinToolId[];

    /** Per-tool option overrides for the built-in shape/lasso/clone tools.
     *  Each entry is a narrow subset of the underlying hook's options
     *  surface — `lasso.mode`, `clone.cloneSelection`, etc. */
    toolOptions?: BuiltinToolOptions;

    /** Initial active-slot tool id. Default: `'select'`. Must be one of the
     *  registered tools (via `defaultTools` / `toolBundle`). Useful for
     *  demos / consumers that want to land on a non-select tool — e.g. the
     *  lasso demo starts with `initialActiveTool="lasso"`. Ignored when the
     *  consumer supplies their own `tools` prop. */
    initialActiveTool?: string;

    /** Always-on tools to register alongside the internal default select.
     *  Use this for wheel/keyboard zoom + pan tools that should run alongside
     *  the default select. If you supply your own `tools` prop, this is
     *  ignored — wire `ambient` through your own `useTools` call instead. */
    ambient?: AnyTool[];

    /** Viewport feature wiring.
     *
     *  - `inertia`, `pinchZoom`, `animatedZoom` are opt-in: pass `true`
     *    for defaults or an object to tune. Omitted means off.
     *  - `pan` (wheel pan) and `zoom` (Cmd+wheel + Cmd+=/-/0) are opt-OUT:
     *    on by default; pass `false` to disable. They are wired by registering
     *    the kit's `viewport.pan` / `viewport.zoom` action descriptors with
     *    the actions registry — disabling via the `actions` prop
     *    (`actions: { 'viewport.wheelPan': null }`) also works and runs after this.
     *
     *  When omitted entirely, no hand/pinch tools are registered but the
     *  default wheel pan + Cmd+wheel/key zoom remain wired (canvas-first
     *  default). Pass `{ pan: false, zoom: false }` to opt out entirely. */
    viewport?: {
      inertia?: boolean | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce' | 'spring'; bounds?: PanBounds };
      pinchZoom?: boolean | { min?: number; max?: number };
      animatedZoom?: boolean | { duration?: number; resetDuration?: number; easing?: (t: number) => number };
      pan?: boolean;
      /** Wheel/keyboard zoom. `true`/omitted = default Cmd+wheel zoom with the
       *  kit's 0.1–8 clamp; `false` disables. Pass a {@link ViewportZoomOptions}
       *  object to bind zoom to plain wheel (`wheel: 'plain'`, pair with
       *  `pan: false`) and/or set `min`/`max` scale clamps. */
      zoom?: boolean | ViewportZoomOptions;
      /** Callback invoked by Cmd-0 (`viewport.zoom` action's `reset` branch).
       *  When supplied, replaces the default reset-to-identity behavior —
       *  consumers typically refit the document page into the workspace
       *  via `fitViewToBounds`. The callback owns its own bounds + host
       *  dims and dispatches the resulting view via `onViewChange`. */
      recenter?: () => void;
    };

    /**
     * @experimental
     * Override / disable / extend the default action set. Resolution rules:
     * see `docs/superpowers/specs/2026-05-09-actions-registry-design.md` §D.
     * Pass `null` to disable all defaults.
     */
    actions?: ActionsProp;

    /**
     * @experimental
     * Inputs the kit can't synthesize on its own — currently `cloneNode`
     * for the `duplicate` default. When omitted, the `duplicate` default is
     * silently dropped from the registered set.
     */
    /** @deprecated unused after legacy-bridge removal; will be deleted */
    actionDefaults?: {
      cloneNode?: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
      /** Per-clone offset for the duplicate default. Default {dx:8,dy:8}. */
      duplicateOffset?: { dx: number; dy: number };
      /** Base nudge step. Default 1. */
      nudgeStep?: number;
      /** Shifted nudge step. Default 10. */
      nudgeShiftStep?: number;
    };

    /**
     * @experimental
     * Optional resolver: given a scene node, return a short human-readable
     * "kind" label (e.g. `'rectangle'`, `'path'`, `'sticky note'`). When
     * supplied, the kit publishes per-id kinds into any surrounding
     * `<SelectionContextProvider>` so non-canvas UI (palette, status bar)
     * can render type-aware copy. Return `undefined` to skip an entry.
     *
     * Default behavior when omitted: containers report `'group'`, paths
     * (poses with a `kind` property) report `'path'`, everything else is
     * left unlabelled.
     */
    describeKind?: (node: Node<TData, TLayer, TPose>) => string | undefined;

    /**
     * Optional animator to bind for per-frame redraws. When supplied,
     * SceneCanvas subscribes to `animator.onTick` and requests a redraw on
     * every active animation frame. This is the supported way to drive
     * repaints when an animation's effect is read from a non-scene channel
     * (e.g. a custom `drawOne` consults `animator.colorOverrides`) — scene
     * mutations trigger repaints automatically, but `colorOverrides` writes
     * do not.
     *
     * Omit when no animation channel touches the render pipeline; idle
     * frames don't cost anything if no animations are active (the animator's
     * subscriber list stays quiet).
     */
    animator?: Animator;

    /**
     * Children rendered alongside the canvas. Useful for siblings that need
     * the same `<ActionsProvider>` scope (e.g. shortcuts overlays, probes).
     */
    children?: ReactNode;

    /**
     * Chrome-caps visibility overrides, keyed by chrome id (`selection.outline`,
     * `selection.rotation-handle`, `gesture.marquee`, …). Each entry is a
     * composable {@link Condition} built from the
     * `cond()` builder. Merged on top of the kit's `defaultVisibilityRules`;
     * unspecified ids fall through to the defaults.
     *
     * Set an id to `never` to suppress a chrome element entirely (also
     * unhittable). Set to `always` to force-show. Mix `cond(...)` chains
     * (e.g. `selectionIs(1).and(focused).andNot(gesturing)`) for the in-
     * between cases.
     */
    chromeVisibility?: import('features/chrome-caps').VisibilityRules;

    /**
     * Returns the active mode id + the capability tags the mode allows.
     * Defaults to `{ id: 'normal', allowedCapabilities: new Set() }` when
     * omitted. Apps using the modality machine should derive this from
     * `modality.machine.registry.current()` (mode.id + mode.allows union
     * with implicit capability tags).
     *
     * Threading this through enables mode-aware chrome (selection outline,
     * resize handles, rotation handle are off in path-edit mode) and the
     * dispatcher's eligibility filter in later phases.
     */
    getActiveMode?: () => { id: string; allowedCapabilities: ReadonlySet<string> };

    /**
     * Optional live focus getter for chrome-caps' `focused` ctx field.
     * SceneCanvas does not own focus state by default — wire this when
     * your visibility rules read the `focused` atom (e.g. the kit's
     * default `selection.rotation-handle` rule requires focus). Omit
     * to default `focused` to `true` (rule fires regardless of focus).
     */
    getFocused?: () => boolean;

    /**
     * Custom shader programs to compile on the renderer. Forwarded directly
     * to `<Canvas shaders={...} />`. See `CanvasProps.shaders` for details.
     */
    shaders?: ShaderProgramHandle[];

    /**
     * FillStyle applied to the full canvas behind the scene. Accepts the kit's
     * `FillStyle` union (solid / pattern / linear-gradient / radial-gradient /
     * conic-gradient) so consumers don't have to author a background node
     * just to colorize the canvas. Rendered as a screen-space layer slotted
     * before `'scene'` — independent of pan / zoom.
     */
    backgroundFill?: FillStyle;
    /**
     * Dev HUD: when true, mounts a fixed-position widget in the top-left
     * of the viewport showing live cursor coords in both viewport
     * (client) and canvas (world) frames. Useful for diagnosing pointer-
     * coord drift / pan-zoom misalignment without instrumenting events.
     */
    cursorCoordsHud?: boolean;
    /**
     * Dev HUD: when true, mounts a fixed-position widget just below the
     * cursor-coords HUD listing the ids returned by `pickEvery(world)`
     * under the cursor. Useful for diagnosing hit-test order and
     * container/leaf overlap during select-tool work.
     */
    pickHud?: boolean;
    /**
     * Dev overlay flags. `slops: true` renders translucent halos at every
     * affordance hit zone.
     */
    debug?: {
      slops?: boolean;
    };
    /**
     * Dev HUD: when true (or object), mounts a fixed-position widget below
     * the pick HUD showing the active modality mode, active-slot tool, and
     * hotkey stack. Pass `{ modeId }` to populate the mode line.
     */
    modalityHud?: boolean | { modeId?: string };

    /**
     * Optional per-id alpha multiplier for the scene-render slot. When
     * supplied, each node's draw output is wrapped in a `GroupDrawCommand`
     * with the returned alpha so the renderer applies the multiplier.
     * Values equal to 1 are a no-op (no wrapper emitted). Typical use:
     * scoping-dim integration dims non-active nodes during a mode transition.
     *
     * Defaults to `() => 1` (no effect).
     */
    alphaFor?: (id: string) => number;

    /**
     * Optional per-id pointer-interactivity predicate. When supplied, ids
     * for which the predicate returns `false` are excluded from hit-test
     * results — `getNodeAtPoint` returns null for those positions.
     * Typical use: scoping-dim integration suppresses pointer events for
     * non-active nodes during a mode transition.
     *
     * Defaults to `() => true` (all nodes are interactive).
     */
    isPointerInteractive?: (id: string) => boolean;

    /**
     * Called when the user double-clicks the canvas. Receives the hit node
     * (id + kind) at the double-click position, or `null` when the click
     * lands on empty canvas. Wired internally via a `dblclick` listener on
     * the canvas element so it doesn't interfere with the pointer-gesture
     * pipeline.
     *
     * Typical use: modality dispatch — enter path-edit on a path node,
     * isolation on a group, text-edit on a text node.
     */
    onDoubleClick?: (hit: SceneCanvasHit | null) => void;
  };

/** Discriminate the polymorphic `tools` prop: `ToolsApi` has `setActive`
 *  / `active` / `registry`; the patch record shape has none of those. */
/** Stable empty `Set` so `getSuppressedSelectionIds` doesn't allocate
 *  a fresh empty Set on every read — selection-overlay's `draw` runs
 *  every frame. */
const EMPTY_ID_SET: ReadonlySet<string> = new Set();
const EMPTY_ANCHOR_SELECTION: ReadonlySet<number> = new Set();

function isToolsApi(
  tools: ToolsApi | Record<string, AnyTool | true | false>,
): tools is ToolsApi {
  return typeof (tools as ToolsApi).setActive === 'function';
}

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  const {
    scene: sceneInput,
    geometry,
    selectTool: selectToolOpts,
    insertTool,
    insertNodeFactories,
    ingestion,
    layouts,
    geometryProjection,
    routing,
    selection: selectionProp,
    selectionOptions,
    selectionMode = 'single',
    tools: toolsProp,
    enableKeybindings = true,
    enableGestureDispatcher = true,
    onToolsCreated,
    toolBundle,
    defaultTools,
    toolOptions,
    initialActiveTool,
    ambient,
    viewport,
    layers,
    actions,
    actionDefaults,
    describeKind,
    animator,
    children,
    shaders,
    backgroundFill,
    cursorCoordsHud,
    pickHud,
    debug,
    modalityHud,
    alphaFor,
    isPointerInteractive,
    onDoubleClick,
    chromeVisibility,
    getActiveMode,
    getFocused: getFocusedProp,
    ...rest
  } = props;

  // `scene` accepts either a live `Scene` or a `SerializedScene` JSON
  // object. JSON is baked once via useState init; subsequent renders
  // ignore prop changes (use a `key` prop on `<SceneCanvas>` to force a
  // fresh canvas). Subscription is uniform — useSyncExternalStore on the
  // resolved Scene's version stream.
  const isSerialized = (s: unknown): boolean =>
    typeof s === 'object' && s != null && (s as { version?: unknown }).version === 1
      && Array.isArray((s as { nodes?: unknown }).nodes);
  const [bakedScene] = useState<Scene<TData, TLayer, TPose> | null>(
    () => isSerialized(sceneInput)
      ? sceneFromJSON(sceneInput as SerializedScene<TData, TLayer, TPose>, {})
      : null,
  );
  const scene = bakedScene ?? (sceneInput as Scene<TData, TLayer, TPose>);
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  // Extract view-related props from rest so we can intercept them for the
  // pinch-zoom hook (which needs the current view) without breaking the
  // controlled/uncontrolled pattern Canvas exposes.
  const { view: viewProp, onViewChange: onViewChangeProp, defaultView, ...restProps } = rest;

  // Internal canvas ref so usePinchZoomTool can attach pointer listeners
  // even when the consumer passes their own forwarded ref.
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Holds the full `CanvasExtensionApi` so we can call `requestRedraw` after
  // dispatcher-side gesture pumps. Without this, dispatcher-only actions
  // (marquee, lasso, anything driven solely by `useGestureDispatcher`) never
  // trigger a re-paint between pointerdown and pointerup — the legacy tools
  // dispatcher's `onGestureChange` only fires for legacy `tool.drag.*` hooks,
  // which the migrated actions don't provide.
  const canvasApiRef = useRef<CanvasExtensionApi | null>(null);

  useEffect(() => {
    dlog('scene-canvas', 'mount');
    return () => dlog('scene-canvas', 'unmount');
  }, []);

  // Content-handler registration: the kit's defaults are refcounted (they
  // stay registered while ANY SceneCanvas is mounted — see
  // `acquireKitContentHandlers`); consumer handlers from the `ingestion`
  // prop live for this canvas's lifetime.
  const consumerHandlers = ingestion?.handlers;
  useEffect(() => {
    const disposers = [acquireKitContentHandlers()];
    for (const h of consumerHandlers ?? []) disposers.push(registerContentHandler(h));
    return () => disposers.forEach((d) => d());
  }, [consumerHandlers]);

  // Animator subscription: when an animator is provided, request a redraw
  // on every active frame so consumer `drawOne` functions reading
  // `animator.colorOverrides` (or any other non-scene channel the
  // animator may mutate) reflect the latest values. The animator only
  // ticks while animations are active, so idle frames don't repaint.
  useEffect(() => {
    if (!animator) return;
    const unsubscribe = animator.onTick(() => {
      canvasApiRef.current?.requestRedraw?.();
    });
    return unsubscribe;
  }, [animator]);

  // Image-ready subscription: the `kit:image` painter reads decoded bitmaps
  // synchronously from `imageCache`, but loads resolve asynchronously. When
  // any image finishes decoding, request a redraw so the painter re-runs and
  // swaps its placeholder for the real bitmap.
  useEffect(() => subscribeImageReady(() => {
    canvasApiRef.current?.requestRedraw?.();
  }), []);

  // Deferred dynamic-glyph bakes (over-budget frames) redraw exactly like
  // late image decodes: bake lands → notify → repaint with the new quads.
  useEffect(() => subscribeGlyphReady(() => {
    canvasApiRef.current?.requestRedraw?.();
  }), []);

  // SceneCanvas owns the view state so writes from immediate-timing actions
  // (viewport.pan / viewport.zoom via the dep registry's `view.set`) drive a
  // re-render of the underlying Canvas. We always render Canvas in controlled
  // mode (`view={effectiveView}`); Canvas's own internal useState is unused
  // along this path. When `viewProp` is supplied by the consumer we defer to
  // it (true external control).
  const [internalView, setInternalView] = useState<View>(
    viewProp ?? defaultView ?? { x: 0, y: 0, scale: { x: 1, y: 1 } },
  );
  const effectiveView: View = viewProp ?? internalView;

  // Stable ref tracking the latest view for HUDs / picking / pinch.
  const currentViewRef = useRef<View>(effectiveView);
  currentViewRef.current = effectiveView;

  const handleViewChange = useCallback((v: View) => {
    if (viewProp === undefined) setInternalView(v);
    onViewChangeProp?.(v);
  }, [viewProp, onViewChangeProp]);

  // Selection: caller-supplied wins; otherwise build from selectionOptions.
  // Hooks always run unconditionally — when a caller supplies `selection`,
  // the internally-built one is unused but the hook still fires.
  // When selectionMode === 'multi', forward that into the options so the
  // internal selection hook uses multi-select semantics.
  const derivedSelectionOptions = useMemo<UseSelectionOptions>(() => {
    const base = selectionOptions ?? {};
    if (base.mode !== undefined) return base;
    if (selectionMode === 'multi') return { ...base, mode: 'multi' };
    return base;
  }, [selectionOptions, selectionMode]);
  const internalSelection = useSelection(derivedSelectionOptions);
  const baseSelection = selectionProp ?? internalSelection;

  // selectionMode === 'none' wraps the selection so canvas interactions can't
  // mutate it. The underlying api is still accessible via the `selection` prop
  // or `useSelection` directly.
  const selection: SelectionApi = useMemo(() => {
    if (selectionMode !== 'none') return baseSelection;
    const noopSet = () => {};
    return {
      ...baseSelection,
      set: noopSet,
      add: noopSet,
      remove: noopSet,
      toggle: noopSet,
      clear: noopSet,
      applyClick: noopSet,
    };
  }, [baseSelection, selectionMode]);

  // Publish the current selection (with optional per-id kind labels) into any
  // surrounding `<SelectionContextProvider>` so non-canvas UI can read it.
  // No-op when no provider is in scope.
  const selectionKinds = useMemo<readonly (string | undefined)[] | undefined>(() => {
    if (selection.current.length === 0) return undefined;
    const out: (string | undefined)[] = [];
    for (const id of selection.current) {
      const node = scene.get(id);
      if (!node) { out.push(undefined); continue; }
      if (describeKind) { out.push(describeKind(node)); continue; }
      // Default heuristic: containers -> 'group', poses with .kind -> 'path',
      // everything else unlabelled (consumer can supply describeKind to fill in).
      if (node.kind === 'container') { out.push('group'); continue; }
      const pose = node.pose as unknown as { kind?: unknown } | null;
      if (pose && typeof pose === 'object' && 'kind' in pose && typeof pose.kind === 'string') {
        out.push('path');
        continue;
      }
      out.push(undefined);
    }
    return out;
  }, [selection.current, scene, describeKind]);
  usePublishSelection(selection.current, selectionKinds);

  // Path-editing edit-mode state. Owned here so it's reachable from both:
  //   - the `pathEditingOverlay` chrome layer wired below
  //   - `useEditAnchorsDepSource`, mounted in the child StandardActionsRegistrar
  // The state stays empty until `enterPathEditAction` (double-click on a
  // selected polygon) sets it, and clears on `exitPathEditAction` (Escape).
  // Until then, the chrome doesn't draw and the gesture doesn't route to
  // `editAnchorsAction` — both gate on `editingId !== ''`.
  const [pathEditingId, setPathEditingId] = useState<string>('');
  const pathEditingIdRef = useRef(pathEditingId);
  pathEditingIdRef.current = pathEditingId;
  // `anchorEditingAllowed` is declared below (it needs `getActiveModeRef`);
  // hold it in a ref so `effectivePathEditingId` — used by consumers
  // declared both above and below that point — can read it lazily.
  const anchorEditingAllowedRef = useRef<(() => boolean) | undefined>(undefined);
  /**
   * The edit target, masked by whether the host still permits anchor
   * editing.
   *
   * Every surface that cares — the overlay layer, the `editingAnchors`
   * rule input, the selection-overlay suppression set, the select tool's
   * extend-click lock — reads this rather than the raw state. Leaving
   * path-edit mode therefore tears all of them down at once, by any route.
   * That matters because `exitPathEditAction` is not the only way out:
   * `apps/draw` handles Escape in a capture-phase listener and calls
   * `stopPropagation()`, so the dispatcher never sees the key, and before
   * this the raw id stayed set — inert anchor squares kept drawing over
   * the shape and the selection outline stayed suppressed.
   *
   * Masking rather than clearing on purpose: the mode can change without
   * re-rendering this component, so there is no reliable moment to write
   * state. Read-time masking cannot go stale.
   */
  const effectivePathEditingId = useCallback((): string => {
    const allowed = anchorEditingAllowedRef.current;
    if (allowed && !allowed()) return '';
    return pathEditingIdRef.current;
  }, []);
  // Anchor selection + in-flight marquee. Both are per-frame inputs to
  // the overlay's draw(), never to a React render, so they live in refs
  // and request a repaint directly. Holding them in state would re-render
  // the whole SceneCanvas subtree on every pointermove of a marquee drag.
  const selectedAnchorsRef = useRef<ReadonlySet<number>>(EMPTY_ANCHOR_SELECTION);
  const anchorMarqueeRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const editAnchorsExternalState = useMemo(() => ({
    getEditingId: () => effectivePathEditingId(),
    setEditingId: (id: string | null) => setPathEditingId(id ?? ''),
    getSelectedAnchors: () => selectedAnchorsRef.current,
    setSelectedAnchors: (next: ReadonlySet<number>) => {
      selectedAnchorsRef.current = next;
      canvasApiRef.current?.requestRedraw?.();
    },
    getMarquee: () => anchorMarqueeRef.current,
    setMarquee: (rect: { x: number; y: number; width: number; height: number } | null) => {
      anchorMarqueeRef.current = rect;
      canvasApiRef.current?.requestRedraw?.();
    },
  }), []);

  // Adapter + select tool — folded into a single hook that synthesizes both.
  // Apply the DEFAULT_HANDLE_SIZE fallback here so useSceneSelectTool always
  // receives a concrete radius even when the caller omits selectTool entirely.
  const selectToolWithDefaults = useMemo(() => ({
    handleHitRadius: DEFAULT_HANDLE_SIZE,
    // Shift-click belongs to the anchor selection while a path is being
    // anchor-edited; see `UseSelectToolOptions.extendClickLocked`.
    extendClickLocked: () => effectivePathEditingId() !== '',
    // `selectionAllowed` used to sit here, hand-checking the active mode for
    // `creates-selection` because the tool's pointerDown classifier was a
    // phase-table route and `Action.eligible` was never evaluated on that
    // pipeline (audit 3.4). The classifier is now `select.pick`, which
    // declares that capability itself — one rule, evaluated in one place.
    ...selectToolOpts,
  }), [selectToolOpts]);

  // Stable ref to the live selection; updated every render so the affordanceAt
  // and classifyTarget thunks (which live in an effect closure) always read
  // the latest selection without causing re-renders.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  // Build a per-instance NodeRouting registry. When `routing` is unset, fall
  // back to `inferredNodeRouting` (data-shape inference: `data.text` →
  // `'text'`, `data.path` → `'path'`, `data.image` → `'image'`). Pass an
  // explicit `routing={[]}` to opt out entirely — the classifier becomes
  // undefined and every hit comes back as `kind: 'unknown'`.
  const kindClassifier = useMemo(() => {
    const effective = routing === undefined ? inferredNodeRouting : routing;
    if (effective.length === 0) return undefined;
    const registry = createNodeRouting();
    for (const k of effective) registry.register(k);
    return (data: TData) => registry.classify(data);
  }, [routing]);

  // Node id → routing-trait kind, for the body classifier. Reusing the routing
  // registry here is what makes `target: 'kind:text'` on a binding speak the
  // same vocabulary as `Hit.kind` and the routing tables, rather than a second
  // one invented for bindings. Undefined when `routing={[]}` opts out, which
  // leaves every `kind:` target form unmatchable.
  const kindOfNode = useMemo(() => {
    if (!kindClassifier) return undefined;
    return (id: string): string | undefined => {
      const node = scene.get(id as NodeId);
      return node ? kindClassifier(node.data) : undefined;
    };
  }, [kindClassifier, scene]);

  const { adapter, selectTool: internalSelect, rotateTool, pickEvery: internalPickEvery, pickBest: internalPickBest, boundsOf: internalBoundsOf } = useSceneSelectTool({
    scene,
    selection,
    geometry,
    // The pick tolerance is declared in screen pixels; this is what converts it.
    getView: () => currentViewRef.current,
    selectTool: selectToolWithDefaults,
    ...(insertTool ? { insertTool } : {}),
    ...(layouts ? { layouts } : {}),
  });

  // Build getNodeAtPoint from the adapter + internalPickEvery. Canvas no longer
  // synthesizes this itself — it accepts it as a prop (seam refactor).
  // The node resolver classifies each hit's `data` directly via kindClassifier
  // (the registry-backed kind function), plus getPose and getNode, matching the
  // old Canvas synthesizer algorithm (see src/canvas/getNodeAtPoint.ts).
  //
  // When isPointerInteractive is supplied, the result is filtered: ids for
  // which the predicate returns false cause getNodeAtPoint to return null,
  // suppressing pointer events for non-interactive nodes (e.g. scoping-dim).
  const getNodeAtPoint = useMemo(() => {
    if (!internalPickEvery) return undefined;
    const nodeResolver = (id: string) => {
      const node = adapter.getNode(id);
      const kind = node && kindClassifier ? kindClassifier(node.data) : 'unknown';
      const pose = adapter.getPose(id);
      const data = node ?? { id };
      return { kind, pose, data };
    };
    const base = makeGetNodeAtPoint(internalPickEvery, nodeResolver);
    if (!isPointerInteractive) return base;
    return (wx: number, wy: number) => {
      const hit = base(wx, wy);
      if (hit == null) return null;
      if (isPointerInteractive(hit.id) === false) return null;
      return hit;
    };
  }, [adapter, internalPickEvery, isPointerInteractive, kindClassifier]);

  // Viewport tools: Canvas now owns the full `useViewportTools` call (including
  // pinch zoom via its own canvasRef). SceneCanvas only needs the hand tool for
  // registry assembly and the `viewportRegistered` flag for the built-in tool
  // list. Both are derived directly here without going through useViewportTools.
  //
  // `viewportRegistered` — same logic as useViewportTools: truthy when the
  // viewport prop is non-undefined. SceneCanvas's default is pan+zoom enabled
  // even when the consumer omits the viewport prop (undefined !== false).
  const viewportRegistered = !!viewport;

  // Extract inertia config for useHandTool — mirrors useViewportTools logic.
  const inertiaEnabled = !!viewport?.inertia;
  const inertiaObj = typeof viewport?.inertia === 'object' ? viewport.inertia : undefined;
  const handToolInertia = inertiaEnabled && inertiaObj
    ? {
        friction: inertiaObj.friction,
        minSpeed: inertiaObj.minSpeed,
        boundary: inertiaObj.boundary,
        bounds: inertiaObj.bounds,
      }
    : undefined;
  // useHandTool must always be called (rules of hooks); it is a no-op when
  // viewport is absent — the tool is simply not added to the registry.
  const handTool = useHandTool(handToolInertia ? { inertia: handToolInertia } : {});

  // Keyboard zoom and wheel zoom/pan are handled by the viewport.pan and
  // viewport.zoom descriptors via the gesture dispatcher.
  // viewportAmbient no longer includes keyZoom/wheelZoom tool instances.
  const viewportAmbient: AnyTool[] = [];

  // Resolve which built-ins to mount. Precedence: explicit `defaultTools` >
  // `toolBundle` preset > legacy default (select/rotate, plus hand
  // when viewport is engaged).
  const baseRequestedTools: readonly BuiltinToolId[] =
    defaultTools
    ?? (toolBundle ? BUNDLE_TOOLS[toolBundle] : null)
    ?? (viewportRegistered
      ? ['select', 'rotate', 'hand']
      : ['select', 'rotate']);

  // Patch-form `tools` extras with value `true` widen the requested set
  // ("pull in this built-in even if it's not in the active tier"). Computed
  // here so the rest of the if-ladder treats them identically to ids that
  // came in via `defaultTools` / `toolBundle`.
  const KNOWN_BUILTIN_IDS: ReadonlySet<BuiltinToolId> = new Set<BuiltinToolId>([
    'select', 'rotate', 'hand',
    'rect', 'ellipse', 'line', 'polygon', 'star', 'pen', 'pencil', 'lasso', 'text',
  ]);
  const toolsPatchExtras = (() => {
    if (!toolsProp || isToolsApi(toolsProp)) return null;
    return toolsProp;
  })();
  const trueIds = new Set<BuiltinToolId>();
  if (toolsPatchExtras) {
    for (const [id, value] of Object.entries(toolsPatchExtras)) {
      if (value !== true) continue;
      if (!KNOWN_BUILTIN_IDS.has(id as BuiltinToolId)) {
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[SceneCanvas] tools.${id}=true is not a known built-in id; ignoring`);
        }
        continue;
      }
      trueIds.add(id as BuiltinToolId);
    }
  }
  const wants = (id: BuiltinToolId): boolean =>
    baseRequestedTools.includes(id) || trueIds.has(id);

  // Synthesize the shape/lasso/text/clone tools — always called per React
  // rules-of-hooks; only registered below when requested. Per-tool options
  // (lasso mode, clone-selection) thread through `toolOptions`.
  const shapeTools = useBuiltinShapeTools({ scene, adapter, options: toolOptions });

  // WHY ambient (not registry) for rotate: rotate is affordance-driven — no
  // foreground activation, no hotkey — so the active slot is wrong for it and
  // ambient is what's left. Resize doesn't get a tool at all; it runs entirely
  // through the dispatcher-side `resizeAction` + `resizePolicy` dep.
  //
  // The reason this comment used to give — that `getActiveOverlays()` is what
  // routes a tool's `hitTest`, so rotate had to be in one of those slots — was
  // describing a pipeline (`__setHitTestContext`) that no longer exists.
  // Nothing hit-tests tool overlays now; `buildAffordanceAt` owns the rotation
  // affordance directly. What the ambient mount still buys is the overlay's
  // *paint* slot, which for rotate draws nothing by default (`paint: null` —
  // the cursor change is the only cue). Left in place because `useRotateTool`
  // is public and consumers can give the ring a visible paint, but see the
  // TODO entry: the mount is close to vestigial.
  const builtinAmbient: AnyTool[] = [];
  if (wants('rotate')) builtinAmbient.push(rotateTool);

  const mergedAmbient = [...viewportAmbient, ...builtinAmbient, ...(ambient ?? [])];

  const internalRegistry: Record<string, AnyTool> = {};
  if (wants('select')) internalRegistry.select = internalSelect;
  // `hand` stays in the registry (not ambient) so its H keybinding + space
  // hotkey route through `useKeybindings`. The `viewportRegistered` guard
  // ensures a consumer who passes `defaultTools: ['select','hand']` without
  // enabling the viewport feature still gets a clean registry (no hand entry).
  if (wants('hand') && viewportRegistered) internalRegistry.hand = handTool;
  // Shape / lasso / text tools — registry entries with built-in
  // keybindings (R/E/G/N/L/T) routed via `useKeybindings`.
  if (wants('rect'))    internalRegistry.rect    = shapeTools.rect;
  if (wants('ellipse')) internalRegistry.ellipse = shapeTools.ellipse;
  if (wants('line'))    internalRegistry.line    = shapeTools.line;
  if (wants('polygon')) internalRegistry.polygon = shapeTools.polygon;
  if (wants('star'))    internalRegistry.star    = shapeTools.star;
  if (wants('pen'))     internalRegistry.pen     = shapeTools.pen;
  if (wants('pencil'))  internalRegistry.pencil  = shapeTools.pencil;
  if (wants('lasso'))   internalRegistry.lasso   = shapeTools.lasso;
  if (wants('text'))    internalRegistry.text    = shapeTools.text;

  // Patch-form `tools` prop: merge extras / overrides / omissions into the
  // internal registry. `false` drops a bundled tool; `true` is already
  // accounted for above via the `wants()` expansion; `AnyTool` adds or
  // replaces (dev-only warning on replace). Takeover form (full `ToolsApi`)
  // is handled below via `toolsProp ?? internalTools`.
  const toolsPatch = toolsPatchExtras;
  if (toolsPatch) {
    for (const [id, value] of Object.entries(toolsPatch)) {
      if (value === false) {
        delete internalRegistry[id];
      } else if (value === true) {
        // Already pulled in via the `wants()`-driven if-ladder above.
        continue;
      } else {
        if (IS_DEV && id in internalRegistry) {
          // eslint-disable-next-line no-console
          console.warn(`[SceneCanvas] tools prop overrides bundled "${id}" tool`);
        }
        internalRegistry[id] = value;
      }
    }
  }

  // Takeover form: only when toolsProp is the full ToolsApi shape.
  const toolsTakeover = toolsProp && isToolsApi(toolsProp) ? toolsProp : null;

  const internalTools = useTools({
    active: initialActiveTool ?? 'select',
    registry: internalRegistry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
  });

  // Auto-wire keybindings against whichever registry is live.
  //
  // Both calls fire unconditionally (rules of hooks); the inactive one is
  // silenced via the hook's own `disable` option:
  //   - internal registry: disabled whenever the consumer passed `tools=`.
  //   - consumer registry: disabled when `tools=` was omitted (nothing to
  //     bind) or when the consumer opted out via `enableKeybindings={false}`.
  //
  // The `enableKeybindings` opt-out also silences the internal wiring, so
  // a consumer relying entirely on the internal tools can take over with
  // their own `useKeybindings(...)` call. The fallback `useTools` passed
  // to the second call when `toolsProp` is absent is a render-stable empty
  // stand-in just to keep the call site valid; it never actually fires
  // because `disable` is true on that branch.
  const toolsForEligibilityRef = useRef<ToolsApi | null>(null);
  toolsForEligibilityRef.current = toolsTakeover ?? internalTools;
  //
  // `isToolEligible` mirrors `eligibleForMode` (packages/modes) — the same
  // predicate `ToolPalette` uses to grey a button out. Without a mode
  // registry every tool stays activatable.
  const isToolEligible = useCallback((toolId: string): boolean => {
    const getMode = getActiveModeRef.current;
    if (!getMode) return true;
    const registry = toolsForEligibilityRef.current?.registry;
    const caps = registry?.[toolId]?.capabilities ?? [];
    if (caps.length === 0) return false;
    const allowed = getMode().allowedCapabilities;
    for (const c of caps) if (allowed.has(c)) return true;
    return false;
  }, []);

  // NOTE: the actual `useKeybindings` calls live in <ToolKeybindingsMounter>,
  // rendered inside <ActionsProviderIfRoot> below. They used to sit here, but
  // this component is ABOVE the provider, so `useActionsRegistry()` returned
  // null and the `tool.activate` / `tool.offhand` registrations silently
  // no-op'd. That went unnoticed because a parallel document `keydown`
  // listener inside the hook did the real work; deleting the listener (audit
  // 3.8) exposed the layering bug.

  const tools = toolsTakeover ?? internalTools;

  // Surface the resolved ToolsApi to the introspection callback (the
  // toolkit-builder dev surface uses this to walk `tools.registry` for
  // its live route table). Fires whenever the `tools` identity changes,
  // which is stable across most renders thanks to useTools' useMemo.
  const onToolsCreatedRef = useRef(onToolsCreated);
  onToolsCreatedRef.current = onToolsCreated;
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools]);

  // `onDoubleClick` used to be backed by a native `dblclick` listener on the
  // canvas, which made it a THIRD independent definition of "double click"
  // alongside the tool dispatcher's 300ms/8px `dblTap` and the gesture
  // dispatcher's 600ms/8px synthesized event — so which double-click
  // behaviors a consumer got depended on the millisecond gap between the two
  // clicks. The other two are gone; this now observes the gesture
  // dispatcher's single definition and resolves the hit with the same
  // `getNodeAtPoint` picker the rest of the canvas uses.
  //
  // It rides the dispatcher as an OBSERVER rather than an Action binding
  // because the prop is a notification, not a behavior: as a binding it would
  // lose first-match-wins to `enterPathEdit` on every body hit and silently
  // stop firing.
  const onDoubleClickRef = useRef(onDoubleClick);
  onDoubleClickRef.current = onDoubleClick;
  const getNodeAtPointRef = useRef(getNodeAtPoint);
  getNodeAtPointRef.current = getNodeAtPoint;
  const onDoubleClickObserver = useMemo(() => {
    if (!onDoubleClick) return undefined;
    return (world: { x: number; y: number }): void => {
      const cb = onDoubleClickRef.current;
      if (!cb) return;
      const result = getNodeAtPointRef.current?.(world.x, world.y);
      cb(result ? { id: result.id, kind: result.kind } : null);
    };
    // Identity only needs to change between "wired" and "not wired" — the
    // callback and picker are both read through refs.
  }, [Boolean(onDoubleClick)]); // eslint-disable-line react-hooks/exhaustive-deps

  // (Legacy `gestures` prop removed alongside the consumer-facing action
  // hooks; undo/redo and friends now register via the Actions Registry.)

  // Merge caller-supplied layers with kit defaults. When `layers` is omitted
  // the result is the full default set (scene + selectionOverlay). Partial
  // configs deep-merge; `null` slot values suppress a default explicitly.
  const mergedLayers = useMemo(
    () => mergeLayersWithDefaults(layers),
    [layers],
  );

  // `selectTool.rotate === false` disables rotation: drop the `rotate` action
  // (its rotation-handle chrome is hidden via effectiveChromeVisibility above).
  // A consumer-supplied `rotate` override still wins; `actions === null`
  // (all defaults disabled) is left untouched.
  const resolvedActions = useMemo<ActionsProp | undefined>(() => {
    if (selectToolOpts?.rotate !== false) return actions;
    if (actions === null) return null;
    const merged = { ...(actions ?? {}) } as Record<string, unknown>;
    if (!('rotate' in merged)) merged.rotate = null;
    return merged as ActionsProp;
  }, [actions, selectToolOpts?.rotate]);

  // Stable action-lookup getter threaded into the dispatcher so
  // beginUiOngoing can resolve action ids at call time. Populated by
  // StandardActionsRegistrar once it has the registry in scope.
  const getActionRef = useRef<((id: string) => Action | undefined) | null>(null);

  // Shared `Dispatcher` instance — created once per `<SceneCanvas>` and
  // threaded to both the gesture-dispatcher mounter (which pumps input
  // events into it) and the preview-ghost layer (which walks its
  // `getInFlightHandles()` for dispatcher-side gesture previews). Lazy
  // ref init keeps identity stable across renders without an effect.
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = createDispatcher({
      getAction: (id) => getActionRef.current?.(id),
    });
  }
  const dispatcher = dispatcherRef.current;

  // The dispatcher's contribution to `helpersRef` — in-flight preview ids,
  // nascent-insert bounds, and the pump signal. Reads through the ref so one
  // stable object keeps pointing at the live dispatcher.
  const gestureSource = useMemo(() => createGestureSource(() => dispatcherRef.current), []);

  // Preview-ghost layer: renders in-flight gesture poses on top of the
  // committed scene using the scene slot's `drawOne`. Walks both the
  // tools registry and the dispatcher's in-flight handles.
  const previewLayer = usePreviewGhostLayer<TData, TLayer, TPose>({
    scene,
    tools,
    sceneSlot: mergedLayers.scene,
    dispatcher,
  });

  // Dispatcher-driven chrome overlays — marquee rect + lasso polyline +
  // any other `OngoingHandle.overlay()` shapes the in-flight actions
  // publish. Screen-space; slotted after the preview-ghost so chrome
  // paints on top of any displaced ghost silhouettes.
  const dispatcherOverlay = useDispatcherOverlayLayer({ dispatcher });

  // Chrome-caps hover tracking: last-hovered NodeId fed into `ChromeCtx.hover`.
  // The hook attaches its own pointermove/leave listeners on the canvas and
  // caches the topmost-id from `getNodeAtPoint` on a ref. No re-renders.
  const chromeCapsClientToWorld = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = internalCanvasRef.current;
    const view = currentViewRef.current;
    if (!canvas) return { x: clientX, y: clientY };
    const rect = canvas.getBoundingClientRect();
    const [x, y] = clientToWorldHelper(clientX, clientY, rect, view);
    return { x, y };
  }, []);
  const getHover = useHoverTracking({
    canvasRef: internalCanvasRef,
    clientToWorld: chromeCapsClientToWorld,
    getNodeAtPoint: (wx, wy) => {
      const hit = getNodeAtPoint?.(wx, wy);
      return hit ? { id: hit.id as NodeId } : null;
    },
    enabled: chromeVisibility !== undefined,
  });

  // Stable refs for the live selection / view / focus / suppression sources
  // that feed `buildChromeCtx`. The resolver factory below closes over these
  // and is called per draw / per hitTest from Canvas.
  const selectionForCapsRef = useRef<readonly NodeId[]>([]);
  const getFocusedPropRef = useRef(getFocusedProp);
  getFocusedPropRef.current = getFocusedProp;
  // selectionMode 'none' suppresses the marquee / lasso chrome by default:
  // every selection write no-ops in that mode, so the select tool's
  // empty-drag binding still CLAIMS the gesture (keeping it from falling
  // through to other ambient drag actions like insert) but paints nothing.
  // An explicit consumer rule for either id still wins.
  const effectiveChromeVisibility = useMemo(() => {
    // Kit defaults first; consumer `chromeVisibility` spread last so it wins.
    const defaults: import('features/chrome-caps').VisibilityRules = {};
    if (selectionMode === 'none') {
      defaults['action.marquee'] = never;
      defaults['action.lasso'] = never;
    }
    // `selectTool.rotate === false` hides the rotation handle (its action is
    // also dropped below) so a non-rotatable consumer fully opts out.
    if (selectToolOpts?.rotate === false) defaults['selection.rotation-handle'] = never;
    if (Object.keys(defaults).length === 0) return chromeVisibility;
    return { ...defaults, ...chromeVisibility };
  }, [chromeVisibility, selectionMode, selectToolOpts?.rotate]);
  const chromeVisibilityRef = useRef(effectiveChromeVisibility);
  chromeVisibilityRef.current = effectiveChromeVisibility;
  const getActiveModeRef = useRef(getActiveMode);
  getActiveModeRef.current = getActiveMode;
  // Per-node resizability predicate from `selectTool.resize.resizable`, folded
  // over the live selection into the `selectionResizable` rule-ctx flag below.
  const resizablePredRef = useRef(selectToolOpts?.resize?.resizable);
  resizablePredRef.current = selectToolOpts?.resize?.resizable;

  // The visibility predicate factory passed to <Canvas>. Called fresh per
  // draw / hitTest; builds ChromeCtx from the live refs and resolves
  // against the merged rule table. Returns the universal predicate when
  // no consumer overrides are present AND no hover tracking is needed —
  // letting the kit's defaults still gate paint without forcing every
  // legacy consumer onto chrome-caps.
  /** Build the live RuleCtx — selection + view + modifiers + mode + capabilities
   *  + active action. Consumed by chrome-caps' resolver and the dispatcher's
   *  eligibility filter so both see the same view of the world. */
  const buildCurrentRuleCtx = useCallback(() => {
    const sel = selectionForCapsRef.current;
    // No mode registry wired → behave as normal mode, capabilities included.
    // An empty set here would make every `capability:` rule false and hide
    // the chrome those rules gate. See DEFAULT_ALLOWED_CAPABILITIES.
    const modeInfo = getActiveModeRef.current?.()
      ?? { id: 'normal', allowedCapabilities: DEFAULT_ALLOWED_CAPABILITIES };
    const ctx = buildChromeCtx({
      focused: getFocusedPropRef.current ? getFocusedPropRef.current() : true,
      selection: sel,
      multiActive: sel.length > 1,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      action: dispatcher.getActiveAction(),
      hover: getHover(),
      view: currentViewRef.current,
    });
    // buildChromeCtx returns a ChromeCtx (legacy shape); resolveVisibility
    // accepts both ChromeCtx and RuleCtx and supplies defaults when mode/
    // allowedCapabilities are absent. We attach them inline so the
    // mode-gated default rules can read them.
    // `selectionResizable`: true only when every selected node is resizable
    // (per `selectTool.resize.resizable`); undefined when no predicate is
    // supplied → the `resizable:` selector treats it as resizable (back-compat).
    const resizablePred = resizablePredRef.current;
    const selectionResizable = resizablePred
      ? sel.every((id) => resizablePred(id as string))
      : undefined;
    return {
      ...ctx,
      mode: modeInfo.id,
      allowedCapabilities: modeInfo.allowedCapabilities,
      selectionResizable,
      editingAnchors: effectivePathEditingId() !== '',
    };
  }, [dispatcher, getHover]);

  // Anchor editing survives only as long as the active mode permits it.
  // Deliberately undefined when no mode registry is wired: "no modality"
  // means nothing revokes edit mode, whereas a predicate built from the
  // fallback capability set would revoke it immediately (the default set
  // is NORMAL's, which doesn't include `edits-anchors`).
  const anchorEditingAllowed = useMemo(
    () =>
      getActiveMode
        ? () => getActiveModeRef.current!().allowedCapabilities.has('edits-anchors')
        : undefined,
    [getActiveMode],
  );
  anchorEditingAllowedRef.current = anchorEditingAllowed;

  const getIsVisibleForCanvas = useCallback((): (id: string) => boolean => {
    const ruleCtx = buildCurrentRuleCtx() as Parameters<typeof resolveVisibility>[1];
    return resolveVisibility(chromeVisibilityRef.current, ruleCtx);
  }, [buildCurrentRuleCtx]);
  // Stable indirection so the memoized path-editing overlay layer can ask
  // the live predicate without being rebuilt each render.
  const getIsVisibleForCanvasRef = useRef(getIsVisibleForCanvas);
  getIsVisibleForCanvasRef.current = getIsVisibleForCanvas;

  // Pen preview overlay — reads the pen tool's persistent scratch and draws
  // the in-progress path (anchors, handles, rubber-band, close hint). Only
  // wired when the pen tool is actually registered; otherwise null.
  const penPreviewLayer = useMemo(
    () => (wants('pen')
      ? createPenPreviewLayer({ penTool: shapeTools.pen as Tool<PenScratch> })
      : null),
    // shapeTools.pen identity is stable across renders (returned from a hook
    // that memoizes via defineTool). `wants('pen')` is recomputed each render
    // from `baseRequestedTools` + patch-form `true` entries — capture both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shapeTools.pen, baseRequestedTools, trueIds],
  );

  // Bump the canvas's redraw whenever edit-mode changes — the chrome layer
  // reads `editingId` via a ref, so without an explicit redraw signal a
  // dirty-render canvas (no animation in flight) sits with stale frames
  // and the user sees no chrome until something else triggers a paint.
  useEffect(() => {
    canvasApiRef.current?.requestRedraw?.();
  }, [pathEditingId]);

  // Path-editing overlay — anchor squares, tangent lines, control-point
  // dots for the polygon currently in edit mode. Reads the same state the
  // dep does, so chrome appears exactly when (and only when) the gesture
  // path is also active.
  //
  // `getPose` walks the dispatcher's in-flight handles first so the chrome
  // tracks the live `previewPose` while editAnchorsAction is dragging; only
  // falls back to the committed scene pose between gestures. This is what
  // makes the dragged anchor / handle move under the cursor instead of
  // staying pinned to its committed position until the drag commits.
  const sceneRefForOverlay = useRef(scene);
  sceneRefForOverlay.current = scene;
  // Debug: slops viz layer (off by default). Builds the affordance halos
  // once and reads live state through refs every frame — the same pattern
  // the chrome layers use. Identity stays stable so wiredLayers below
  // doesn't churn.
  const slopsLayer = useMemo(
    () => createSlopsDebugLayer({
      selectionRef: selectionRef as unknown as React.RefObject<SelectionApi>,
      boundsOf: (id) => internalBoundsOf?.(id) ?? null,
      getEditingId: () => effectivePathEditingId() || null,
      // Halos follow the live (preview-aware) polygon so they sit on
      // top of the rendered anchors during anchor-edit drags AND when
      // the whole path is being moved.
      getPose: (id) => livePathFor(id) as never,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [internalBoundsOf],
  );

  // Resolve the live (preview-aware) world polygon for `id`. Reads from
  // the dispatcher's in-flight handles first — whichever handle owns
  // the gesture (editAnchors anchor-drag, move-the-whole-path, etc.)
  // contributes the previewPose / previewData that we'd otherwise
  // dispatch separately. Synthesizes a (pose, data) pair and routes it
  // through `resolveEditablePathOf` so chrome and slops viz follow
  // *any* in-flight gesture that previews state for the editing id.
  const livePathFor = (id: string): PolygonPath | null => {
    const node = sceneRefForOverlay.current?.get(id as never);
    if (!node) return null;
    let pose = node.pose as unknown;
    let data = node.data as unknown;
    let touched = false;
    const disp = dispatcherRef.current;
    if (disp) {
      for (const handle of disp.getInFlightHandles()) {
        const previewIds = handle.previewIds?.();
        if (!previewIds) continue;
        let owns = false;
        for (const pid of previewIds) {
          if (pid === id) { owns = true; break; }
        }
        if (!owns) continue;
        const p = handle.previewPose?.(id);
        if (p != null && !touched) { pose = p; touched = true; }
        const d = handle.previewData?.(id);
        if (d != null) { data = d; touched = true; }
      }
    }
    return resolveEditablePathOf({ pose, data } as { pose: unknown; data: unknown });
  };

  const pathEditingOverlayLayer = useMemo(
    () => createPathEditingOverlayLayer({
      getEditingId: () => effectivePathEditingId() || null,
      getPose: (id) => livePathFor(id) as never,
      getSelectedAnchors: () => selectedAnchorsRef.current,
      getMarquee: () => anchorMarqueeRef.current,
      isVisible: (chromeId: string) => getIsVisibleForCanvasRef.current()(chromeId),
    }),
    // Stable identity — closure reads live state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Suppress the standard selection overlay (outline + corner/rotate
  // handles) on the node currently in path-edit mode — the per-anchor
  // chrome takes over.
  const getSuppressedSelectionIds = useCallback((): ReadonlySet<string> => {
    const id = effectivePathEditingId();
    return id ? new Set([id]) : EMPTY_ID_SET;
  }, []);

  // Selection overlay — constructed here (scene-aware) per main's seam refactor.
  // Layered on top: path-edit suppression from HEAD's branch.
  const selectedIds = selection.current;
  const multiActive = selectedIds.length > 1;

  // Keep chrome-caps live selection source in sync; updates each relevant render.
  selectionForCapsRef.current = selectedIds as readonly NodeId[];
  const selectionOverlayLayer = useMemo(() => {
    const selCfg = mergedLayers.selectionOverlay as
      | SelectionOverlaySlotConfig<TPose>
      | null
      | undefined;
    if (selCfg === null) return null;
    const cfg = (selCfg ?? {}) as SelectionOverlaySlotConfig<TPose>;

    const poseById =
      cfg.poseById ??
      ((id: string): TPose | null => {
        const tp = firstPreviewPose(tools, id) as TPose | null;
        if (tp != null) return tp;
        for (const handle of dispatcher.getInFlightHandles()) {
          const dp = handle.previewPose?.(id);
          if (dp != null) return dp as TPose;
        }
        const tb = firstPreviewBounds(tools, id);
        if (tb != null) return tb as unknown as TPose;
        // The synthetic multi-resize union is resolved by the overlay layer
        // from `ChromeState.unionBounds` at draw time (the single owner of
        // the union AABB, shared with the affordance hit-tester) — no inline
        // re-derivation here.
        if (!adapter) {
          if (internalBoundsOf) {
            const b = internalBoundsOf(id);
            return (b as unknown as TPose) ?? null;
          }
          return null;
        }
        try {
          return adapter.getPose(id);
        } catch {
          return null;
        }
      });

    const getSelection = multiActive
      ? (): readonly NodeId[] => [MULTI_RESIZE_TARGET_ID as NodeId]
      : (): readonly NodeId[] => selectedIds as readonly NodeId[];
    const getOutlineIds = multiActive
      ? (): readonly NodeId[] => selectedIds as readonly NodeId[]
      : undefined;

    const callerSuppress = cfg.getSuppressedIds;
    const getSuppressedIds = (): ReadonlySet<string> => {
      const own = getSuppressedSelectionIds();
      const caller = callerSuppress?.();
      if (!caller || caller.size === 0) return own;
      if (own.size === 0) return caller;
      const merged = new Set<string>(caller);
      for (const id of own) merged.add(id);
      return merged;
    };

    return createSelectionOverlayLayer<TPose>({
      ...cfg,
      getSelection,
      ...(getOutlineIds ? { getOutlineIds } : {}),
      getPose: poseById,
      getSuppressedIds,
      getBounds:
        cfg.getBounds ??
        ((p: TPose): Bounds => {
          if (multiActive) return p as unknown as Bounds;
          return AUTO_POSE_DESCRIPTOR.getBounds(p) as Bounds;
        }),
    });
  }, [mergedLayers.selectionOverlay, selectedIds, multiActive, internalBoundsOf, tools, adapter, getSuppressedSelectionIds]);

  // When alphaFor is supplied, patch it into the scene slot config so
  // buildSceneLayer (called inside Canvas) wraps per-node commands with the
  // returned alpha multiplier. Only non-custom, non-null slots are patched.
  const sceneSlotWithAlpha = useMemo(() => {
    if (!alphaFor) return mergedLayers.scene;
    const slot = mergedLayers.scene;
    if (!slot || 'layer' in slot) return slot; // null or CustomLayerEntry — leave alone
    return { ...slot, alphaFor };
  }, [mergedLayers.scene, alphaFor]);

  const wiredLayers = useMemo<LayersMap<Node<TData, TLayer, TPose>, TPose>>(() => ({
    ...mergedLayers,
    // Inject alphaFor into the scene slot when supplied (scoping-dim).
    ...(alphaFor != null ? { scene: sceneSlotWithAlpha } : {}),
    // Pass the pre-built selection overlay layer so Canvas receives a
    // CustomLayerEntry and skips its own factory construction for this slot.
    selectionOverlay: selectionOverlayLayer
      ? { layer: selectionOverlayLayer }
      : mergedLayers.selectionOverlay === null ? null : undefined,
    previewGhost: { layer: previewLayer, after: 'scene' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'previewGhost' },
    ...(penPreviewLayer ? { penPreview: { layer: penPreviewLayer, after: 'dispatcherOverlay' } } : {}),
    pathEditingOverlay: { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    ...(debug?.slops ? { slopsDebug: { layer: slopsLayer, after: 'pathEditingOverlay' } } : {}),
  }), [mergedLayers, sceneSlotWithAlpha, alphaFor, selectionOverlayLayer, previewLayer, dispatcherOverlay, penPreviewLayer, pathEditingOverlayLayer, debug?.slops, slopsLayer]);

  // Standard-action deps: closures over the live scene / selection / adapter
  // so the resolved actions always read current state. `useStandardActions`
  // stabilizes via refs internally — these closures are passed every render
  // but the registered Action descriptors are not re-registered.
  // `CanvasExtensionApi.ingest` — imperative entry into the same
  // content-handler pipeline OS drop / clipboard paste hit. Routed through
  // `registry.trigger('ingest', …)` so the action's `requires` deps
  // (insert, ingestion, …) are resolved exactly as on the dispatcher path.
  // The registry lives inside `<ActionsProviderIfRoot>` below us, so
  // `StandardActionsRegistrar` stashes it into this ref.
  const actionsRegistryRef = useRef<ActionsRegistry | null>(null);

  // Clipboard-paste ctx for the kit weasel-JSON content handler
  // (`IngestCtx.clipboard`). Built from THIS canvas's synthesized adapter so
  // OS-arriving pastes re-materialize through the same `commitPaste` path
  // `useClipboardOps` uses. Absent (⇒ the handler declines) when the
  // consumer set `ingestion.clipboard.enabled: false` or the adapter lacks
  // `commitPaste` (always present on the synthesized adapter; guarded for
  // future adapter overrides).
  const ingestionClipboardReviver = ingestion?.clipboard?.reviver;
  const ingestionClipboardEnabled = ingestion?.clipboard?.enabled !== false;
  const ingestionClipboard = useMemo<ClipboardIngestCtx | undefined>(() => {
    if (!ingestionClipboardEnabled || !adapter?.commitPaste) return undefined;
    return {
      adapter: adapter as unknown as InsertAdapter<{ id: string }>,
      ...(ingestionClipboardReviver ? { reviver: ingestionClipboardReviver } : {}),
    };
  }, [adapter, ingestionClipboardEnabled, ingestionClipboardReviver]);
  const ingestImpl = useCallback(
    (input: File[] | IngestItem[], point?: { x: number; y: number }) => {
      const items: IngestItem[] = (input as (File | IngestItem)[]).map((entry) =>
        entry instanceof File ? itemsFromFiles([entry])[0] : entry,
      );
      if (items.length === 0) return;
      if (!actionsRegistryRef.current) {
        // The registry is stashed by a descendant effect — a consumer calling
        // ingest() from its own ref callback / layout effect lands here.
        dwarn('ingest', 'CanvasExtensionApi.ingest called before the action registry mounted — call ignored. Defer to an effect or event handler.');
        return;
      }
      actionsRegistryRef.current.trigger('ingest', {
        items,
        ...(point ? { worldX: point.x, worldY: point.y } : {}),
      });
    },
    [],
  );

  // Merge the forwarded ref with our internalCanvasRef so usePinchZoomTool
  // can read the canvas element even when the consumer also forwards a ref.
  // The handle exposed to consumers extends the primitive's with `ingest`
  // (SceneCanvas-only — it needs the action stack).
  const mergedRef = useCallback(
    (node: CanvasExtensionApi | null) => {
      internalCanvasRef.current = node?.element ?? null;
      const extended: SceneCanvasApi | null = node
        ? { ...node, ingest: ingestImpl }
        : null;
      canvasApiRef.current = extended;
      if (typeof ref === 'function') ref(extended);
      else if (ref) (ref as React.MutableRefObject<SceneCanvasApi | null>).current = extended;
    },
    [ref, ingestImpl],
  );

  const canvas = (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={mergedRef}
      adapter={adapter}
      selection={selection}
      tools={tools}
      layers={wiredLayers}
      pickEvery={internalPickEvery}
      getIsVisible={getIsVisibleForCanvas}
      previewIdsExtra={() => {
        // Mirror usePreviewGhostLayer: walk the dispatcher's in-flight
        // OngoingHandles and merge each handle's previewIds() so source
        // ids being ghosted by dispatcher-path actions (move, resize,
        // rotate, etc.) get their committed paint hidden under the
        // ghost. Without this, post-Phase-14e-Task-3 the originals
        // would bleed through during drag.
        //
        // Handles that set `previewHidesSource: false` (clone, etc.)
        // opt OUT — their ghost still paints via the preview-ghost
        // layer, but the source stays visible at its committed home.
        const out: string[] = [];
        for (const handle of dispatcher.getInFlightHandles()) {
          if (handle.previewHidesSource === false) continue;
          const ids = handle.previewIds?.();
          if (!ids) continue;
          for (const id of ids) out.push(id);
        }
        return out;
      }}
      // The gesture surface behind `helpersRef.getGestureBounds()` /
      // `subscribeGestures()` — Canvas has no dispatcher of its own.
      gestureSource={gestureSource}
      previewPoseExtra={(id) => {
        // Mirror previewIdsExtra: surface dispatcher in-flight handles'
        // `previewPose(id)` so selection chrome (resize / rotation handles,
        // AABB outline) tracks the ghost during dispatcher-driven drags.
        for (const handle of dispatcher.getInFlightHandles()) {
          const p = handle.previewPose?.(id);
          if (p != null) return p;
        }
        return null;
      }}
      viewport={viewport}
      backgroundFill={backgroundFill}
      cursorCoordsHud={cursorCoordsHud}
      pickHud={pickHud}
      modalityHud={modalityHud}
      pickBest={internalPickBest}
      view={effectiveView}
      onViewChange={handleViewChange}
      shaders={shaders}
      // onBackgroundClick is intentionally NOT wired here. The `clearSelection`
      // action binding in the select tool handles "click on empty background clears
      // selection" for all SceneCanvas consumers. Wiring a separate background-click
      // callback would interfere with the gesture dispatcher (which handles lasso,
      // marquee, etc.) since tools.dispatcher.hasActiveGesture() only covers the
      // legacy tool channel, not the gesture dispatcher channel.
      {...restProps}
    />
  );

  // Test hook: opt-in via ?test=1, never in production builds. See src/test-hook.
  const testHookSceneRef = useRef(scene);
  const testHookSelectionRef = useRef(selection);
  const testHookActiveToolRef = useRef<string | null>(null);
  testHookSceneRef.current = scene;
  testHookSelectionRef.current = selection;

  const testHookRef = useRef<WeaselTestHook | null>(null);
  useEffect(() => {
    // Call-site gate: in a consumer's production build, esbuild/webpack/Vite
    // constant-fold `process.env.NODE_ENV` to `"production"` and DCE this
    // block, dropping the test-hook references. Same dev-only pattern as
    // React's invariant warnings. Gating only inside `installTestHookIfRequested`
    // is not enough — a called function can't be tree-shaken even if its body
    // is dead, so the gate must sit at the call site too.
    if (process.env.NODE_ENV !== 'production') {
      testHookRef.current = installTestHookIfRequested({
        getScene: () => testHookSceneRef.current as never,
        getSelectionIds: () =>
          (testHookSelectionRef.current?.current as readonly string[] | undefined) ?? [],
        getView: () => currentViewRef.current,
        getActiveToolId: () => testHookActiveToolRef.current,
      });
      testHookRef.current?._markReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DepRegistryProviderIfRoot>
      <PointerProviderIfRoot>
        <ActionsProviderIfRoot>
          {canvas}
          <PointerPublisher canvasRef={internalCanvasRef} viewRef={currentViewRef} />
          <StandardActionsRegistrar
            selection={selection}
            scene={scene as Scene<unknown, string, unknown>}
            adapter={adapter as unknown as BridgeAdapter}
            actionDefaults={actionDefaults}
            actions={resolvedActions}
            currentViewRef={currentViewRef}
            onViewChange={handleViewChange}
            resizeOptions={selectToolOpts?.resize as UseResizeOptions<unknown> | undefined}
            geometryProjection={geometryProjection}
            dispatcher={dispatcher}
            getActionRef={getActionRef}
            pickEvery={internalPickEvery}
            viewportPanEnabled={viewport?.pan !== false}
            viewportZoom={viewport?.zoom ?? true}
            viewportRecenter={viewport?.recenter}
            editAnchorsExternalState={editAnchorsExternalState}
            anchorEditingAllowed={anchorEditingAllowed}
            layouts={layouts as SceneCanvasProps<unknown, string, unknown>['layouts']}
            insertNodeFactories={insertNodeFactories}
            snapPoint={toolOptions?.snapPoint}
            canvasRef={internalCanvasRef}
            ingestionResolveSrc={ingestion?.resolveSrc}
            ingestionSvg={ingestion?.svg}
            ingestionClipboard={ingestionClipboard}
            actionsRegistryRef={actionsRegistryRef}
          />
          <GestureDispatcherMounter
            canvasRef={internalCanvasRef}
            canvasApiRef={canvasApiRef}
            tools={tools}
            enabled={enableGestureDispatcher}
            keyboard={enableKeybindings}
            selectionRef={selectionRef}
            boundsOf={internalBoundsOf}
            pickEvery={internalPickEvery}
            pickBest={internalPickBest}
            kindOfNode={kindOfNode}
            viewRef={currentViewRef}
            dispatcher={dispatcher}
            getIsVisibleForCanvas={getIsVisibleForCanvas}
            getRuleCtx={getActiveMode ? buildCurrentRuleCtx : undefined}
            onDoubleClick={onDoubleClickObserver}
          />
          <ToolKeybindingsMounter
            internalTools={internalTools}
            toolsTakeover={toolsTakeover ?? undefined}
            enableKeybindings={enableKeybindings}
            isToolEligible={isToolEligible}
          />
          {children}
        </ActionsProviderIfRoot>
      </PointerProviderIfRoot>
    </DepRegistryProviderIfRoot>
  );
}

/**
 * Mounts the gesture dispatcher inside `<ActionsProviderIfRoot>` so it can
 * read the live registry. The dispatcher is now
 * unconditionally present in every `<SceneCanvas>` tree; the
 * `DispatcherPresenceProvider` context (and `useIsDispatcherMounted` hook)
 * have been removed.
 *
 * Accepts `selectionRef`, `boundsOf`, `pickEvery`, and `viewRef` so
 * it can wire `affordanceAt` + `classifyTarget` thunks into the dispatcher.
 * These thunks convert client coords → world coords via the canvas rect + view,
 * then classify the pointer position against affordances and scene bodies.
 */
/**
 * Mounts `useKeybindings` inside `<ActionsProviderIfRoot>` so its
 * `tool.activate` / `tool.offhand` / `tool.resetToDefault` registrations
 * actually reach a registry.
 *
 * Two calls, mirroring the pair that used to live in `SceneCanvasInner`: the
 * hook snapshots the initial active tool for Escape-returns-to-default, so
 * the internal and consumer-supplied `ToolsApi` each need their own instance
 * and the hook count has to stay stable across the takeover branch.
 */
function ToolKeybindingsMounter({
  internalTools,
  toolsTakeover,
  enableKeybindings,
  isToolEligible,
}: {
  internalTools: ToolsApi;
  toolsTakeover?: ToolsApi;
  enableKeybindings: boolean;
  isToolEligible: (toolId: string) => boolean;
}) {
  useKeybindings(internalTools, {
    disable: !!toolsTakeover || !enableKeybindings,
    isToolEligible,
  });
  useKeybindings(toolsTakeover ?? internalTools, {
    disable: !toolsTakeover || !enableKeybindings,
    isToolEligible,
  });
  // Tool-owned actions (polygon.adjustSides, star.adjustPoints, …). Same
  // reason this lives here and not in the tool hooks: the hooks run above the
  // provider. Not gated on `enableKeybindings` — these back wheel and pointer
  // bindings too, not just keys.
  useToolActions(toolsTakeover ?? internalTools);
  return null;
}

function GestureDispatcherMounter({
  canvasRef,
  canvasApiRef,
  tools,
  enabled,
  keyboard,
  selectionRef,
  boundsOf,
  pickEvery,
  pickBest,
  kindOfNode,
  viewRef,
  dispatcher,
  getIsVisibleForCanvas,
  getRuleCtx,
  onDoubleClick,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Holds the full `CanvasExtensionApi` so the gesture dispatcher can call
   *  `requestRedraw()` between pointer events. */
  canvasApiRef?: React.RefObject<CanvasExtensionApi | null>;
  tools: ToolsApi;
  enabled: boolean;
  /** When false, the dispatcher leaves keyboard listeners unattached so
   *  keyboard-bound actions never fire. Wired to `enableKeybindings`. */
  keyboard: boolean;
  selectionRef?: React.RefObject<import('core/selection/useSelection').SelectionApi>;
  boundsOf?: (id: string) => import('core/viewport/fitViewToBounds').Bounds | null;
  pickEvery?: (worldX: number, worldY: number) => string[];
  /** Single topmost hit (collapses parent/child via `pickTopMostHit`), used to
   *  classify the body under the pointer. Must match the select tool's own
   *  resolution so a child node isn't misclassified by its parent's selection.
   *  Falls back to `pickEvery`'s last id when absent. */
  pickBest?: (worldX: number, worldY: number) => string | null;
  /** Resolves a hit node id to its routing-trait kind, so the body
   *  classification carries `kind` alongside `bodyTarget` and the
   *  `kind:<k>` / `kind:<k>:selected` target forms can match. Absent when
   *  the consumer opted out of routing (`routing={[]}`). */
  kindOfNode?: (id: string) => string | undefined;
  viewRef?: React.RefObject<View>;
  /** Pre-created dispatcher to pump events into. When omitted,
   *  `useGestureDispatcher` creates one internally (legacy path). */
  dispatcher?: Dispatcher;
  /** Chrome-caps visibility resolver factory. Threaded into
   *  `buildAffordanceAt` so the hit-test pipeline gates corner / rotate /
   *  anchor affordances on the same chrome ids the renderer uses. */
  getIsVisibleForCanvas?: () => (id: string) => boolean;
  /** Live RuleCtx factory. Threaded into `useGestureDispatcher` so the
   *  dispatcher's eligibility filter sees the same mode/capabilities/selection
   *  view of the world that chrome-caps does. */
  getRuleCtx?: () => RuleCtx;
  /** Fires on every synthesized double click, in world coords. Backs the
   *  `onDoubleClick` prop — see the option's doc on
   *  `UseGestureDispatcherOptions` for why it's an observer, not a binding. */
  onDoubleClick?: (world: { x: number; y: number }) => void;
}) {
  const registry = useActionsRegistry();
  const depRegistry = useDepRegistry();
  const toolsById = useMemo<ReadonlyMap<string, AnyTool>>(() => {
    const m = new Map<string, AnyTool>();
    for (const [id, tool] of Object.entries(tools.registry)) {
      m.set(id, tool);
    }
    // Ambient tools too — their bindings assemble at ambient scope, and the
    // dispatcher resolves them through this same map.
    for (const tool of tools.ambient) m.set(tool.id, tool);
    return m;
  }, [tools.registry, tools.ambient]);

  const ambientToolIds = useMemo(
    () => tools.ambient.map((t) => t.id),
    [tools.ambient],
  );

  // Stable refs for the optional thunk inputs so the thunks themselves are
  // stable function identities across renders (no need to pass them as deps).
  const boundsOfRef = useRef(boundsOf);
  boundsOfRef.current = boundsOf;
  const pickEveryRef = useRef(pickEvery);
  pickEveryRef.current = pickEvery;
  const pickBestRef = useRef(pickBest);
  pickBestRef.current = pickBest;
  const kindOfNodeRef = useRef(kindOfNode);
  kindOfNodeRef.current = kindOfNode;

  // `getAnchorState` thunk for `buildAffordanceAt`.
  //
  // Reads the live `editAnchors` dep from the registry at call time (O(1)
  // thunk call). When the dep is absent (no polygon selected / anchor-edit
  // tool inactive), returns `null` so affordanceAt skips anchor hit-testing.
  const depRegistryRef = useRef(depRegistry);
  depRegistryRef.current = depRegistry;
  const getAnchorState = useCallback((): AnchorState | null => {
    const dep = depRegistryRef.current.get('editAnchors');
    if (!dep) return null;
    return {
      editingId: dep.editingId ?? null,
      // Affordance hit-test reads world-coord anchor positions; route to
      // the dep's getEditablePath so both pose-as-polygon and data.path
      // consumers hit-test correctly.
      getPose: (id) => dep.getEditablePath(id),
    };
  }, []);

  // Build the `affordanceAt` thunk. Converts client coords → world coords
  // internally, then delegates to `buildAffordanceAt` for handle hit-testing.
  const affordanceAt = useMemo(() => {
    if (!selectionRef || !boundsOf || !viewRef) return undefined;
    return buildAffordanceAt({
      getChromeState: () => {
        const sel = selectionRef.current;
        const selection = sel?.current ?? [];
        const multiActive = selection.length >= 2;
        return {
          selection: selection as import('core/scene/types').NodeId[],
          multiActive,
          boundsOf: (id: string) => boundsOfRef.current?.(id) ?? null,
          modifiers: { alt: false, ctrl: false, meta: false, shift: false },
          get unionBounds() {
            if (!multiActive) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let any = false;
            for (const id of selection) {
              const b = boundsOfRef.current?.(id);
              if (!b) continue;
              any = true;
              if (b.x < minX) minX = b.x;
              if (b.y < minY) minY = b.y;
              if (b.x + b.width > maxX) maxX = b.x + b.width;
              if (b.y + b.height > maxY) maxY = b.y + b.height;
            }
            return any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
          },
        };
      },
      // Radii are declared in screen pixels and converted against this view.
      // The caller used to do that division itself (`8 / meanScale(scale)`),
      // in two places, with a comment explaining what breaks if you forget.
      getView: () => viewRef.current ?? { x: 0, y: 0, scale: { x: 1, y: 1 } },
      getAnchorState,
      // Chrome-caps resolver: keep the affordance hit-test in sync with what
      // the renderer is actually painting. Without this, a click on a (no
      // longer visible) resize handle position still classifies as a resize
      // handle — e.g. an anchor drag in path-edit mode resizes the path's
      // bounding box instead of moving the anchor.
      ...(getIsVisibleForCanvas ? { getIsVisible: () => getIsVisibleForCanvas() } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRef, boundsOf, viewRef, getAnchorState, getIsVisibleForCanvas]);

  // Build the `classifyTarget` thunk. Converts client coords → world coords
  // internally using the canvas rect + view, then delegates to `buildClassifyTarget`.
  const classifyTarget = useMemo(() => {
    if (!selectionRef || !pickEvery || !viewRef) return undefined;
    return buildClassifyTarget(
      () => selectionRef.current?.current ?? [],
      // Use the select tool's own topmost-hit resolution (`pickTopMostHit`,
      // which collapses parent/child) so a child body is classified by ITS
      // OWN selection — not its parent's. The naive `pickEvery`-last fallback
      // assumes a bottom-first hit order, which is wrong for adapters whose
      // `pickEvery` returns topmost-first (it would resolve the parent).
      (wx: number, wy: number) => {
        if (pickBestRef.current) return pickBestRef.current(wx, wy);
        const ids = pickEveryRef.current?.(wx, wy) ?? [];
        return ids.length > 0 ? ids[ids.length - 1] : null;
      },
      // Node kind comes from the routing trait — the same classifier that
      // names `Hit.kind` — so `target: 'kind:text'` on a binding speaks the
      // vocabulary the consumer already declared in `routing`, rather than a
      // second one invented for bindings. `routing={[]}` opts out and leaves
      // every `kind:` target unmatchable.
      (id: string) => kindOfNodeRef.current?.(id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRef, pickEvery, viewRef]);

  // Wrap `affordanceAt` and `classifyTarget` to convert client → world coords
  // before delegating. The canvas rect is read on every call (not cached) so
  // it stays correct after layout changes.
  const clientToWorld = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    const view = viewRef?.current;
    if (!canvas || !view) {
      recordCoordTrace({ ts: Date.now(), clientX, clientY, rect: null, view: null, world: { x: clientX, y: clientY }, fallback: true });
      return { x: clientX, y: clientY };
    }
    const rect = canvas.getBoundingClientRect();
    const [wx, wy] = clientToWorldHelper(clientX, clientY, rect, view);
    const world = { x: wx, y: wy };
    recordCoordTrace({
      ts: Date.now(), clientX, clientY,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      view: { x: view.x, y: view.y, scaleX: view.scale.x, scaleY: view.scale.y },
      world, fallback: false,
    });
    return world;
  }, [canvasRef, viewRef]);

  const wrappedAffordanceAt = useMemo(() => {
    // Note this is NOT gated on `affordanceAt` being built: registered layers
    // produce affordances of their own, and a consumer with no selection
    // chrome (a canvas that is nothing but a HUD, say) still needs those.
    return (screenPoint: { x: number; y: number }) => {
      const worldPoint = clientToWorld(screenPoint.x, screenPoint.y);
      // Registered layers first: they draw on top of the kit's own chrome, so
      // they get first refusal on the point. A hit becomes an `AffordanceHit`
      // whose kind names the layer, carrying whatever the layer's hit-test
      // resolved — which is how `@weasel-js/hud` routes a press on one of its
      // widgets to its own action instead of the active tool.
      const extra = canvasApiRef?.current?.hitTestExtras?.(worldPoint.x, worldPoint.y);
      if (extra) {
        return {
          kind: `layer:${extra.layerId}`,
          ...(extra.binding.initialScratch !== undefined
            ? { payload: extra.binding.initialScratch }
            : {}),
        };
      }
      return affordanceAt ? affordanceAt(worldPoint) : null;
    };
  }, [affordanceAt, clientToWorld, canvasApiRef]);

  const wrappedClassifyTarget = useMemo(() => {
    if (!classifyTarget) return undefined;
    return (screenPoint: { x: number; y: number }) => {
      const worldPoint = clientToWorld(screenPoint.x, screenPoint.y);
      return classifyTarget(worldPoint);
    };
  }, [classifyTarget, clientToWorld]);

  // Stable callback that asks the canvas to redraw. Reads via ref so the
  // identity stays stable while the underlying API binds after mount.
  const requestRedraw = useCallback(() => {
    canvasApiRef?.current?.requestRedraw?.();
  }, [canvasApiRef]);

  // Hover cursors live in `useGestureDispatcher`'s hover-cursor pump:
  // affordance hits carry `AffordanceHit.cursor` (set by `buildAffordanceAt`),
  // and everything else is predicted via `Dispatcher.resolveOnly` +
  // `Action.cursor`. Nothing SceneCanvas-specific remains here.
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById,
    ambientToolIds,
    enabled,
    keyboard,
    affordanceAt: wrappedAffordanceAt,
    classifyTarget: wrappedClassifyTarget,
    dispatcher,
    clientToWorld,
    requestRedraw,
    getRuleCtx,
    onDoubleClick,
  });
  return null;
}

/**
 * Registers the kit's default action set into whatever `<ActionsProvider>`
 * is in scope. Lives inside `<ActionsProviderIfRoot>` so it sees both
 * parent-supplied registries and SceneCanvas's auto-mounted one.
 *
 * For `delete`, `duplicate`, `group`, and `ungroup` the descriptor's
 * invoker is a stub (those deps aren't in `DepSchema` yet — Phase 4 T8
 * TODO). This component registers legacy bridge overrides for them so the
 * consumer-facing `run` path is functional. The overrides land after the
 * descriptor registrations (last-writer-wins) and use the same id, so the
 * dispatcher and keybinding system see a real `run` body.
 */
function StandardActionsRegistrar({
  selection,
  scene,
  adapter,
  actions,
  currentViewRef,
  onViewChange,
  resizeOptions,
  geometryProjection,
  dispatcher,
  getActionRef,
  pickEvery,
  viewportPanEnabled,
  viewportZoom,
  viewportRecenter,
  editAnchorsExternalState,
  anchorEditingAllowed,
  layouts,
  insertNodeFactories,
  snapPoint,
  canvasRef,
  ingestionResolveSrc,
  ingestionSvg,
  ingestionClipboard,
  actionsRegistryRef,
}: {
  selection: SelectionApi;
  scene: Scene<unknown, string, unknown>;
  adapter: BridgeAdapter;
  actionDefaults?: SceneCanvasProps<unknown, string, unknown>['actionDefaults'];
  actions?: ActionsProp;
  currentViewRef: React.RefObject<View>;
  onViewChange: (v: View) => void;
  /** Forwarded from `selectTool.resize` — wires the `resizePolicy` dep
   *  consumed by the dispatcher-path `resizeAction`. The legacy
   *  `useResizeTool` consumes the same options separately (both paths run
   *  in parallel during the dispatcher migration). */
  resizeOptions?: UseResizeOptions<unknown>;
  /** Forwarded from `SceneCanvasProps.geometryProjection` — wires the
   *  `geometryProjection` dep consumed by pose-transform actions (move,
   *  resize, nudge, flip). Conditionally mounted so absent → dep undefined. */
  geometryProjection?: GeometryProjection;
  /** Forwarded so `cancelGestureAction` and other actions that need to
   *  abort in-flight handles can read the dispatcher's control surface. */
  dispatcher: Dispatcher;
  /** Ref populated with a live action-lookup function so the dispatcher's
   *  `getAction` closure can resolve action ids after the registry is
   *  mounted. Set on first render; cleared on unmount. */
  getActionRef: React.MutableRefObject<((id: string) => Action | undefined) | null>;
  /** World-space picker forwarded so the `nodeAtPoint` dep source can
   *  reuse the same hit-test plumbing the tool dispatcher uses. */
  pickEvery: (worldX: number, worldY: number) => string[];
  /** Resolved `viewport.pan` flag — default true, false to disable. */
  viewportPanEnabled: boolean;
  /** Resolved `viewport.zoom` setting — `true` (default Cmd+wheel zoom),
   *  `false` (disabled), or a {@link ViewportZoomOptions} config. */
  viewportZoom: boolean | ViewportZoomOptions;
  /** Optional recenter callback. When supplied, wires through to the
   *  `view` dep so `viewport.zoom` reset (Cmd-0) calls it instead of
   *  snapping to identity. */
  viewportRecenter?: () => void;
  /** Lifted edit-mode state so the `pathEditingOverlay` chrome (rendered
   *  outside this subtree) can read the same `editingId` the dep does. */
  editAnchorsExternalState: import('./deps/editAnchors').EditAnchorsStateRef;
  /** Present only when a mode registry is wired (`getActiveMode`); see
   *  `EditAnchorsDepOptions.anchorEditingAllowed` for why absence — not a
   *  predicate over an empty capability set — is the safe default. */
  anchorEditingAllowed?: () => boolean;
  /** Forwarded from `SceneCanvasProps` so the `layout` dep source can wire
   *  the per-container layout strategy lookup consumed by `moveAction`. */
  layouts?: SceneCanvasProps<unknown, string, unknown>['layouts'];
  /** Forwarded from `SceneCanvasProps` so `useInsertDepSource` can wire the
   *  consumer's per-kind node factories into the `insert` dep. */
  insertNodeFactories?: Record<string, InsertNodeFactory>;
  /** Forwarded from `SceneCanvasProps.toolOptions.snapPoint` so the `snap`
   *  dep source can expose grid snapping to `insertAction`. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
  /** The canvas element ref, so `useIngestionDepSource` can compute the
   *  visible world rect from the client rect + current view. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Forwarded from `SceneCanvasProps.ingestion.resolveSrc` — consumer
   *  file→src override for the kit image handler. */
  ingestionResolveSrc?: (file: File) => Promise<string>;
  /** Forwarded from `SceneCanvasProps.ingestion.svg` — kit SVG-handler
   *  options (`unpack`). */
  ingestionSvg?: SvgIngestOptions;
  /** Clipboard-paste ctx (this canvas's adapter + the consumer's reviver)
   *  for the kit weasel-JSON handler — built in SceneCanvasInner where the
   *  typed adapter is in scope; absent when disabled. */
  ingestionClipboard?: ClipboardIngestCtx;
  /** Populated with the live registry so `CanvasExtensionApi.ingest`
   *  (assembled in SceneCanvasInner, OUTSIDE the actions provider) can call
   *  `registry.trigger('ingest', …)`. Cleared on unmount. */
  actionsRegistryRef: React.MutableRefObject<ActionsRegistry | null>;
}) {
  const registry = useActionsRegistry();

  // Stash the registry for SceneCanvasInner's imperative `ingest` handle.
  useEffect(() => {
    actionsRegistryRef.current = registry;
    return () => { actionsRegistryRef.current = null; };
  }, [registry, actionsRegistryRef]);

  // Wire the dispatcher into the registry so registry.begin() can delegate
  // to dispatcher.beginUiOngoing() for UI-driven ongoing actions (color,
  // opacity). Detach on unmount so the registry doesn't hold a stale ref.
  useEffect(() => {
    if (!registry) return;
    registry.setDispatcher(dispatcher);
    return () => registry.setDispatcher(null);
  }, [registry, dispatcher]);

  // Wire the dep registry the same way: when the ActionsProvider in scope
  // is a consumer root mounted ABOVE DepRegistryProviderIfRoot, its own
  // context read finds no dep registry — trigger()/begin() would build an
  // empty deps bag and dep-guarded invokers (e.g. ingest) bail silently.
  const wiredDepRegistry = useDepRegistry();
  useEffect(() => {
    if (!registry) return;
    registry.setDepRegistry(wiredDepRegistry);
    return () => registry.setDepRegistry(null);
  }, [registry, wiredDepRegistry]);

  // Populate the action-lookup ref so the dispatcher's getAction closure
  // can resolve action ids once the registry is in scope.
  useEffect(() => {
    if (!registry) return;
    getActionRef.current = (id: string) => registry.list().find((a) => a.id === id);
    return () => { getActionRef.current = null; };
  }, [registry, getActionRef]);

  // Build the ViewApi (stable identity, refreshed closures) and hand it to
  // useStandardActions (which publishes the `view` dep along with selection,
  // scene, history, pointer, activeTool). `hostSize` reads the live canvas
  // element so keyboard zoom (Cmd+=/-) can anchor at the visible center.
  const view = useViewDepSource(currentViewRef, onViewChange, viewportRecenter, () => {
    const el = canvasRef.current;
    return el ? { width: el.clientWidth, height: el.clientHeight } : null;
  });
  // Scene owns its own undo/redo stacks via `useScene`. `undoAction` /
  // `redoAction` only call `history.undo()` / `history.redo()`, so the scene
  // satisfies the runtime contract — cast through `unknown` since `Scene`'s
  // shape is wider than the formal `History` interface (entries / goto /
  // version / subscribe live on different methods).
  const sceneAsHistory = scene as unknown as Parameters<typeof useStandardActions>[0]['history'];
  useStandardActions({ selection, scene, view, history: sceneAsHistory });

  // viewport.pan / viewport.zoom are SceneCanvas-coupled (need the `view` dep
  // published just above), so they're registered here rather than in
  // KIT_STANDARD_DESCRIPTORS. Both default ON; consumer opts out via
  // `viewport={{ pan: false }}` / `viewport={{ zoom: false }}`.
  useViewportActions({ pan: viewportPanEnabled, zoom: viewportZoom });

  // Per-dep wiring modules under `src/canvas/deps/`. See each file for the
  // dep's contract and trade-offs.
  useAreaSelectDepSource(scene, selection);
  useNodeAtPointDepSource(pickEvery);
  useLayoutDepSource(layouts);
  useInsertDepSource(scene, adapter, insertNodeFactories);
  useSnapDepSource(snapPoint);
  useIngestionDepSource(canvasRef, () => currentViewRef.current, ingestionResolveSrc, ingestionSvg, ingestionClipboard);
  useLassoSelectDepSource(scene, selection);
  useTextEditDepSource(scene);
  useEditAnchorsDepSource(scene, selection, adapter, editAnchorsExternalState, {
    anchorEditingAllowed,
  });
  useDispatcherDepSource(dispatcher);

  useActionsPropResolver(actions);

  // Gate the `resizePolicy` dep registration on the consumer having
  // passed `selectTool.resize`. When absent, consumers wire it via a child
  // component (see PointSnapDemo / GroupsDemo). Registering empty defaults
  // here would race with child-component registrations — React runs child
  // effects before parent effects, so the parent's empty default would
  // overwrite the child's real value. The conditional mount avoids that.
  //
  // Same pattern for `geometryProjection`: only mount when the consumer
  // passed the prop so absent → dep undefined → actions stay pose-only.
  return (
    <>
      {resizeOptions ? <ResizePolicyRegistrar options={resizeOptions} /> : null}
      {geometryProjection ? <GeometryProjectionRegistrar projection={geometryProjection} /> : null}
    </>
  );
}

/** Subcomponent so we can conditionally render (and thus conditionally
 *  call) `useResizePolicy`. See parent's comment for why this
 *  must be gated rather than always-on. */
function ResizePolicyRegistrar({
  options,
}: {
  options: UseResizeOptions<unknown>;
}) {
  useResizePolicy<unknown>({
    constraints: options.behaviors as never[] | undefined,
    pointSnap: options.pointSnapBehaviors as never[] | undefined,
    expandIds: options.expandIds,
    projection: options.geometry,
  });
  return null;
}

/** Subcomponent so we can conditionally render (and thus conditionally
 *  call) `useGeometryProjection`. Mirrors `ResizePolicyRegistrar` — the
 *  conditional mount ensures the dep is registered only when the consumer
 *  supplies a projection, so absent → dep undefined → actions stay pose-only. */
function GeometryProjectionRegistrar({
  projection,
}: {
  projection: GeometryProjection;
}) {
  useGeometryProjection(projection);
  return null;
}

const SceneCanvasInnerForwardRef = forwardRef(SceneCanvasInner);

// Wrapper that lifts `<ActiveToolContextProvider>` above `SceneCanvasInner`
// — but only when none is already in scope. The `IfRoot` variant is critical:
// a consumer wrapping in `<WeaselProvider>` (or its own
// `<ActiveToolContextProvider>`) pushes the active tool via `useTools(...)` to
// the OUTER context; if SceneCanvas unconditionally mounted a fresh inner
// provider here, its dispatcher would read the inner (stale 'select') context
// instead of the outer (live 'hand'/'select'/etc.) one.
function SceneCanvasWrapper<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return (
    <ActiveToolContextProviderIfRoot>
      <SceneCanvasInnerForwardRef {...(props as SceneCanvasProps<unknown, string, unknown>)} ref={ref} />
    </ActiveToolContextProviderIfRoot>
  );
}

export const SceneCanvas = forwardRef(SceneCanvasWrapper) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<SceneCanvasApi> },
) => ReturnType<typeof SceneCanvasInner>;
