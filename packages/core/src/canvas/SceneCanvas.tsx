/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive.
 *
 * Synthesizes a `MoveAdapter & ResizeAdapter & RotateAdapter & AreaSelectAdapter`
 * from the passed `scene` (via `sceneToAdapter`) and an internal `useTools`.
 * Bare, it only renders: behavior comes from the `features` presets
 * (`canvas/SceneCanvas/features.ts`), each of which registers its own actions,
 * tools, ambient bindings and chrome.
 *
 * If a consumer needs custom tools (e.g. `select` + `insert`), they can pass
 * `tools={useTools(...)}` directly and SceneCanvas forwards it as-is — the
 * internal tool registry is ignored in that case.
 *
 * Cascade: `Scene` stores absolute poses, so dragging a container has to
 * translate its descendants in the live overlay and again at commit. The move
 * action walks `scene.childrenOf` for both — see `cascadeIds` in
 * `interactions/actions/defaults/move.ts`.
 */
import { forwardRef, useCallback, useEffect, useInsertionEffect, useMemo, useRef, useState } from 'react';
import { dwarn } from '../debug';
import type React from 'react';
import type { ReactNode } from 'react';
import type { ActionsProp } from '@weasel-js/routing';
import type { Action } from '@weasel-js/routing';
import { useStandardActions } from 'interactions/actions/useStandardActions';
import type { DrawCommand, ShaderProgramHandle } from '../renderer';
import { defaultDrawOne, defaultPaintBounds, paintBoundsFor } from './defaultDrawOne';
import type { FillStyle } from '@weasel-js/paint';
import { useLateContentRedraw } from './useLateContentRedraw';
import { Canvas } from './Canvas';
import type { CanvasProps, LayersMap, SceneSlotConfig, SelectionOverlaySlotConfig } from './Canvas';
import { wireSceneSlotToScene, composeAlphaFor } from './sceneSlotWiring';
import type { CanvasExtensionApi, CanvasViewHandle, SceneCanvasApi } from './canvasExtension';
import type { Animator } from '../animation/types';
import { useAnimator } from '../animation/useAnimator';
import { useViewAnimationOn } from 'core/viewport/useViewAnimation';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import { useSceneAdapter, type SceneToAdapterOptions } from './sceneAdapter';
import type { LayoutDropTargetMode, ReflowTransition } from '../layout/types';
import { useDecayLoop, type PanBounds } from 'core/viewport/useDecayLoop';
import type { WheelPanOptions } from 'interactions/actions/defaults/viewportWheelPan';
import { normalizeView, viewZoom, type View } from 'core/viewport/view';
import type { Node, Scene, SerializedScene } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import { sceneFromJSON } from 'core/scene/scene';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { usePublishSelection } from 'features/selection/SelectionContext';
import type { Bounds } from 'tools/builtin/select';
import { useTools } from '../tools/overlayBinding';
import { type ToolsApi } from '../tools/overlayBinding';
import { useKeybindings } from 'tools/useKeybindings';
import type { AnyTool, Contribution } from '../tools/overlayBinding';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import { dlog } from '../debug/flag';
import type { DebugConfig } from '../debug/types';
import { DeviceProfileProvider, useDeviceProfile } from '../core/device/useDeviceProfile';
import { ViewRegistryProvider, useOptionalViewRegistry } from './viewRegistry';
import { createSceneLayerGate, type ViewLayerPaint } from './sceneLayerPaint';
import { ViewInputsProvider, type SurfaceViewInputs, type ViewRuleInputs } from './viewInputs';
import { CanvasView, type CanvasViewProps } from './CanvasView';
import type { DeviceProfile } from '../core/device/types';
import { HANDLE_BASE_PX, targetSizesPx } from '../core/device/targets';
import { InputScope, type Yoke } from '@weasel-js/routing/react';
import { useContributionRoles, contributionEntries } from './SceneCanvas/useContributionRoles';
import type { SurfaceContribution } from './surfaceContribution';
import { useDepSource } from '@weasel-js/routing/react';
import { usePointerContext } from 'features/pointer/PointerContext';
import { PointerProviderIfRoot, PointerPublisher } from './SceneCanvas/PointerProviderIfRoot';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import { selectionMoveContribution, selectionTransformContribution } from 'tools/builtin/select';
import {
  resolveFeatures,
  featureActionIds,
  type Feature,
} from './SceneCanvas/features';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
export type { Feature } from './SceneCanvas/features';
export { SCENE_CANVAS_FEATURES } from './SceneCanvas/features';
import { useHandTool } from 'tools/builtin/hand';
import { usePreviewGhostLayer } from './SceneCanvas/usePreviewGhostLayer';
import { useDispatcherOverlayLayer } from './SceneCanvas/useDispatcherOverlayLayer';
import { createGestureSource, createDispatcherPreviewSources } from './SceneCanvas/dispatcherGestureBounds';
import type { PickView } from './SceneCanvas/useSceneSelectTool';
import type { GesturePreviewSource } from './gestureBounds';
import { createPenPreviewLayer } from 'features/paths/penPreviewLayer';
import { createPathEditingOverlayLayer } from 'features/paths/pathEditingOverlayLayer';
import { pathFromPlane } from './planeClips';
import { rectFromPlane } from 'core/viewport/parallax';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import type { PenScratch } from 'tools/builtin/pen';
import type { Tool } from '../tools/overlayBinding';
import { useBuiltinShapeTools, type BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import type { BuiltinShapeToolId } from 'core/shapeKinds';
export type { BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
import {
  useViewDepSource,
  useAreaSelectDepSource,
  useNodeAtPointDepSource,
  useDebugDepSource,
  useInsertDepSource,
  useSliceDepSource,
  useSnapDepSource,
  useLassoSelectDepSource,
  useTextEditDepSource,
  useEditAnchorsDepSource,
  useDispatcherDepSource,
  usePoseDescriptorDepSource,
  usePoseCompositionDepSource,
  useResizePolicy,
  resizePolicyOptions,
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
import type { PolygonPath } from '@weasel-js/geom';
import { useActionsPropResolver } from './SceneCanvas/useActionsPropResolver';
import { useViewportActions } from './SceneCanvas/useViewportActions';
import type { ViewportZoomAnimateOptions, ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';
import type { PinchZoomOptions } from 'interactions/actions/defaults/pinchZoom';
import { useGestureDispatcher } from '@weasel-js/routing/react';
import { createDispatcher, type Dispatcher } from '@weasel-js/routing';
import type { ActionsRegistry } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';
import { buildAffordanceAt, buildClassifyTarget, anchorStateFrom, chromeAffordances } from './affordanceAt';
import type { Affordance } from 'affordances/types';
import { EMPTY_CHROME_STATE } from 'core/selection/chromeState';
import { clientToWorld as clientToWorldHelper } from 'core/viewport/clientToWorld';
import type { Op } from 'core/ops/types';
import { useDepRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { createNodeRouting, type NodeRoutingEntry } from '../core/scene/NodeRouting';
import { inferredNodeRouting } from './SceneCanvas/defaultNodeRouting';
import { installTestHookIfRequested } from '../test-hook/install';
import type { WeaselTestHook } from '../test-hook/types';
import {
  createSelectionOverlayLayer,
  rotationBadgeOf,
} from 'features/selection/overlay';
import { getActiveModeFor, type ModeRegistry } from '@weasel-js/modes';
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
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
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
 *  hit-test radius, at `targetScale = 1`. Used by the SceneCanvas defaults;
 *  consumers override via `selectTool.handleHitRadius` or
 *  `layers.selectionOverlay.handles.size`.
 *
 *  Deliberately unscaled: consumers reading this constant keep getting the
 *  number they always got. Kit-internal use sites multiply by
 *  `DeviceProfile.targetScale`. */
export const DEFAULT_HANDLE_SIZE = HANDLE_BASE_PX;

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

/** `<SceneCanvas layers>`: a {@link LayersMap} whose scene slot may be partial,
 *  since the defaults fill in whatever it leaves out. */
export type SceneCanvasLayers<TNode extends { id: string }, TPose> = LayersMap<
  TNode,
  TPose,
  Partial<SceneSlotConfig<TNode, TPose>>
>;

/** Deep-merge user-supplied `layers` with kit defaults. Slots the user
 *  doesn't mention get filled with defaults; slots explicitly set to
 *  `null` are dropped (the existing "disable this slot" convention).
 *  Partial slot configs (e.g. `{ scene: { drawOne: customFn } }`) are
 *  shallow-spread on top of the default slot config.
 *
 *  `targetScale` comes from the resolved {@link DeviceProfile}. It is a
 *  parameter rather than a read because this function is module-scope and
 *  the profile is a hook value; the caller inside the component passes it. */
export function mergeLayersWithDefaults<TData, TLayer extends string, TPose>(
  user: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined,
  targetScale = 1,
): LayersMap<Node<TData, TLayer, TPose>, TPose> {
  const defaults = {
    scene: {
      drawOne: defaultDrawOne as (
        node: Node<TData, TLayer, TPose>,
        pose: TPose,
      ) => DrawCommand[],
      paintBounds: defaultPaintBounds<TData, TLayer, TPose>,
    },
    selectionOverlay: { handles: { size: targetSizesPx(targetScale).handle } },
  };

  if (!user) return defaults as LayersMap<Node<TData, TLayer, TPose>, TPose>;

  // Start from a shallow copy of the user map so unknown slots pass through.
  const result = { ...user } as LayersMap<Node<TData, TLayer, TPose>, TPose>;

  if (!('scene' in user)) {
    result.scene = defaults.scene;
  } else if (user.scene === null) {
    result.scene = null;
  } else {
    const scene = { ...defaults.scene, ...user.scene };
    result.scene = user.scene && 'paintBounds' in user.scene
      ? scene
      : { ...scene, paintBounds: paintBoundsFor<TData, TLayer, TPose>(scene.drawOne) };
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
 *  is supplied, via `defaultTools`. */
export type BuiltinToolId = 'select' | 'hand' | BuiltinShapeToolId;

/** Built-in tool ids that aren't shape tools — the ones with no entry in
 *  the `core/shapeKinds` table. */
const NON_SHAPE_BUILTIN_TOOLS: readonly Exclude<BuiltinToolId, BuiltinShapeToolId>[] = ['select', 'hand'];

/** Every built-in tool id, shape tools included. */
export const BUILTIN_TOOL_IDS: readonly BuiltinToolId[] = [...NON_SHAPE_BUILTIN_TOOLS, ...KIT_SHAPE_KINDS];

/** Minimal hit descriptor passed to `onDoubleClick`. Contains the fields
 *  modality dispatch needs; extends as the kit's `Hit` type evolves. */
export interface SceneCanvasHit {
  id: string;
  kind: string;
}

/** `<SceneCanvas debug>` minus the flag only SceneCanvas reads. */
function canvasDebug(debug: (DebugConfig & { slops?: boolean }) | false): DebugConfig | false {
  if (debug === false) return false;
  const { slops: _slops, ...rest } = debug;
  return rest;
}

/** Props for `<SceneCanvas>`. A scene is the only thing it needs. With nothing
 *  else it renders that scene and keeps a selection no input sets; `features`
 *  turns behavior on by preset, and the rest configures what those turn on. */
export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<
    CanvasProps<Node<TData, TLayer, TPose>, TPose>,
    | 'adapter'
    | 'moveOptions' | 'resizeOptions' | 'rotateOptions'
    | 'snap' | 'pickEvery' | 'boundsOf' | 'handleHitRadius'
    | 'selection' | 'selectionOptions' | 'tools'
    | 'layers'          // stripped so we can re-add as optional below
    | 'onBackgroundClick' // SceneCanvas synthesizes this; not a consumer prop
    | 'getIsVisible'    // SceneCanvas synthesizes this from chromeVisibility
    | 'contentVersion'  // SceneCanvas wires this to the scene's own version
    | 'layerVisibility' | 'layerOrder' // re-declared below: they gate picking here too
    | 'debug'           // re-declared below with SceneCanvas's own `slops`
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
     *  (a scene slot that paints `node.data.fill` rects + a default
     *  selection overlay). A partial scene or selection-overlay config is
     *  spread over that slot's defaults; pass `slot: null` to suppress a
     *  default explicitly. */
    layers?: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose>;

    /** Layout strategies keyed by container node id (or a resolver). Forwarded
     *  to `sceneToAdapter` so `useMove`'s layout pass runs on configured
     *  containers (reflow on enter, reparent + reflow on commit). */
    layouts?: SceneToAdapterOptions<TData, TLayer, TPose>['layouts'];

    /** Which layout container a drag lands in when several contain the drop
     *  point — the innermost (default), the topmost in paint order, or only
     *  containers whose strategy declares a `dropRegion`. Decides both the
     *  drag-time reflow preview and the commit. */
    layoutDropTarget?: LayoutDropTargetMode;

    /** Carries the siblings a drag's layout reflow displaces to their slots
     *  over time instead of snapping them — `useAnimatedReflow` builds one.
     *  Absent or `null`, they snap. */
    reflowTransition?: ReflowTransition<TPose> | null;

    /** How a child's stored pose folds into its parent's frame. Omit for the
     *  absolute-pose model, where a container groups its children but imposes
     *  no transform. Pass `RIGID_POSE_COMPOSITION` to make a container's pose
     *  a frame, so rotating it rotates its contents and moving it carries them
     *  without touching their poses. */
    poseComposition?: SceneToAdapterOptions<TData, TLayer, TPose>['poseComposition'];

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

    /** How to read and rewrite this scene's poses. Every built-in action,
     *  the selection chrome and picking read it. Default `AUTO_POSE_DESCRIPTOR`
     *  (rect poses and `Path` poses). */
    poseDescriptor?: PoseDescriptor<TPose>;

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

    // --- Selection options. `pickBest` and `handleHitRadius` configure the
    //     internal select tool, and are ignored under a `tools` takeover;
    //     `move`, `snap`, `resize` and `rotate` configure the `move` and
    //     `transform` presets, and apply either way. ---
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
     * `false` stops the canvas writing the selection: no click, marquee,
     * lasso, action or tool, and no op committed through the adapter it hands
     * its tools. The consumer's own `SelectionApi` — the `selection` prop, or
     * `useSelection({ scene })` — still writes, and the canvas draws what it
     * holds. Undo and redo still restore the selection each history entry
     * recorded. Default `true`.
     *
     * Click policy (whether shift-click extends) is the selection's `mode`:
     * `useSelection({ mode: 'multi' })`, or `selectionOptions={{ mode: 'multi' }}`
     * for the selection the canvas builds itself.
     */
    selectable?: boolean;

    /**
     * Behavior presets to turn on, composable in any combination. A canvas
     * with none renders its scene and keeps a selection (the `selection` API
     * works) that no input sets: no tools, no standard actions or their keys,
     * no clipboard, no drop or paste, and no selection chrome. The dispatcher
     * is still mounted, so bindings a consumer adds work.
     *
     * - `view` — wheel pan and zoom, pinch, the zoom keys, and the hand tool
     *   (H, or hold Space). Passing `viewport` implies it.
     * - `pick` — the select tool, as the initial active tool and Escape's
     *   return target: click to pick, drag on empty to marquee, click on empty
     *   to clear; and the selection outline.
     * - `move` — drag a body to move it, Alt-drag to clone it. Ambient, so it
     *   runs under any tool that does not claim the drag.
     * - `transform` — resize and rotation handles, drawn and bound.
     * - `edit` — undo/redo, delete, duplicate, group/ungroup, nudge,
     *   select-all, Escape, cancel-gesture, cut/copy/paste, fill and stroke,
     *   and their keys.
     * - `arrange` — align, distribute, reorder, flip.
     * - `paths` — pathfinder operations, path-edit entry and anchor editing.
     * - `ingest` — dropped and pasted content (Cmd/Ctrl+V arrives as a paste).
     * - `draw` — all of the above.
     *
     * Tools add the actions they bind — a shape tool brings `insert` — so
     * `defaultTools` composes with any preset. `actions` then adds, overrides
     * or removes on top of what the presets registered.
     */
    features?: readonly Feature[];

    // --- Tools: extend, override, or take over ---
    /** Extra tools or overrides keyed by id, or a full `ToolsApi` takeover.
     *
     *  **Patch form** (`Record<string, AnyTool | true | false>`): merged
     *  into the built-in registry on top of whatever `defaultTools` and
     *  `features` already selected.
     *    - `true` pulls in the built-in for this id (`'pen'`, `'lasso'`,
     *      `'hand'`, …), the same as listing it in `defaultTools`. Unknown
     *      built-in ids warn in dev and are ignored.
     *    - `AnyTool` adds a new id or replaces an existing one
     *      (dev-only warning on replace).
     *    - `false` omits a bundled tool entirely.
     *  Auto-wiring (keybindings, dispatcher, action registry) still runs.
     *
     *  **Takeover form** (`ToolsApi`): the internal registry is bypassed and
     *  this `tools` value is forwarded to Canvas as-is — the consumer owns
     *  active-slot management, and `pick`'s select tool is theirs to supply.
     *  Every other preset still applies. Keybindings are still auto-wired
     *  against the supplied registry; pass `enableKeybindings={false}` to opt
     *  out. */
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
     * Built-in tools SceneCanvas registers in its internal `useTools`, on top
     * of the ones presets bring (`select` from `pick`, `hand` from `view`).
     * Default: none. Each tool also registers the kit actions it binds, so
     * `['rect']` brings `insert`. Ignored when the consumer supplies their own
     * `tools` prop.
     */
    defaultTools?: readonly BuiltinToolId[];

    /** Per-tool option overrides for the built-in shape/lasso/clone tools.
     *  Each entry is a narrow subset of the underlying hook's options
     *  surface — `lasso.mode`, `clone.cloneSelection`, etc. */
    toolOptions?: BuiltinToolOptions;

    /** Initial active-slot tool id. Default: `'select'` when it is
     *  registered, otherwise none — a canvas can run on ambient bindings
     *  alone. Must be one of the registered tools. The lasso demo starts with
     *  `initialActiveTool="lasso"`. Ignored when the consumer supplies their
     *  own `tools` prop. */
    initialActiveTool?: string;

    /** Always-on entries to register alongside the internal tools — every one
     *  a `SurfaceContribution`, whose views, deps, overlay, bindings, actions
     *  and `attach` all install from this one list, and uninstall when the
     *  entry leaves it. A tool is a contribution too, so one can go here. If
     *  you supply your own `tools` prop, this is ignored — wire `ambient`
     *  through your own `useTools` call instead. */
    ambient?: readonly SurfaceContribution[];

    /** Configures the `view` preset, and implies it: passing this turns
     *  `view` on.
     *
     *  - `inertia` and `animatedZoom` are opt-in: pass `true` for defaults or
     *    an object to tune. Omitted means off.
     *  - `pan` (wheel pan), `zoom` (Cmd+wheel + Cmd+=/-/0) and `pinchZoom`
     *    (two-finger pinch) are on under `view`; pass `false` to disable one.
     *    All three are wired by registering the kit's `viewport.*` action
     *    descriptors with the actions registry — disabling via the `actions`
     *    prop (`actions: { 'viewport.wheelPan': null }`) also works and runs
     *    after this.
     *
     *  Without `view`, none of them are wired. */
    viewport?: {
      inertia?: boolean | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce' | 'spring'; bounds?: PanBounds };
      /** Two-finger pinch zoom. `true`/omitted = on with the kit's 0.1–8
       *  clamp; `false` disables. An object sets the scale clamp. */
      pinchZoom?: boolean | PinchZoomOptions;
      /** Glide Cmd+=/-/0 instead of jumping. `true` uses the kit defaults
       *  (250 ms, ease-out-cubic); a {@link ViewportZoomAnimateOptions} tunes
       *  duration, easing, interpolator and the reset-branch duration. Wheel
       *  and pinch are unaffected — their input already samples every frame. */
      animatedZoom?: boolean | ViewportZoomAnimateOptions;
      /** Wheel pan. `true`/omitted = on; `false` disables; an object locks the
       *  axis (`{ axis: 'x' }`) so a single-axis viewport needs no commit clamp. */
      pan?: boolean | WheelPanOptions;
      /** Wheel/keyboard zoom. `true`/omitted = default Cmd+wheel zoom with the
       *  kit's 0.1–8 clamp; `false` disables. Pass a {@link ViewportZoomOptions}
       *  object to bind zoom to plain wheel (`wheel: 'plain'`, pair with
       *  `pan: false`) and/or set `min`/`max` scale clamps. */
      zoom?: boolean | ViewportZoomOptions;
      /** Callback invoked by Cmd-0 (`viewport.zoom` action's `reset` branch).
       *  When supplied, replaces the default reset-to-identity behavior —
       *  consumers typically refit the document page into the workspace via
       *  `fitViewToBounds`. Return the target `View` to let the kit animate
       *  there when `animatedZoom` is on; return nothing to dispatch it
       *  yourself, which is what a controlled canvas does. */
      recenter?: () => View | void;
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
     * every active animation frame, and paints `animator.colorOverrides`
     * onto the scene's nodes: the kit's path and shape painters apply them,
     * and a custom `drawOne` receives them as `ctx.vertexColors`. Scene
     * mutations trigger repaints automatically, but `colorOverrides` writes
     * do not.
     *
     * Omit when no animation channel touches the render pipeline; idle
     * frames don't cost anything if no animations are active (the animator's
     * subscriber list stays quiet).
     */
    animator?: Animator;

    /**
     * Extra views on this canvas: each is a camera over a rect of the same
     * surface, drawn through one GL context, with input routed to it. The flat
     * `view` / `onViewChange` props above stay the canvas's own camera — view
     * zero — and are unaffected by anything declared here.
     *
     * Order is paint and hit order, low to high. Each entry is a
     * `<CanvasView>`; mounting one as a child is the same declaration, and
     * children land after every entry here.
     */
    views?: readonly CanvasViewProps[];

    /**
     * Children rendered alongside the canvas, inside its input scope (e.g.
     * shortcuts overlays, probes).
     */
    children?: ReactNode;

    /**
     * A yoke to join, from `useYoke()`: canvases on one yoke share the
     * active tool, the gesture in flight and history. Omitted, this canvas
     * keeps its own.
     */
    yoke?: Yoke;

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
     * The app's mode registry (`createModeRegistry` in `@weasel-js/modes`).
     * The canvas reads the active mode from it to gate chrome, tool
     * activation and the dispatcher's eligibility filter, repaints when it
     * switches, and hands every registered mode to the dev-time route-conflict
     * check. Omitted, the canvas behaves as the kit's normal mode and nothing
     * revokes anchor editing.
     */
    modes?: ModeRegistry;

    /**
     * Override detected device facts. Merged over what `matchMedia` reports;
     * `targetScale` is re-derived from the merged `coarsePointer` unless you
     * override it explicitly.
     *
     * Reach for this in three cases: tests that need a coarse profile without
     * stubbing `matchMedia`, demos that want to show touch-sized chrome on a
     * desktop, and hybrid devices where the media query guesses wrong.
     */
    device?: Partial<DeviceProfile>;

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
     * Flatness tolerance for curve tessellation, in world units. Forwarded
     * directly to `<Canvas flattenTolerance={...} />`. See
     * `CanvasProps.flattenTolerance` for details.
     */
    flattenTolerance?: number;

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
     * The debug overlay: `<Canvas debug>`'s config, plus `slops: true` for
     * translucent halos at every affordance hit zone. `false` turns it off;
     * absent reads `?debug=…` from the URL, as `<Canvas>` does.
     */
    debug?: (DebugConfig & { slops?: boolean }) | false;
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
     * Show or hide render layers in this canvas's own view, by id — the map
     * `<Canvas>` takes. Each scene layer paints as its own render layer, keyed
     * `scene:<layerId>`, so `{ 'scene:guides': false }` hides one scene layer
     * here and nowhere else.
     *
     * A layer hidden this way is gone from this view: it does not paint, and a
     * click, a marquee or Cmd+A here passes over it. Another view of the same
     * scene — a `<CanvasView>`, a second canvas, a minimap — still shows it and
     * can still take it. It applies on top of the scene's own
     * `LayerRecord.visible` and cannot show a layer the scene hides.
     */
    layerVisibility?: Record<string, boolean>;

    /**
     * Draw order for this view, by render-layer id, bottom first. A listed
     * order is the whole list: a scene layer left out of it is neither painted
     * nor picked here. See `CanvasProps.layerOrder`.
     */
    layerOrder?: string[];

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
    poseDescriptor,
    selectTool: selectToolOpts,
    insertTool,
    insertNodeFactories,
    ingestion,
    layouts,
    layoutDropTarget,
    reflowTransition,
    poseComposition,
    geometryProjection,
    routing,
    selection: selectionProp,
    selectionOptions,
    selectable = true,
    tools: toolsProp,
    features,
    enableKeybindings = true,
    enableGestureDispatcher = true,
    onToolsCreated,
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
    views: viewDescriptors,
    children,
    shaders,
    flattenTolerance,
    backgroundFill,
    cursorCoordsHud,
    pickHud,
    debug,
    modalityHud,
    alphaFor,
    layerVisibility,
    layerOrder,
    isPointerInteractive,
    onDoubleClick,
    chromeVisibility,
    modes,
    getFocused: getFocusedProp,
    device,
    ...rest
  } = props;

  const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;

  // Resolved once here and provided to the subtree, so overlays, affordances
  // and consumer chrome all read the same object rather than each running
  // their own media queries.
  const deviceProfile = useDeviceProfile(device);

  // How big grabbable chrome is for this pointer type. Paint (the selection
  // overlay), hit-test (`buildAffordanceAt`) and the slops debug overlay all
  // resolve from this one object — a size read from the base constants
  // directly is unscaled, and a coarse pointer then paints chrome it cannot
  // grab.
  const chromeSizes = useMemo(
    () => targetSizesPx(deviceProfile.targetScale),
    [deviceProfile.targetScale],
  );

  // `scene` accepts either a live `Scene` or a `SerializedScene` JSON
  // object. JSON is baked once via useState init; subsequent renders
  // ignore prop changes (use a `key` prop on `<SceneCanvas>` to force a
  // fresh canvas).
  const isSerialized = (s: unknown): boolean =>
    typeof s === 'object' && s != null && (s as { version?: unknown }).version === 1
      && Array.isArray((s as { nodes?: unknown }).nodes);
  const [bakedScene] = useState<Scene<TData, TLayer, TPose> | null>(
    () => isSerialized(sceneInput)
      ? sceneFromJSON(sceneInput as SerializedScene<TData, TLayer, TPose>, {})
      : null,
  );
  const scene = bakedScene ?? (sceneInput as Scene<TData, TLayer, TPose>);

  // Extract view-related props from rest so we can intercept them for the
  // controlled/uncontrolled pattern Canvas exposes without breaking it.
  const { view: viewProp, onViewChange: onViewChangeProp, defaultView, redrawOn: redrawOnProp, ...restProps } = rest;
  const getActiveMode = useMemo(() => (modes ? getActiveModeFor(modes) : undefined), [modes]);
  const redrawOn = useMemo(
    () => (modes ? [...(redrawOnProp ?? []), modes] : redrawOnProp),
    [modes, redrawOnProp],
  );

  // Internal canvas ref so the dispatcher can attach its input listeners
  // even when the consumer passes their own forwarded ref.
  const internalCanvasRef = useRef<HTMLElement | null>(null);
  // Holds the full `CanvasExtensionApi` so we can call `requestRedraw` after
  // dispatcher-side gesture pumps. Without this, dispatcher-only actions
  // (marquee, lasso, anything driven solely by `useGestureDispatcher`) never
  // trigger a re-paint between pointerdown and pointerup — the legacy tools
  // dispatcher's `onGestureChange` only fires for legacy `tool.drag.*` hooks,
  // which the migrated actions don't provide.
  const canvasApiRef = useRef<CanvasExtensionApi | null>(null);
  // Set from the merged ref callback, so effects needing the handle key off it
  // instead of assuming when React attaches it.
  const [canvasReady, setCanvasReady] = useState(false);

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

  // Late decodes, deferred glyph bakes and late paint kinds each drew nothing
  // on the frame that asked for them.
  useLateContentRedraw(useCallback(() => { canvasApiRef.current?.requestRedraw?.(); }, []));

  // Override writes deliberately don't bump the scene version — that fanout is
  // what a frame loop is trying to avoid — so the repaint has to come from
  // here instead.
  useEffect(() => scene.overrides.subscribe(() => {
    canvasApiRef.current?.requestRedraw?.();
  }), [scene]);

  // A scene write repaints; it does not re-render this component. The layers
  // read the scene at paint time and `contentVersion` is a getter, so nothing
  // here needs a commit to draw the new content. Chrome rendering node data as
  // DOM subscribes for itself — `useScene`'s default, `SelectionPanel`, the
  // panels an app hangs beside the canvas — which is what lets a host driving
  // poses from a frame loop take `useScene(…, { subscribe: false })` and
  // actually get it.
  useEffect(() => scene.subscribe(() => {
    canvasApiRef.current?.requestRedraw?.();
  }), [scene]);

  // The mirror every HUD, pick and pinch path reads synchronously. Seeded here
  // because those reads start before the canvas's subscription lands.
  const currentViewRef = useRef<View>(
    normalizeView(viewProp ?? defaultView ?? { x: 0, y: 0, scale: { x: 1, y: 1 } }),
  );
  // Committed renders only, so an abandoned transition's view never reaches
  // the `view` dep, picks or the camera animator.
  useInsertionEffect(() => {
    if (viewProp !== undefined) currentViewRef.current = normalizeView(viewProp);
  });

  useEffect(() => {
    const api = canvasApiRef.current;
    if (!api) return;
    currentViewRef.current = api.getView();
    return api.subscribeView((v) => { currentViewRef.current = v; });
  }, [canvasReady]);

  // The dep registry's `view.set`. Uncontrolled it must not also call
  // `onViewChangeProp` — the canvas reports the write through `notifyViewChange`.
  const handleViewChange = useCallback((v: View) => {
    const api = canvasApiRef.current;
    if (viewProp === undefined && api) { api.setView(v); return; }
    onViewChangeProp?.(normalizeView(v));
  }, [viewProp, onViewChangeProp]);

  // The camera runs on its own animator, never the `animator` prop's: that prop
  // is the consumer's scene animator, and their `cancelAll()` or `pause()` must
  // not strand a zoom half-finished or freeze the camera.
  const cameraAnimator = useAnimator();
  const viewChannel = useMemo(
    () => ({ get: () => currentViewRef.current, set: handleViewChange }),
    [handleViewChange],
  );
  const viewAnimation = useViewAnimationOn(viewChannel, cameraAnimator);

  // Never writes back to the canvas — `handleViewChange` would recurse. Every
  // `Canvas.setView` lands here on both branches, so it is also the runner's
  // one interrupt feed.
  const notifyViewChange = useCallback((v: View) => {
    viewAnimation.stopIfExternal();
    onViewChangeProp?.(v);
  }, [onViewChangeProp, viewAnimation]);

  // `animatedZoom` is the SceneCanvas-level spelling of the zoom action's
  // `animate` option, the way `pinchZoom` is of the pinch tool's clamp.
  const animatedZoom = viewport?.animatedZoom;
  const viewportZoomProp = viewport?.zoom ?? true;
  const resolvedViewportZoom = useMemo<boolean | ViewportZoomOptions>(() => {
    if (viewportZoomProp === false) return false;
    const base = typeof viewportZoomProp === 'object' ? viewportZoomProp : {};
    if (!animatedZoom) return base;
    return { ...base, animate: animatedZoom === true ? {} : animatedZoom };
  }, [viewportZoomProp, animatedZoom]);

  // Selection: caller-supplied wins; otherwise build from selectionOptions.
  // Hooks always run unconditionally — when a caller supplies `selection`,
  // the internally-built one is unused but the hook still fires.
  // Bound to the scene, so the selection an edit was made under rides on the
  // scene's history entries and undo can put it back.
  const derivedSelectionOptions = useMemo<UseSelectionOptions>(
    () => ({ scene, ...(selectionOptions ?? {}) }),
    [scene, selectionOptions],
  );
  const internalSelection = useSelection(derivedSelectionOptions);
  const baseSelection = selectionProp ?? internalSelection;

  // Everything the kit writes selection through — the `selection` dep, the
  // adapter's `setSelection`, ops committed through either — reads this api,
  // so on an unselectable canvas every write path here is closed. The
  // consumer's own api is not wrapped and still writes.
  const baseAdapterMethods = baseSelection.adapterMethods;
  const readOnlyAdapterMethods = useMemo(() => ({
    getSelection: () => baseAdapterMethods.getSelection(),
    setSelection: () => {},
  }), [baseAdapterMethods]);
  const selection: SelectionApi = useMemo(() => {
    if (selectable) return baseSelection;
    const noopSet = () => {};
    return {
      get current() { return baseSelection.current; },
      get: baseSelection.get,
      contains: baseSelection.contains,
      set: noopSet,
      add: noopSet,
      remove: noopSet,
      toggle: noopSet,
      clear: noopSet,
      applyClick: noopSet,
      adapterMethods: readOnlyAdapterMethods,
    };
  }, [baseSelection, selectable, readOnlyAdapterMethods]);

  // Publish the current selection (with optional per-id kind labels) into any
  // surrounding `<SelectionContextProvider>` so non-canvas UI can read it.
  // No-op when no provider is in scope.
  const currentSelection = selection.current;
  const selectionKinds = useMemo<readonly (string | undefined)[] | undefined>(() => {
    if (currentSelection.length === 0) return undefined;
    const out: (string | undefined)[] = [];
    for (const id of currentSelection) {
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
  }, [currentSelection, scene, describeKind]);
  usePublishSelection(currentSelection, selectionKinds);

  // Path-editing edit-mode state. Owned here so it's reachable from both:
  //   - the `pathEditingOverlay` chrome layer wired below
  //   - `useEditAnchorsDepSource`, mounted in the child StandardActionsRegistrar
  // The state stays empty until `enterPathEditAction` (double-click on a
  // selected polygon) sets it, and clears on `exitPathEditAction` (Escape).
  // Until then, the chrome doesn't draw and the gesture doesn't route to
  // `editAnchorsAction` — both gate on `editingId !== ''`.
  const [pathEditingId, setPathEditingId] = useState<string>('');
  const pathEditingIdRef = useLatest(pathEditingId);
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
  }, [pathEditingIdRef]);
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
  }), [effectivePathEditingId]);

  // Apply the handle-size fallback here so useSceneSelectTool always receives
  // a concrete radius even when the caller omits selectTool entirely.
  const selectToolWithDefaults = useMemo(() => ({
    handleHitRadius: chromeSizes.handle,
    // Shift-click belongs to the anchor selection while a path is being
    // anchor-edited; see `UseSelectToolOptions.extendClickLocked`.
    extendClickLocked: () => effectivePathEditingId() !== '',
    // `selectionAllowed` used to sit here, hand-checking the active mode for
    // `creates-selection` because the tool's pointerDown classifier was a
    // phase-table route and `Action.eligible` was never evaluated on that
    // pipeline (audit 3.4). The classifier is now `select.pick`, which
    // declares that capability itself — one rule, evaluated in one place.
    ...selectToolOpts,
  }), [selectToolOpts, chromeSizes.handle, effectivePathEditingId]);

  // Stable ref to the live selection; updated every render so the affordanceAt
  // and classifyTarget thunks (which live in an effect closure) always read
  // the latest selection without causing re-renders.
  const selectionRef = useLatest(selection);

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

  // The painted alpha of a node in this view: the caller's `alphaFor`
  // (scoping-dim, and anything else a consumer fades) times any per-node
  // override alpha. `<Canvas>` has no scene, so the override half is folded
  // in here — and the pick path reads the same number the painter does, or a
  // node faded to nothing stays clickable.
  const composedAlphaFor = useMemo(
    () => composeAlphaFor(scene, alphaFor),
    [scene, alphaFor],
  );

  // What this view paints of each scene layer, judged against the stack
  // `<Canvas>` composed and read at pick time — so a consumer slot anchored
  // between scene layers is weighed the way paint weighs it.
  const surfaceViewRegistry = useOptionalViewRegistry();
  const layerPaintRef = useLatest<ViewLayerPaint>({ layerVisibility, layerOrder });
  const [sceneLayerGate] = useState(createSceneLayerGate);
  const layerIsPainted = useCallback((layerId: string): boolean => (
    sceneLayerGate(surfaceViewRegistry?.surface()?.layers() ?? [], layerPaintRef.current)(layerId)
  ), [surfaceViewRegistry, sceneLayerGate, layerPaintRef]);
  // Absent when this view hides nothing, so the walk skips the gate.
  const viewLayerGate = layerVisibility !== undefined || layerOrder !== undefined
    ? layerIsPainted
    : undefined;

  // Under a frame a child's pose is already relative, so cascading a container
  // move would carry every descendant a second time.
  const framed = poseComposition !== undefined && poseComposition.closure !== 'identity';
  const adapter = useSceneAdapter(scene, {
    // `adapterMethods` is memoized; `selection` itself is a fresh object each render.
    selection: selection.adapterMethods,
    poseDescriptor: descriptor as PoseDescriptor<TPose>,
    commitInsert: insertTool?.create,
    insertLayer: insertTool?.layer,
    layouts,
    poseComposition,
    cascadeContainerPose: !framed,
  });

  const {
    selectTool: internalSelect, pickEvery: internalPickEvery, pickBest: internalPickBest,
    boundsOf: internalBoundsOf, boundsOfPose: internalBoundsOfPose, planeOfNode: internalPlaneOfNode,
    moveOptions: internalMoveOptions,
  } = useSceneSelectTool({
    scene,
    adapter,
    poseDescriptor: descriptor as PoseDescriptor<TPose>,
    geometry,
    // The pick tolerance is declared in screen pixels; this is what converts it.
    getView: () => currentViewRef.current,
    // Only when the consumer actually fades something. Without a prop the
    // composed function is just the override lookup, and the source resolves
    // that once per walk instead of once per candidate.
    ...(alphaFor ? { alphaOf: composedAlphaFor } : {}),
    ...(viewLayerGate ? { layerIsPainted: viewLayerGate } : {}),
    selectTool: selectToolWithDefaults,
  });
  // Read through a ref by the chrome layers, which are built once.
  const planeOfNodeRef = useLatest(internalPlaneOfNode);

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
      const pose = adapter.getWorldPose(id);
      const data = node ?? { id };
      return { kind, pose, data };
    };
    const base = makeGetNodeAtPoint(internalPickEvery, nodeResolver);
    if (!isPointerInteractive) return base;
    return (wx: number, wy: number, view?: PickView | null) => {
      const hit = base(wx, wy, view);
      if (hit == null) return null;
      if (isPointerInteractive(hit.id) === false) return null;
      return hit;
    };
  }, [adapter, internalPickEvery, isPointerInteractive, kindClassifier]);

  // The presets this canvas runs with. Keyed on the ids, not the array, so an
  // inline `features={['draw']}` does not re-derive every render.
  const featuresKey = (features ?? []).join('|');
  const hasViewport = viewport !== undefined;
  const enabled = useMemo(
    () => resolveFeatures(features, { viewport: hasViewport }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuresKey, hasViewport],
  );

  const inertiaEnabled = !!viewport?.inertia;
  const inertiaObj = typeof viewport?.inertia === 'object' ? viewport.inertia : undefined;
  // `inertia: true` means "on with kit defaults", so an enabled-but-objectless
  // config still has to reach the tool — an empty object, not `undefined`,
  // which the tool reads as off.
  const handToolInertia = inertiaEnabled
    ? {
        friction: inertiaObj?.friction,
        minSpeed: inertiaObj?.minSpeed,
        boundary: inertiaObj?.boundary,
        bounds: inertiaObj?.bounds,
      }
    : undefined;
  // useHandTool must always be called (rules of hooks); it is a no-op when
  // viewport is absent — the tool is simply not added to the registry.
  const handTool = useHandTool(handToolInertia ? { inertia: handToolInertia } : {});

  // Built-ins to mount: what `defaultTools` lists, plus the tool each preset
  // brings — `pick` the select tool, `view` the hand.
  const baseRequestedTools: readonly BuiltinToolId[] = [
    ...(defaultTools ?? []),
    ...(enabled.has('pick') ? ['select' as const] : []),
    ...(enabled.has('view') ? ['hand' as const] : []),
  ];

  // Patch-form `tools` extras with value `true` widen the requested set
  // ("pull in this built-in"). Computed here so the rest of the if-ladder
  // treats them identically to ids that came in via `defaultTools`.
  const KNOWN_BUILTIN_IDS: ReadonlySet<BuiltinToolId> = new Set<BuiltinToolId>([
    ...NON_SHAPE_BUILTIN_TOOLS, ...KIT_SHAPE_KINDS,
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

  const mergedAmbient = ambient ?? [];

  const internalRegistry: Record<string, AnyTool> = {};
  if (wants('select')) internalRegistry.select = internalSelect;
  // `hand` stays in the registry (not ambient) so its H keybinding and its
  // Space hold both apply.
  if (wants('hand')) internalRegistry.hand = handTool;
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
          console.warn(`[SceneCanvas] tools prop overrides bundled "${id}" tool`);
        }
        internalRegistry[id] = value;
      }
    }
  }

  // Takeover form: only when toolsProp is the full ToolsApi shape.
  const toolsTakeover = toolsProp && isToolsApi(toolsProp) ? toolsProp : null;

  const internalTools = useTools({
    active: initialActiveTool ?? ('select' in internalRegistry ? 'select' : null),
    registry: internalRegistry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
    ...(modes ? { modes } : {}),
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
  const liveToolsRef = useLatest<ToolsApi | null>(toolsTakeover ?? internalTools);
  const getActiveModeRef = useLatest(getActiveMode);
  //
  // `isToolEligible` mirrors `eligibleForMode` (packages/modes) — the same
  // predicate `ToolPalette` uses to grey a button out. Without a mode
  // registry every tool stays activatable.
  const isToolEligible = useCallback((toolId: string): boolean => {
    const getMode = getActiveModeRef.current;
    if (!getMode) return true;
    const registry = liveToolsRef.current?.registry;
    const caps = registry?.[toolId]?.eligibility.capabilities ?? [];
    if (caps.length === 0) return false;
    const allowed = getMode().allowedCapabilities;
    for (const c of caps) if (allowed.has(c)) return true;
    return false;
  }, [getActiveModeRef, liveToolsRef]);


  const tools = toolsTakeover ?? internalTools;

  // The selection's own ambient bindings: `move` and `transform`. They are
  // not tools and sit outside `tools`, so they apply under a takeover too.
  const selectionMoveOptions = useMemo(
    () => ({ move: internalMoveOptions }),
    [internalMoveOptions],
  );
  const rotateOptions = selectToolOpts?.rotate || undefined;
  // Transform first: a handle sits over the selected body, so the move
  // binding matches a handle drag too, and a tie goes to whichever is first.
  const featureContributions = useMemo<Contribution[]>(() => [
    ...(enabled.has('transform') ? [selectionTransformContribution({ rotate: rotateOptions })] : []),
    ...(enabled.has('move') ? [selectionMoveContribution(selectionMoveOptions)] : []),
  ], [enabled, selectionMoveOptions, rotateOptions]);

  // Kit-standard actions to register: every preset's own, plus whichever a
  // tool or contribution on this canvas binds — a tool brings the actions it
  // routes to, so `defaultTools={['rect']}` works under any preset.
  const standardActionsExclude = useMemo(() => {
    const include = featureActionIds(enabled);
    const bound = [
      ...Object.values(tools.registry),
      ...tools.ambient,
      ...featureContributions,
    ];
    for (const entry of bound) {
      for (const b of entry.bindings ?? []) include.add(b.actionId);
    }
    return KIT_STANDARD_ACTION_IDS.filter((id) => !include.has(id));
  }, [enabled, tools, featureContributions]);

  // Surface the resolved ToolsApi to the introspection callback (the
  // toolkit-builder dev surface uses this to walk `tools.registry` for
  // its live route table). Fires whenever the `tools` identity changes,
  // which is stable across most renders thanks to useTools' useMemo.
  const onToolsCreatedRef = useLatest(onToolsCreated);
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools, onToolsCreatedRef]);

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
  const onDoubleClickRef = useLatest(onDoubleClick);
  const getNodeAtPointRef = useLatest(getNodeAtPoint);
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
    () => mergeLayersWithDefaults(layers, deviceProfile.targetScale),
    [layers, deviceProfile.targetScale],
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

  // The dispatcher's half of this view's overlay-aware lookups: whose
  // committed paint a ghost hides, and the pose a handle proposes for an id.
  const { previewIdsExtra, previewPoseExtra } = useMemo(
    () => createDispatcherPreviewSources(() => dispatcherRef.current),
    [],
  );

  const sceneSlot = useMemo(() => {
    const slot = mergedLayers.scene;
    if (!slot || 'layer' in slot) return slot; // null or CustomLayerEntry — leave alone
    return wireSceneSlotToScene(
      slot as SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
      scene,
      alphaFor,
      animator?.colorOverrides,
    );
  }, [mergedLayers.scene, alphaFor, scene, animator]);

  // Preview-ghost layer: renders in-flight gesture poses on top of the
  // committed scene using the scene slot's `drawOne`, from whichever view's
  // preview sources the draw envelope carries. It takes the scene-wired slot,
  // so a ghosted derived node still resolves its path.
  const previewLayer = usePreviewGhostLayer<TData, TLayer, TPose>({
    scene,
    sceneSlot,
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

  const getNodeAtPointRefForHover = useLatest(getNodeAtPoint);
  const getHover = useHoverTracking({
    canvasRef: internalCanvasRef,
    // One lookup, not a client→world thunk beside a picker: the point and the
    // camera its tolerance converts against have to come from the same view.
    // Hover has no pointer to capture, so it resolves fresh — whichever view
    // is under the cursor right now owns the point.
    nodeAtClientPoint: (clientX, clientY) => {
      const canvas = internalCanvasRef.current;
      if (!canvas) return null;
      const target = surfaceViewRegistry?.resolver.at(null, clientX, clientY);
      const origin = target?.origin ?? canvas.getBoundingClientRect();
      const view = target?.view ?? currentViewRef.current;
      const [x, y] = clientToWorldHelper(clientX, clientY, origin, view);
      // A view judges its own layers; the surface's gate is the picker's default.
      const reg = target?.id != null
        ? surfaceViewRegistry?.list().find((r) => r.id === target.id)
        : undefined;
      const hit = getNodeAtPointRefForHover.current?.(
        x, y, reg ? { scale: view.scale, layerIsPainted: reg.layerIsPainted } : view,
      );
      return hit ? { id: hit.id as NodeId } : null;
    },
    enabled: chromeVisibility !== undefined,
  });

  // Stable refs for the live selection / view / focus / suppression sources
  // that feed `buildChromeCtx`. The resolver factory below closes over these
  // and is called per draw / per hitTest from Canvas.
  const selectionForCapsRef = useLatest(selection.current as readonly NodeId[]);
  const getFocusedPropRef = useLatest(getFocusedProp);
  // Selection chrome belongs to the presets that act on it: the outline to
  // `pick`, the handles to `transform`. `never` also takes a handle out of
  // hit-testing, so a hidden handle cannot be grabbed.
  //
  // `selectable={false}` suppresses the marquee / lasso chrome by default:
  // every selection write no-ops then, so the select tool's
  // empty-drag binding still CLAIMS the gesture (keeping it from falling
  // through to other ambient drag actions like insert) but paints nothing.
  // An explicit consumer rule for either id still wins.
  const effectiveChromeVisibility = useMemo(() => {
    // Kit defaults first; consumer `chromeVisibility` spread last so it wins.
    const defaults: import('features/chrome-caps').VisibilityRules = {};
    if (!enabled.has('pick')) defaults['selection.outline'] = never;
    if (!enabled.has('transform')) {
      defaults['selection.resize-handles'] = never;
      defaults['selection.rotation-handle'] = never;
    }
    if (!selectable) {
      defaults['action.marquee'] = never;
      defaults['action.lasso'] = never;
    }
    // `selectTool.rotate === false` hides the rotation handle (its action is
    // also dropped below) so a non-rotatable consumer fully opts out.
    if (selectToolOpts?.rotate === false) defaults['selection.rotation-handle'] = never;
    if (Object.keys(defaults).length === 0) return chromeVisibility;
    return { ...defaults, ...chromeVisibility };
  }, [chromeVisibility, selectable, selectToolOpts?.rotate, enabled]);
  const chromeVisibilityRef = useLatest(effectiveChromeVisibility);
  // Read through a ref for the same reason as the others here:
  // `buildCurrentRuleCtx` is a stable `useCallback`, and adding the profile to
  // its deps would rebuild it whenever a media query changes.
  const deviceProfileRef = useLatest(deviceProfile);
  // Per-node resizability predicate from `selectTool.resize.resizable`, folded
  // over the live selection into the `selectionResizable` rule-ctx flag below.
  const resizablePredRef = useLatest(selectToolOpts?.resize?.resizable);

  // The visibility predicate factory passed to <Canvas>. Called fresh per
  // draw / hitTest; builds ChromeCtx from the live refs and resolves
  // against the merged rule table. Returns the universal predicate when
  // no consumer overrides are present AND no hover tracking is needed —
  // letting the kit's defaults still gate paint without forcing every
  // legacy consumer onto chrome-caps.
  /** Build the live RuleCtx — selection + view + modifiers + mode + capabilities
   *  + active action. Consumed by chrome-caps' resolver and the dispatcher's
   *  eligibility filter so both see the same view of the world. */
  const buildRuleCtxFor = useCallback((inputs: ViewRuleInputs) => {
    const sel = inputs.selection;
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
      action: inputs.action,
      hover: getHover(),
      view: inputs.view,
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
      zoom: viewZoom(inputs.view),
      mode: modeInfo.id,
      allowedCapabilities: modeInfo.allowedCapabilities,
      selectionResizable,
      editingAnchors: effectivePathEditingId() !== '',
      device: deviceProfileRef.current,
    };
  }, [getHover, effectivePathEditingId, getActiveModeRef, getFocusedPropRef, resizablePredRef, deviceProfileRef]);

  /** The surface's own view zero. */
  const currentRuleInputs = useCallback((): ViewRuleInputs => ({
    selection: selectionForCapsRef.current,
    view: currentViewRef.current,
    action: dispatcher.getActiveAction(),
  }), [dispatcher, selectionForCapsRef]);
  const buildCurrentRuleCtx = useCallback(
    () => buildRuleCtxFor(currentRuleInputs()),
    [buildRuleCtxFor, currentRuleInputs],
  );

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
    [getActiveMode, getActiveModeRef],
  );
  useInsertionEffect(() => {
    anchorEditingAllowedRef.current = anchorEditingAllowed;
  });

  /** The chrome-caps answers for one view: the surface's rule table evaluated
   *  against that view's selection, camera and in-flight action. */
  const chromeCaps = useMemo(() => ({
    ruleCtx: (inputs: ViewRuleInputs) =>
      (getActiveModeRef.current ? buildRuleCtxFor(inputs) as RuleCtx : undefined),
    isVisible: (inputs: ViewRuleInputs) => resolveVisibility(
      chromeVisibilityRef.current,
      buildRuleCtxFor(inputs) as Parameters<typeof resolveVisibility>[1],
    ),
  }), [buildRuleCtxFor, getActiveModeRef, chromeVisibilityRef]);

  const getIsVisibleForCanvas = useCallback(
    (): ((id: string) => boolean) => chromeCaps.isVisible(currentRuleInputs()),
    [chromeCaps, currentRuleInputs],
  );

  // Pen preview overlay — reads the pen tool's persistent scratch and draws
  // the in-progress path (anchors, handles, rubber-band, close hint). Only
  // wired when the pen tool is actually registered; otherwise null.
  const wantsPen = wants('pen');
  const penPreviewLayer = useMemo(
    () => (wantsPen
      ? createPenPreviewLayer({ penTool: shapeTools.pen as Tool<PenScratch> })
      : null),
    [shapeTools.pen, wantsPen],
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
  const sceneRefForOverlay = useLatest(scene);
  const slopsOn = debug !== undefined && debug !== false && debug.slops === true;
  const selectionOverlayCfg = mergedLayers.selectionOverlay as
    | SelectionOverlaySlotConfig<TPose> | null | undefined;
  const badgeOf = selectionOverlayCfg ? rotationBadgeOf(selectionOverlayCfg) : null;
  // Kept by value so the layers and hit-testers keyed on it don't rebuild
  // every render.
  const rotationBadge = useMemo(
    () => badgeOf,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [badgeOf?.distancePx, badgeOf?.sizePx],
  );
  // Debug: slops viz layer (off by default). Draws the affordances the
  // gesture mounter hit-tests, which it publishes here, so the halos are the
  // hit regions rather than a copy of them.
  const chromeAffordancesRef = useRef<readonly Affordance[]>([]);
  const slopsLayer = useMemo(
    () => createSlopsDebugLayer({ getAffordances: () => chromeAffordancesRef.current }),
    [],
  );

  // Resolve the live (preview-aware) world polygon for `id`. Reads from
  // the dispatcher's in-flight handles first — whichever handle owns
  // the gesture (editAnchors anchor-drag, move-the-whole-path, etc.)
  // contributes the previewPose / previewData that we'd otherwise
  // dispatch separately. Synthesizes a (pose, data) pair and routes it
  // through `resolveEditablePathOf` so chrome and slops viz follow
  // *any* in-flight gesture that previews state for the editing id.
  const livePathFor = (
    id: string,
    previews: readonly GesturePreviewSource[],
    view: View,
  ): PolygonPath | null => {
    const node = sceneRefForOverlay.current?.get(id as never);
    if (!node) return null;
    let pose = node.pose as unknown;
    let data = node.data as unknown;
    let touched = false;
    for (const source of previews) {
      const previewIds = source.previewIds?.();
      if (!previewIds) continue;
      let owns = false;
      for (const pid of previewIds) {
        if (pid === id) { owns = true; break; }
      }
      if (!owns) continue;
      const p = source.previewPose?.(id);
      if (p != null && !touched) { pose = p; touched = true; }
      const d = source.previewData?.(id);
      if (d != null) { data = d; touched = true; }
    }
    // In the drawing camera's world: a path on a parallax plane is stored in
    // the plane's.
    return pathFromPlane(
      resolveEditablePathOf({ pose, data } as { pose: unknown; data: unknown }),
      planeOfNodeRef.current(id, view),
    );
  };

  const pathEditingOverlayLayer = useMemo(
    () => createPathEditingOverlayLayer({
      getEditingId: () => effectivePathEditingId() || null,
      getPose: (id, previews, view) => livePathFor(id, previews, view) as never,
      getSelectedAnchors: () => selectedAnchorsRef.current,
      // Drawn by an action that ran in the edited path's plane.
      getMarquee: (view) => {
        const rect = anchorMarqueeRef.current;
        const plane = rect ? planeOfNodeRef.current(effectivePathEditingId(), view) : null;
        return rect && plane ? rectFromPlane(plane, rect) : rect;
      },
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
  }, [effectivePathEditingId]);

  // Selection overlay — constructed here (scene-aware) per main's seam refactor.
  // Layered on top: path-edit suppression from HEAD's branch.
  const selectionOverlayLayer = useMemo(() => {
    const selCfg = mergedLayers.selectionOverlay as
      | SelectionOverlaySlotConfig<TPose>
      | null
      | undefined;
    if (selCfg === null) return null;
    const cfg = (selCfg ?? {}) as SelectionOverlaySlotConfig<TPose>;

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
      getSuppressedIds,
      ...(cfg.poseById
        ? {
            getPose: cfg.poseById,
            poseDescriptor: cfg.poseDescriptor ?? (descriptor as PoseDescriptor<TPose>),
          }
        : {}),
    });
  }, [mergedLayers.selectionOverlay, getSuppressedSelectionIds, descriptor]);

  const wiredLayers = useMemo<LayersMap<Node<TData, TLayer, TPose>, TPose>>(() => ({
    ...mergedLayers,
    ...(sceneSlot ? { scene: sceneSlot } : {}),
    // Pass the pre-built selection overlay layer so Canvas receives a
    // CustomLayerEntry and skips its own factory construction for this slot.
    selectionOverlay: selectionOverlayLayer
      ? { layer: selectionOverlayLayer }
      : mergedLayers.selectionOverlay === null ? null : undefined,
    previewGhost: { layer: previewLayer, after: 'scene' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'previewGhost' },
    ...(penPreviewLayer ? { penPreview: { layer: penPreviewLayer, after: 'dispatcherOverlay' } } : {}),
    pathEditingOverlay: { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    ...(slopsOn ? { slopsDebug: { layer: slopsLayer, after: 'pathEditingOverlay' } } : {}),
  }), [mergedLayers, sceneSlot, selectionOverlayLayer, previewLayer, dispatcherOverlay, penPreviewLayer, pathEditingOverlayLayer, slopsOn, slopsLayer]);

  // Standard-action deps: closures over the live scene / selection / adapter
  // so the resolved actions always read current state. `useStandardActions`
  // stabilizes via refs internally — these closures are passed every render
  // but the registered Action descriptors are not re-registered.
  // `CanvasExtensionApi.ingest` — imperative entry into the same
  // content-handler pipeline OS drop / clipboard paste hit. Routed through
  // `registry.trigger('ingest', …)` so the action's `requires` deps
  // (insert, ingestion, …) are resolved exactly as on the dispatcher path.
  // `StandardActionsRegistrar` stashes the registry into this ref.
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

  // Views added through the handle rather than declared as props or children.
  const [addedViews, setAddedViews] = useState<readonly CanvasViewProps[]>([]);
  const addView = useCallback((props: CanvasViewProps): CanvasViewHandle => {
    setAddedViews((list) => [...list.filter((v) => v.id !== props.id), props]);
    return {
      id: props.id,
      draw: (data, outer, dims) =>
        surfaceViewRegistry?.list().find((r) => r.id === props.id)?.layer.draw(data, outer, dims) ?? [],
      remove: () => setAddedViews((list) => list.filter((v) => v !== props)),
    };
  }, [surfaceViewRegistry]);

  // Merge the forwarded ref with our internalCanvasRef so the dispatcher can
  // read the canvas element even when the consumer also forwards a ref.
  // The handle exposed to consumers extends the primitive's with `ingest`
  // (SceneCanvas-only — it needs the action stack).
  const mergedRef = useCallback(
    (node: CanvasExtensionApi | null) => {
      internalCanvasRef.current = node?.element ?? null;
      const extended: SceneCanvasApi | null = node
        ? {
            ...node,
            ingest: ingestImpl,
            animateView: viewAnimation.animate,
            stopViewAnimation: viewAnimation.stop,
            isViewAnimating: viewAnimation.isAnimating,
            addView,
          }
        : null;
      canvasApiRef.current = extended;
      setCanvasReady(extended !== null);
      if (typeof ref === 'function') ref(extended);
      else if (ref) (ref as React.MutableRefObject<SceneCanvasApi | null>).current = extended;
    },
    [ref, ingestImpl, viewAnimation, addView],
  );

  // What a view needs to build its own overlay-aware state. `geometry` is the
  // same descriptor handed to `<Canvas>`, so the two cannot diverge.
  const viewInputs = useMemo<SurfaceViewInputs>(() => ({
    adapter: adapter as unknown as { getPose(id: string): unknown },
    geometry: descriptor,
    boundsOf: internalBoundsOf,
    boundsOfPose: internalBoundsOfPose as SurfaceViewInputs['boundsOfPose'],
    planeOfNode: internalPlaneOfNode,
    tools,
    pickEvery: internalPickEvery,
    pickBest: internalPickBest,
    kindOfNode,
    chromeCaps,
    selectionApi: selection,
    rotationBadge,
  }), [adapter, descriptor, internalBoundsOf, internalBoundsOfPose, internalPlaneOfNode, tools,
       internalPickEvery, internalPickBest, kindOfNode, chromeCaps, selection, rotationBadge]);

  const canvas = (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={mergedRef}
      adapter={adapter}
      selection={selection}
      poseDescriptor={descriptor as PoseDescriptor<TPose>}
      tools={tools}
      layers={wiredLayers}
      pickEvery={internalPickEvery}
      // The chrome's bounds are the picker's: a node on a parallax plane is
      // boxed where the plane draws it, and a `geometry.boundsOf` reaches both.
      boundsOf={internalBoundsOf}
      boundsOfPose={internalBoundsOfPose}
      getIsVisible={getIsVisibleForCanvas}
      previewIdsExtra={previewIdsExtra}
      // The gesture surface behind `helpersRef.getGestureBounds()` /
      // `subscribeGestures()` — Canvas has no dispatcher of its own.
      gestureSource={gestureSource}
      previewPoseExtra={previewPoseExtra}
      backgroundFill={backgroundFill}
      cursorCoordsHud={cursorCoordsHud}
      pickHud={pickHud}
      modalityHud={modalityHud}
      {...(debug !== undefined ? { debug: canvasDebug(debug) } : {})}
      pickBest={internalPickBest}
      contentVersion={scene.getVersion}
      layerVisibility={layerVisibility}
      layerOrder={layerOrder}
      {...(viewProp !== undefined ? { view: viewProp } : { defaultView })}
      onViewChange={notifyViewChange}
      shaders={shaders}
      flattenTolerance={flattenTolerance}
      // onBackgroundClick is intentionally NOT wired here. The `clearSelection`
      // action binding in the select tool handles "click on empty background clears
      // selection" for all SceneCanvas consumers. Wiring a separate background-click
      // callback would interfere with the gesture dispatcher (which handles lasso,
      // marquee, etc.) since tools.dispatcher.hasActiveGesture() only covers the
      // legacy tool channel, not the gesture dispatcher channel.
      {...(redrawOn ? { redrawOn } : {})}
      {...restProps}
    />
  );

  // Test hook: opt-in via ?test=1, never in production builds. See src/test-hook.
  const testHookSceneRef = useLatest(scene);
  const testHookSelectionRef = useLatest(selection);

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
        getActiveToolId: () => liveToolsRef.current?.active ?? null,
      });
      testHookRef.current?._markReady();
    }
  }, [testHookSceneRef, testHookSelectionRef, liveToolsRef]);

  return (
    <DeviceProfileProvider value={device}>
      <ViewInputsProvider value={viewInputs}>
        <>
          <PointerProviderIfRoot>
            <>
              {canvas}
              <PointerPublisher canvasRef={internalCanvasRef} />
              <StandardActionsRegistrar
                selection={selection}
                scene={scene as Scene<unknown, string, unknown>}
                adapter={adapter as unknown as BridgeAdapter}
                actionDefaults={actionDefaults}
                actions={resolvedActions}
                excludeActions={standardActionsExclude}
                currentViewRef={currentViewRef}
                onViewChange={handleViewChange}
                resizeOptions={selectToolOpts?.resize as UseResizeOptions<unknown> | undefined}
                poseDescriptor={descriptor}
                geometryProjection={geometryProjection}
                dispatcher={dispatcher}
                getActionRef={getActionRef}
                pickEvery={internalPickEvery}
                layerIsPainted={viewLayerGate}
                alphaOf={alphaFor ? composedAlphaFor : undefined}
                viewportPanEnabled={enabled.has('view') ? (viewport?.pan ?? true) : false}
                viewportZoom={enabled.has('view') ? resolvedViewportZoom : false}
                viewportPinchZoom={enabled.has('view') ? (viewport?.pinchZoom ?? true) : false}
                viewportRecenter={viewport?.recenter}
                viewAnimation={viewAnimation}
                editAnchorsExternalState={editAnchorsExternalState}
                anchorEditingAllowed={anchorEditingAllowed}
                layouts={layouts as SceneCanvasProps<unknown, string, unknown>['layouts']}
                layoutDropTarget={layoutDropTarget}
                reflowTransition={reflowTransition as ReflowTransition<unknown> | null | undefined}
                poseComposition={poseComposition as SceneCanvasProps<unknown, string, unknown>['poseComposition']}
                insertNodeFactories={insertNodeFactories}
                snapPoint={toolOptions?.snapPoint}
                canvasRef={internalCanvasRef}
                canvasApiRef={canvasApiRef}
                ingestionResolveSrc={ingestion?.resolveSrc}
                ingestionSvg={ingestion?.svg}
                ingestionClipboard={ingestionClipboard}
                actionsRegistryRef={actionsRegistryRef}
              />
              <GestureDispatcherMounter
                canvasRef={internalCanvasRef}
                canvasApiRef={canvasApiRef}
                tools={tools}
                contributions={featureContributions}
                enabled={enableGestureDispatcher}
                keyboard={enableKeybindings}
                selectionRef={selectionRef}
                boundsOf={internalBoundsOf}
                planeOfNode={internalPlaneOfNode}
                pickEvery={internalPickEvery}
                pickBest={internalPickBest}
                kindOfNode={kindOfNode}
                viewRef={currentViewRef}
                dispatcher={dispatcher}
                getIsVisibleForCanvas={getIsVisibleForCanvas}
                getRuleCtx={getActiveMode ? buildCurrentRuleCtx : undefined}
                targetScale={deviceProfile.targetScale}
                handleHitRadius={selectToolOpts?.handleHitRadius}
                rotationBadge={rotationBadge}
                chromeAffordancesRef={chromeAffordancesRef}
                onDoubleClick={onDoubleClickObserver}
              />
              <ToolKeybindingsMounter
                internalTools={internalTools}
                toolsTakeover={toolsTakeover ?? undefined}
                enableKeybindings={enableKeybindings}
                isToolEligible={isToolEligible}
                canvasApi={canvasReady ? canvasApiRef.current : null}
              />
              {viewDescriptors?.map((v, i) => (
                <CanvasView key={v.id} {...v} order={v.order ?? i} />
              ))}
              {contributionEntries(tools).flatMap((e) => e.views ?? []).map((v) => (
                <CanvasView key={`contribution:${v.id}`} {...v} />
              ))}
              {addedViews.map((v) => <CanvasView key={`added:${v.id}`} {...v} />)}
              {children}
            </>
          </PointerProviderIfRoot>
        </>
      </ViewInputsProvider>
    </DeviceProfileProvider>
  );
}

/**
 * Mounts the gesture dispatcher on this canvas's input scope.
 *
 * Accepts `selectionRef`, `boundsOf`, `pickEvery`, and `viewRef` so
 * it can wire `affordanceAt` + `classifyTarget` thunks into the dispatcher.
 * These thunks convert client coords → world coords via the canvas rect + view,
 * then classify the pointer position against affordances and scene bodies.
 */
/**
 * Mounts `useKeybindings`, whose `tool.activate` / `tool.offhand` /
 * `tool.resetToDefault` registrations land in this canvas's scope.
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
  canvasApi,
}: {
  internalTools: ToolsApi;
  toolsTakeover?: ToolsApi;
  enableKeybindings: boolean;
  isToolEligible: (toolId: string) => boolean;
  canvasApi: CanvasExtensionApi | null;
}) {
  useKeybindings(internalTools, {
    disable: !!toolsTakeover || !enableKeybindings,
    isToolEligible,
  });
  useKeybindings(toolsTakeover ?? internalTools, {
    disable: !toolsTakeover || !enableKeybindings,
    isToolEligible,
  });
  // Entry-owned roles: actions (polygon.adjustSides, …), deps and `attach`.
  // Same reason this lives here and not in the tool hooks: the hooks run above
  // the provider. Not gated on `enableKeybindings` — these back wheel and
  // pointer bindings too, not just keys.
  useContributionRoles(toolsTakeover ?? internalTools, canvasApi);
  return null;
}

function GestureDispatcherMounter({
  canvasRef,
  canvasApiRef,
  tools,
  contributions,
  enabled,
  keyboard,
  selectionRef,
  boundsOf,
  planeOfNode,
  pickEvery,
  pickBest,
  kindOfNode,
  viewRef,
  dispatcher,
  getIsVisibleForCanvas,
  getRuleCtx,
  targetScale,
  handleHitRadius,
  rotationBadge,
  chromeAffordancesRef,
  onDoubleClick,
}: {
  canvasRef: React.RefObject<HTMLElement | null>;
  /** Holds the full `CanvasExtensionApi` so the gesture dispatcher can call
   *  `requestRedraw()` between pointer events. */
  canvasApiRef?: React.RefObject<CanvasExtensionApi | null>;
  tools: ToolsApi;
  /** Always-live entries the canvas installs beside `tools` — the selection's
   *  `move` / `transform` bindings. Ahead of the tools' ambient entries, so a
   *  tie at one specificity goes to the kit's. */
  contributions: readonly Contribution[];
  enabled: boolean;
  /** When false, the dispatcher leaves keyboard listeners unattached so
   *  keyboard-bound actions never fire. Wired to `enableKeybindings`. */
  keyboard: boolean;
  selectionRef?: React.RefObject<import('core/selection/useSelection').SelectionApi>;
  boundsOf?: (id: string) => import('core/viewport/fitViewToBounds').Bounds | null;
  /** The parallax plane a node is drawn through, under the surface's camera —
   *  so path anchors are hit where the plane draws them. */
  planeOfNode?: (id: string) => import('core/viewport/parallax').PlaneMap | null;
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
  /** `DeviceProfile.targetScale`, so the affordance grab zones resolve to the
   *  same sizes the chrome paints at. */
  targetScale?: number;
  /** Consumer override for the corner-handle grab radius
   *  (`selectTool.handleHitRadius`). Undefined takes the device-scaled size. */
  handleHitRadius?: number;
  /** The rotate badge the selection overlay paints, grabbable where drawn. */
  rotationBadge?: { distancePx: number; sizePx: number } | null;
  /** Receives the affordances this mounter hit-tests, for the slops overlay. */
  chromeAffordancesRef?: React.MutableRefObject<readonly Affordance[]>;
  /** Fires on every synthesized double click, in world coords. Backs the
   *  `onDoubleClick` prop — see the option's doc on
   *  `UseGestureDispatcherOptions` for why it's an observer, not a binding. */
  onDoubleClick?: (world: { x: number; y: number }) => void;
}) {
  const registry = useActionsRegistry();
  const depRegistry = useDepRegistry();
  const viewRegistry = useOptionalViewRegistry();
  const entriesById = useMemo<ReadonlyMap<string, Contribution>>(() => {
    const m = new Map<string, Contribution>();
    for (const [id, tool] of Object.entries(tools.registry)) {
      m.set(id, tool);
    }
    for (const entry of contributions) m.set(entry.id, entry);
    // Ambient entries too — their bindings assemble at ambient scope, and the
    // dispatcher resolves them through this same map.
    for (const entry of tools.ambient) m.set(entry.id, entry);
    return m;
  }, [tools.registry, tools.ambient, contributions]);


  // Stable refs for the optional thunk inputs so the thunks themselves are
  // stable function identities across renders (no need to pass them as deps).
  const pickEveryRef = useLatest(pickEvery);
  const pickBestRef = useLatest(pickBest);
  const kindOfNodeRef = useLatest(kindOfNode);

  // `getAnchorState` thunk for `buildAffordanceAt` — reads the live
  // `editAnchors` dep from the registry at call time.
  const depRegistryRef = useLatest(depRegistry);
  const planeOfNodeRef = useLatest(planeOfNode);
  const getAnchorState = useMemo(() => anchorStateFrom(
    () => depRegistryRef.current,
    (id, path) => pathFromPlane(path, planeOfNodeRef.current?.(id) ?? null),
  ), [depRegistryRef, planeOfNodeRef]);

  // Build the `affordanceAt` thunk. Takes world coords and delegates to
  // `buildAffordanceAt` for handle hit-testing.
  const affordances = useMemo(() => chromeAffordances({
    ...(targetScale !== undefined ? { targetScale } : {}),
    ...(handleHitRadius !== undefined ? { handleHitRadius } : {}),
    rotationBadge,
    getAnchorState,
  }), [targetScale, handleHitRadius, rotationBadge, getAnchorState]);
  useInsertionEffect(() => {
    if (chromeAffordancesRef) chromeAffordancesRef.current = affordances;
  });
  const affordanceAt = useMemo(() => {
    if (!selectionRef || !boundsOf || !viewRef) return undefined;
    return buildAffordanceAt({
      // The canvas's own view chrome, built once by its helpers — not a
      // second construction here that has to agree with the painted one.
      getChromeState: () => viewRegistry?.surface()?.chromeState() ?? EMPTY_CHROME_STATE,
      // Radii are declared in screen pixels and converted against this view.
      getView: () => viewRef.current ?? { x: 0, y: 0, scale: { x: 1, y: 1 } },
      affordances,
      // Chrome-caps resolver: keep the affordance hit-test in sync with what
      // the renderer is actually painting. Without this, a click on a (no
      // longer visible) resize handle position still classifies as a resize
      // handle — e.g. an anchor drag in path-edit mode resizes the path's
      // bounding box instead of moving the anchor.
      ...(getIsVisibleForCanvas ? { getIsVisible: () => getIsVisibleForCanvas() } : {}),
    });
  }, [selectionRef, boundsOf, viewRef, affordances, getIsVisibleForCanvas, viewRegistry]);

  // Build the `classifyTarget` thunk. Takes world coords and delegates to
  // `buildClassifyTarget`.
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
  }, [selectionRef, pickEvery, viewRef, pickBestRef, pickEveryRef, kindOfNodeRef]);

  // The canvas rect is read on every call (not cached) so it stays correct
  // after layout changes.
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

  const affordanceWithLayers = useMemo(() => {
    // Note this is NOT gated on `affordanceAt` being built: registered layers
    // produce affordances of their own, and a consumer with no selection
    // chrome (a canvas that is nothing but a HUD, say) still needs those.
    return (worldPoint: { x: number; y: number }) => {
      // Registered layers first: they draw on top of the kit's own chrome, so
      // they get first refusal on the point. A hit becomes an `AffordanceHit`
      // whose kind names the layer, carrying whatever the layer's hit-test
      // resolved — which is how `@weasel-js/hud` routes a press on one of its
      // widgets to its own action instead of the active tool.
      const extra = canvasApiRef?.current?.hitTestExtras?.(worldPoint.x, worldPoint.y);
      if (extra) {
        const claim = extra.hit;
        return {
          kind: `layer:${extra.layerId}`,
          owner: extra.layerId,
          strength: claim.strength ?? 'shared',
          ...(claim.claimedKinds !== undefined ? { claimedKinds: claim.claimedKinds } : {}),
          ...(claim.cursor !== undefined ? { cursor: claim.cursor } : {}),
          ...(claim.initialScratch !== undefined ? { payload: claim.initialScratch } : {}),
        };
      }
      return affordanceAt ? affordanceAt(worldPoint) : null;
    };
  }, [affordanceAt, canvasApiRef]);

  // Stable callback that asks the canvas to redraw. Reads via ref so the
  // identity stays stable while the underlying API binds after mount.
  const requestRedraw = useCallback(() => {
    canvasApiRef?.current?.requestRedraw?.();
  }, [canvasApiRef]);

  // The painted tier's channel, read live for the same reason — the handle it
  // lives on binds after mount.
  const paintedCursor = useCallback(
    () => canvasApiRef?.current?.paintedCursor,
    [canvasApiRef],
  );

  // Input routing to registered views. Rebuilt per event from the registry, so
  // a view that mounts or moves mid-session is routable on the next event; with
  // nothing registered every point resolves to the canvas, as before.
  const views = useMemo(() => {
    if (!viewRegistry) return undefined;
    return {
      targets: () => viewRegistry.list().map((r) => ({ id: r.id, ...r.target })),
      resolver: viewRegistry.resolver,
    };
  }, [viewRegistry]);

  // Hover cursors live in `useGestureDispatcher`'s hover-cursor pump:
  // affordance hits carry `AffordanceHit.cursor` (set by `buildAffordanceAt`),
  // and everything else is predicted via `Dispatcher.resolveOnly` +
  // `Action.cursor`. Nothing SceneCanvas-specific remains here.
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById,
    enabled,
    keyboard,
    affordanceAt: affordanceWithLayers,
    classifyTarget,
    dispatcher,
    clientToWorld,
    requestRedraw,
    paintedCursor,
    getRuleCtx,
    onDoubleClick,
    ...(views ? { views } : {}),
  });
  return null;
}

/**
 * Registers the kit's default action set into this canvas's input scope.
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
  excludeActions,
  currentViewRef,
  onViewChange,
  resizeOptions,
  poseDescriptor,
  geometryProjection,
  dispatcher,
  getActionRef,
  pickEvery,
  layerIsPainted,
  alphaOf,
  viewportPanEnabled,
  viewportZoom,
  viewportPinchZoom,
  viewportRecenter,
  viewAnimation,
  editAnchorsExternalState,
  anchorEditingAllowed,
  poseComposition,
  layouts,
  layoutDropTarget,
  reflowTransition,
  insertNodeFactories,
  snapPoint,
  canvasRef,
  canvasApiRef,
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
  /** Kit-standard action ids this canvas's presets and tools leave out. */
  excludeActions: readonly string[];
  currentViewRef: React.RefObject<View>;
  onViewChange: (v: View) => void;
  /** Forwarded from `selectTool.resize` — wires the `resizePolicy` dep
   *  consumed by the dispatcher-path `resizeAction`. The legacy
   *  `useResizeTool` consumes the same options separately (both paths run
   *  in parallel during the dispatcher migration). */
  resizeOptions?: UseResizeOptions<unknown>;
  /** Forwarded from `SceneCanvasProps.poseDescriptor` — wires the
   *  `poseDescriptor` dep every built-in pose-touching action reads. */
  poseDescriptor: PoseDescriptor<unknown>;
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
  /** This canvas's own view gate for scene layers, published on the `view`
   *  dep and read by the selecting actions. Absent when it hides nothing. */
  layerIsPainted?: (layerId: string) => boolean;
  /** The composed paint alpha, when the consumer fades anything, so a region
   *  select passes over what is painted at zero. */
  alphaOf?: (id: string) => number;
  /** Resolved `viewport.pan` flag — default true, false to disable. */
  viewportPanEnabled: boolean | WheelPanOptions;
  /** Resolved `viewport.zoom` setting — `true` (default Cmd+wheel zoom),
   *  `false` (disabled), or a {@link ViewportZoomOptions} config. */
  viewportZoom: boolean | ViewportZoomOptions;
  /** Resolved `viewport.pinchZoom` setting — `true` (default two-finger pinch),
   *  `false` (disabled), or a {@link PinchZoomOptions} scale clamp. */
  viewportPinchZoom: boolean | PinchZoomOptions;
  /** Optional recenter callback. When supplied, wires through to the
   *  `view` dep so `viewport.zoom` reset (Cmd-0) calls it instead of
   *  snapping to identity. A returned `View` is a target the kit may
   *  animate to; `void` means the callback dispatched it itself. */
  viewportRecenter?: () => View | void;
  /** The canvas's camera runner, published on the `view` dep so
   *  `viewport.zoom`'s discrete branches can animate. */
  viewAnimation: ViewAnimationApi;
  /** Lifted edit-mode state so the `pathEditingOverlay` chrome (rendered
   *  outside this subtree) can read the same `editingId` the dep does. */
  editAnchorsExternalState: import('./deps/editAnchors').EditAnchorsStateRef;
  /** Present only when a mode registry is wired (`modes`); see
   *  `EditAnchorsDepOptions.anchorEditingAllowed` for why absence — not a
   *  predicate over an empty capability set — is the safe default. */
  anchorEditingAllowed?: () => boolean;
  /** Forwarded from `SceneCanvasProps` so the `layout` dep source can wire
   *  the per-container layout strategy lookup consumed by `moveAction`. */
  layouts?: SceneCanvasProps<unknown, string, unknown>['layouts'];
  layoutDropTarget?: LayoutDropTargetMode;
  reflowTransition?: ReflowTransition<unknown> | null;
  /** Forwarded from `SceneCanvasProps` so the marquee and lasso dep sources
   *  test where a node is drawn rather than where its pose is stored. */
  poseComposition?: SceneCanvasProps<unknown, string, unknown>['poseComposition'];
  /** Forwarded from `SceneCanvasProps` so `useInsertDepSource` can wire the
   *  consumer's per-kind node factories into the `insert` dep. */
  insertNodeFactories?: Record<string, InsertNodeFactory>;
  /** Forwarded from `SceneCanvasProps.toolOptions.snapPoint` so the `snap`
   *  dep source can expose grid snapping to `insertAction`. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
  /** The canvas element ref, so `useIngestionDepSource` can compute the
   *  visible world rect from the client rect + current view. */
  canvasRef: React.RefObject<HTMLElement | null>;
  /** The canvas handle, whose debug sink backs the `debug` dep. */
  canvasApiRef: React.RefObject<CanvasExtensionApi | null>;
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
  // opacity).
  useEffect(() => {
    if (!registry) return;
    return registry.setDispatcher(dispatcher);
  }, [registry, dispatcher]);

  // Populate the action-lookup ref so the dispatcher's getAction closure
  // can resolve action ids once the registry is in scope.
  useEffect(() => {
    if (!registry) return;
    getActionRef.current = (id: string) => registry.list().find((a) => a.id === id);
    return () => { getActionRef.current = null; };
  }, [registry, getActionRef]);

  // Momentum for `viewport.dragPan`. The loop must be a hook (it owns a
  // `useVisibleRaf`), so it is built here and republished on the view dep.
  const decayLoop = useDecayLoop();

  // Build the ViewApi (stable identity, refreshed closures) and hand it to
  // useStandardActions (which publishes the `view` dep along with selection,
  // scene, history, pointer, activeTool). `hostSize` reads the live canvas
  // element so keyboard zoom (Cmd+=/-) can anchor at the visible center.
  const view = useViewDepSource(
    currentViewRef,
    onViewChange,
    viewportRecenter,
    () => {
      const el = canvasRef.current;
      return el ? { width: el.clientWidth, height: el.clientHeight } : null;
    },
    viewAnimation,
    decayLoop,
    layerIsPainted,
  );
  useStandardActions({ selection, scene, view, history: scene.history, exclude: excludeActions });
  // A view overlays `view` with its own camera; this name it leaves alone.
  useDepSource('rootView', () => view);
  const pointer = usePointerContext();
  useDepSource('pointer', () => pointer ?? undefined);

  // viewport.pan / viewport.zoom are SceneCanvas-coupled (need the `view` dep
  // published just above), so they're registered here rather than in
  // KIT_STANDARD_DESCRIPTORS. Both default ON; consumer opts out via
  // `viewport={{ pan: false }}` / `viewport={{ zoom: false }}`.
  useViewportActions({ pan: viewportPanEnabled, zoom: viewportZoom, pinchZoom: viewportPinchZoom });

  // Per-dep wiring modules under `src/canvas/deps/`. See each file for the
  // dep's contract and trade-offs.
  useAreaSelectDepSource(scene, selection, poseDescriptor, poseComposition, alphaOf);
  useNodeAtPointDepSource(pickEvery);
  useLayoutDepSource(layouts, layoutDropTarget, reflowTransition);
  useInsertDepSource(scene, adapter, insertNodeFactories);
  useSliceDepSource(scene, selection, adapter, poseComposition);
  useSnapDepSource(snapPoint);
  useDebugDepSource(canvasApiRef);
  useIngestionDepSource(canvasRef, () => currentViewRef.current, ingestionResolveSrc, ingestionSvg, ingestionClipboard);
  useLassoSelectDepSource(scene, selection, poseDescriptor, poseComposition, alphaOf);
  useTextEditDepSource(scene);
  useEditAnchorsDepSource(scene, selection, adapter, editAnchorsExternalState, {
    anchorEditingAllowed,
  });
  useDispatcherDepSource(dispatcher);
  usePoseDescriptorDepSource(poseDescriptor);
  usePoseCompositionDepSource(poseComposition);

  // Keyed on the exclusion too: a re-registration of the standard set would
  // otherwise land over the overrides applied on top of it.
  useActionsPropResolver(actions, excludeActions.join('|'));

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
  useResizePolicy<unknown>(resizePolicyOptions(options));
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

// The canvas's input scope sits above `SceneCanvasInner`, whose own hooks
// (`useTools` among them) must already read this canvas's tool and registries.
function SceneCanvasWrapper<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return (
    <InputScope yoke={props.yoke}>
      <ViewRegistryProvider>
        <SceneCanvasInnerForwardRef {...(props as SceneCanvasProps<unknown, string, unknown>)} ref={ref} />
      </ViewRegistryProvider>
    </InputScope>
  );
}

/**
 * The canvas component: renders a `Scene` and wires the interaction stack
 * around it.
 *
 * Mounted bare it renders the scene, keeps a selection no input sets, and
 * runs a gesture dispatcher for whatever bindings the consumer adds. The
 * `features` presets turn the kit's behavior on — `features={['draw']}` is the
 * whole editor: tools, standard actions and their keys, selection chrome,
 * undo. This is the intended entry point; the lower-level primitives it
 * composes are not part of the public surface.
 *
 * Its ref exposes a `SceneCanvasApi` for the imperative operations that do not
 * fit a prop (view control, hit queries, redraw requests).
 */
export const SceneCanvas = forwardRef(SceneCanvasWrapper) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<SceneCanvasApi> },
) => ReturnType<typeof SceneCanvasInner>;
