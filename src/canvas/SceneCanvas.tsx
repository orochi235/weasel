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
import type React from 'react';
import type { ReactNode } from 'react';
import { type ActionsProp } from 'interactions/actions/registry';
import { useStandardActions } from 'interactions/actions/useStandardActions';
import type { DrawCommand, ShaderProgramHandle } from '../renderer';
import { textCommand } from 'features/text/textCommand';
import { findShapePainter } from './shapePainters';
import type { FillStyle } from 'core/paint-types';
import { Canvas } from './Canvas';
import type { CanvasProps, LayersMap, CanvasSelectionMode, SelectionOverlaySlotConfig } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import type { Animator } from '../animation/types';
import type { SceneToAdapterOptions } from './sceneAdapter';
import type { PanBounds } from 'core/viewport/useDecayLoop';
import type { View } from 'core/viewport/view';
import type { Node, Scene, SerializedScene } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import { sceneFromJSON } from 'core/scene/scene';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { usePublishSelection } from 'features/selection/SelectionContext';
import type { Bounds } from 'tools/builtin/useSelectTool';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/useSelectTool';
import { useTools, type ToolsApi } from 'tools/useTools';
import { useKeybindings } from 'tools/useKeybindings';
import type { AnyTool } from 'tools/types';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import type { UseAreaSelectOptions } from 'interactions/actions/area-select/options';
import { ActionsProviderIfRoot } from './SceneCanvas/ActionsProviderIfRoot';
import { PointerProviderIfRoot, PointerPublisher } from './SceneCanvas/PointerProviderIfRoot';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import { useHandTool } from 'tools/builtin/useHandTool';
import { usePreviewGhostLayer } from './SceneCanvas/usePreviewGhostLayer';
import { useDispatcherOverlayLayer } from './SceneCanvas/useDispatcherOverlayLayer';
import { createPenPreviewLayer } from 'features/paths/penPreviewLayer';
import type { PenScratch } from 'tools/builtin/usePenTool';
import type { Tool } from 'tools/types';
import { useBuiltinShapeTools, type BuiltinShapeToolId, type BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
export type { BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
import { DepRegistryProviderIfRoot } from './SceneCanvas/DepRegistryProviderIfRoot';
import {
  useViewDepSource,
  useAreaSelectDepSource,
  useNodeAtPointDepSource,
  useInsertDepSource,
  useLassoSelectDepSource,
  useTextEditDepSource,
  useEditAnchorsDepSource,
  useDispatcherDepSource,
  useResizePolicy,
} from './deps';
import { useActionsPropResolver } from './SceneCanvas/useActionsPropResolver';
import { useViewportActions } from './SceneCanvas/useViewportActions';
import { ActiveToolContextProviderIfRoot } from 'interactions/actions/activeToolContext';
import { useGestureDispatcher } from 'interactions/dispatcher/useGestureDispatcher';
import { createDispatcher, type Dispatcher } from 'interactions/dispatcher/dispatcher';
import { useActionsRegistry } from 'interactions/actions/registry';
import { buildAffordanceAt, buildClassifyTarget } from './affordanceAt';
import type { AnchorState } from './affordanceAt';
import type { Op } from 'core/ops/types';
import { useDepRegistry } from 'interactions/actions/depRegistry';
import { createNodeKindRegistry, type NodeKind } from '../core/scene/nodeKindRegistry';
import {
  createSelectionOverlayLayer,
} from 'features/selection/overlay';
import { firstPreviewPose, firstPreviewBounds } from './toolPreview';
import { makeGetNodeAtPoint } from './getNodeAtPoint';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';

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
  getGroup?(id: string): import('features/groups/types').Group | undefined;
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

const COORD_TRACE_LIMIT = 200;
const coordTrace: CoordTraceEntry[] = [];
const COORD_DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();
if (COORD_DEV && typeof window !== 'undefined') {
  (window as unknown as { __weaselCoordLog__: CoordTraceEntry[] }).__weaselCoordLog__ = coordTrace;
}
function recordCoordTrace(entry: CoordTraceEntry): void {
  if (!COORD_DEV) return;
  coordTrace.push(entry);
  if (coordTrace.length > COORD_TRACE_LIMIT) coordTrace.shift();
}

/** Default scene-slot `drawOne` — dispatches through the shape-painter
 *  registry (`./shapePainters`). The kit registers built-in painters for
 *  text (`kit:text`), paths (`kit:path`), and a rect-from-pose fallback
 *  (`kit:rect-fallback`) at module load, so every shape it ships out of
 *  the box (rect, ellipse, polygon, star, line, pen, pencil, text) paints
 *  without consumer intervention.
 *
 *  To teach the kit about a new kind of shape, register a painter — do
 *  not override `drawOne`. See `registerShapePainter` for the API and
 *  priority semantics. Override `drawOne` only for cross-cutting
 *  decoration (post-process every node, mix in overlays from outside
 *  the per-node data, etc.).
 *
 *  This function also emits an optional `data.label` overlay (sans-serif
 *  11px, top-left) on every non-text painter's output — a convenience
 *  for naming zones in demos. Nodes whose painter is `kit:text` skip the
 *  overlay since their content already shows. */
export function defaultDrawOne<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
): DrawCommand[] {
  const painter = findShapePainter(node);
  const primary = painter ? painter.paint(node, pose) : [];

  // Label overlay — skipped for text nodes (their content is the label).
  const data = node.data as { label?: string; text?: string } | null;
  if (data?.label && data.text == null) {
    const p = pose as unknown as { x: number; y: number };
    primary.push(textCommand(
      p.x + 6,
      p.y + 14,
      data.label,
      { fontFamily: 'sans-serif', fontSize: 11, fill: { fill: 'solid', color: 'rgba(0,0,0,0.7)' } },
    ));
  }

  // Auto-rotate when the pose carries a non-zero `rotation` field. Wraps
  // every emitted command in a single group transform around the AABB
  // center — covers RotatedPose-shaped scenes without per-demo drawOne
  // boilerplate. Painters and consumers that need different rotation
  // semantics (e.g. pivot at origin) can override `drawOne`.
  const p = pose as unknown as Partial<{ x: number; y: number; width: number; height: number; rotation: number }>;
  if (p.rotation && p.x != null && p.y != null && p.width != null && p.height != null) {
    return [{
      kind: 'group',
      transform: rotateAroundAABBCenter(p.x, p.y, p.width, p.height, p.rotation),
      children: primary,
    }];
  }
  return primary;
}

/** Compose `T(cx,cy) · R(θ) · T(-cx,-cy)` for the AABB center of `(x, y,
 *  width, height)` into a column-major 3×3 affine. Matches the
 *  `[a, b, 0, c, d, 0, tx, ty, 1]` layout `kind: 'group'` consumes. */
export function rotateAroundAABBCenter(
  x: number, y: number, width: number, height: number, rotation: number,
): Float32Array {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const cs = Math.cos(rotation);
  const sn = Math.sin(rotation);
  const a = cs, b = sn, c = -sn, d = cs;
  const tx = cx - a * cx - c * cy;
  const ty = cy - b * cx - d * cy;
  return new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
}

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
  standard: ['select', 'rotate', 'hand', 'rect', 'ellipse', 'line', 'pencil'],
  exhaustive: [
    'select', 'rotate', 'hand',
    'rect', 'ellipse', 'line', 'polygon', 'star', 'pen', 'pencil',
    'lasso', 'text',
  ],
};

export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<
    CanvasProps<Node<TData, TLayer, TPose>, TPose>,
    | 'adapter'
    | 'moveOptions' | 'resizeOptions' | 'rotateOptions'
    | 'snap' | 'pickEvery' | 'boundsOf' | 'handleHitRadius'
    | 'selection' | 'selectionOptions' | 'tools' | 'geometry'
    | 'layers'          // stripped so we can re-add as optional below
    | 'onBackgroundClick' // SceneCanvas synthesizes this; not a consumer prop
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
     * Node-kind classifiers — list of `NodeKind` entries. The kit constructs
     * a `NodeKindRegistry` per-`<SceneCanvas>` from this prop, then threads
     * the resulting classifier into `sceneToAdapter` so the synthesized
     * adapter exposes `kindOf(id)`. Tool routing tables (e.g.
     * `{ target: 'rect', actionId: 'move' }`) match against the produced
     * kind strings.
     *
     * Pass `defaultNodeKinds` to pick up the kit's built-in shape kinds
     * (rect, ellipse, polygon, …) for `data: { kind: '<shape>' }` nodes.
     * Spread additional entries for consumer-defined kinds.
     *
     * See `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`.
     *
     * **Memoize the `kinds` value.** The kit memoizes the registry on the
     * prop's reference identity. Passing a fresh array each render
     * (e.g. `kinds={[...defaultNodeKinds, custom]}` inline) rebuilds the
     * registry and cascades into a new adapter, churning gesture state.
     * Define the list as a module-level constant, or wrap it in `useMemo`.
     * (`defaultNodeKinds` alone is a stable module-level constant; spreading
     * it with extras is what needs the memo.)
     */
    kinds?: readonly NodeKind[];

    // --- Geometry: hit-test + bounds overrides consumed by the internal
    //     `useSelectTool`. Ignored if the consumer passes their own `tools`. ---
    geometry?: {
      pickEvery?: (worldX: number, worldY: number) => string | null;
      boundsOf?: (id: string) => Bounds | null;
    };

    // --- Select tool options. Ignored if the consumer passes their own
    //     `tools` prop. ---
    selectTool?: {
      move?: UseMoveOptions<TPose>;
      resize?: UseResizeOptions<TPose>;
      rotate?: UseRotateOptions<TPose>;
      snap?: SnapStrategy<TPose>;
      handleHitRadius?: number;
      /** Marquee area-select. Default: no behaviors (a drag from empty space
       *  doesn't mutate the selection). Pass
       *  `{ behaviors: [selectFromMarquee()] }` to enable rubber-band select. */
      areaSelect?: UseAreaSelectOptions;
    };

    // --- Insert tool: when `create` is supplied, the synthesized adapter
    //     exposes `commitInsert` and inserted objects are added as leaves on
    //     `layer` (default `'default'`). ---
    insertTool?: {
      create: SceneToAdapterOptions<TData, TLayer, TPose>['commitInsert'];
      layer?: TLayer;
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
     * Auto-wire `useKeybindings` against the active tool registry. Default
     * `true`. When `false`, SceneCanvas still mounts its tools but does not
     * subscribe to keybinding / hotkey events for them — leaving the
     * consumer free to call `useKeybindings(tools, { ... })` themselves
     * (e.g. with `disable`, `overrides`, or `defaultTool`).
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
     *    (`actions: { 'viewport.pan': null }`) also works and runs after this.
     *
     *  When omitted entirely, no hand/pinch tools are registered but the
     *  default wheel pan + Cmd+wheel/key zoom remain wired (canvas-first
     *  default). Pass `{ pan: false, zoom: false }` to opt out entirely. */
    viewport?: {
      inertia?: boolean | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce' | 'spring'; bounds?: PanBounds };
      pinchZoom?: boolean | { min?: number; max?: number };
      animatedZoom?: boolean | { duration?: number; resetDuration?: number; easing?: (t: number) => number };
      pan?: boolean;
      zoom?: boolean;
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
     * Dev HUD: when true (or object), mounts a fixed-position widget below
     * the pick HUD showing the active modality mode, active-slot tool, and
     * hotkey stack. Pass `{ modeId }` to populate the mode line.
     */
    modalityHud?: boolean | { modeId?: string };
  };

/** Discriminate the polymorphic `tools` prop: `ToolsApi` has `setActive`
 *  / `active` / `registry`; the patch record shape has none of those. */
function isToolsApi(
  tools: ToolsApi | Record<string, AnyTool | true | false>,
): tools is ToolsApi {
  return typeof (tools as ToolsApi).setActive === 'function';
}

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const {
    scene: sceneInput,
    geometry,
    selectTool: selectToolOpts,
    insertTool,
    layouts,
    kinds,
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
    modalityHud,
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

  // Adapter + select tool — folded into a single hook that synthesizes both.
  // Apply the DEFAULT_HANDLE_SIZE fallback here so useSceneSelectTool always
  // receives a concrete radius even when the caller omits selectTool entirely.
  const selectToolWithDefaults = useMemo(() => ({
    handleHitRadius: DEFAULT_HANDLE_SIZE,
    ...selectToolOpts,
  }), [selectToolOpts]);

  // Stable ref to the live selection; updated every render so the affordanceAt
  // and classifyTarget thunks (which live in an effect closure) always read
  // the latest selection without causing re-renders.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  // Build a per-instance NodeKindRegistry from the `kinds` prop and expose its
  // classify() so `sceneToAdapter` can publish `kindOf(id)`. When `kinds` is
  // absent or empty the classifier is undefined and the adapter omits kindOf
  // (callers without routing-by-kind needs aren't taxed).
  const kindClassifier = useMemo(() => {
    if (!kinds || kinds.length === 0) return undefined;
    const registry = createNodeKindRegistry();
    for (const k of kinds) registry.register(k);
    return (data: TData) => registry.classify(data);
  }, [kinds]);

  const { adapter, selectTool: internalSelect, rotateTool, pickEvery: internalPickEvery, pickBest: internalPickBest, boundsOf: internalBoundsOf } = useSceneSelectTool({
    scene,
    selection,
    geometry,
    selectTool: selectToolWithDefaults,
    ...(insertTool ? { insertTool } : {}),
    ...(layouts ? { layouts } : {}),
    ...(kindClassifier ? { kindOf: kindClassifier } : {}),
  });

  // Build getNodeAtPoint from the adapter + internalPickEvery. Canvas no longer
  // synthesizes this itself — it accepts it as a prop (Phase 4.1 seam refactor).
  // The node resolver reads adapter.kindOf (set from kindClassifier when kinds
  // are registered), getPose, and getNode, matching the old Canvas synthesizer
  // algorithm exactly (see src/canvas/getNodeAtPoint.ts).
  const getNodeAtPoint = useMemo(() => {
    if (!internalPickEvery) return undefined;
    const nodeResolver = (id: string) => {
      const kind = (adapter as typeof adapter & { kindOf?: (id: string) => string }).kindOf?.(id) ?? 'unknown';
      const pose = adapter.getPose(id);
      const data = (adapter as typeof adapter & { getNode?: (id: string) => unknown }).getNode?.(id) ?? { id };
      return { kind, pose, data };
    };
    return makeGetNodeAtPoint(internalPickEvery, nodeResolver);
  }, [adapter, internalPickEvery]);

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
  // viewport.zoom descriptors via the gesture dispatcher (Phase 8.5).
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
        if (import.meta.env?.DEV) {
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

  // WHY ambient (not registry) for rotate: `useTools.getActiveOverlays()`
  // returns only active + hotkey + ambient overlays. The Canvas affordance
  // pipeline (`__setHitTestContext`) walks those exclusively, so a registry
  // entry that is neither active nor ambient would never have its hitTest
  // routed. Rotate is affordance-driven (no foreground activation, no
  // hotkey), so ambient is the correct slot. Resize is handled entirely
  // through the dispatcher-side `resizeAction` + `resizePolicy` dep — no
  // ambient tool is mounted for it.
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
        if (import.meta.env?.DEV && id in internalRegistry) {
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
    active: 'select',
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
  useKeybindings(internalTools, { disable: !!toolsTakeover || !enableKeybindings });
  useKeybindings(toolsTakeover ?? internalTools, {
    disable: !toolsTakeover || !enableKeybindings,
  });

  const tools = toolsTakeover ?? internalTools;

  // Surface the resolved ToolsApi to the introspection callback (the
  // toolkit-builder dev surface uses this to walk `tools.registry` for
  // its live route table). Fires whenever the `tools` identity changes,
  // which is stable across most renders thanks to useTools' useMemo.
  const onToolsCreatedRef = useRef(onToolsCreated);
  onToolsCreatedRef.current = onToolsCreated;
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools]);

  // (Legacy `gestures` prop removed alongside the consumer-facing action
  // hooks; undo/redo and friends now register via the Actions Registry.)

  // Merge caller-supplied layers with kit defaults. When `layers` is omitted
  // the result is the full default set (scene + selectionOverlay). Partial
  // configs deep-merge; `null` slot values suppress a default explicitly.
  const mergedLayers = useMemo(
    () => mergeLayersWithDefaults(layers),
    [layers],
  );

  // Shared `Dispatcher` instance — created once per `<SceneCanvas>` and
  // threaded to both the gesture-dispatcher mounter (which pumps input
  // events into it) and the preview-ghost layer (which walks its
  // `getInFlightHandles()` for dispatcher-side gesture previews). Lazy
  // ref init keeps identity stable across renders without an effect.
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = createDispatcher();
  }
  const dispatcher = dispatcherRef.current;

  // Preview-ghost layer: renders in-flight gesture poses on top of the
  // committed scene using the scene slot's `drawOne`. Walks both the
  // tools registry and the dispatcher's in-flight handles (Phase 14e).
  const previewLayer = usePreviewGhostLayer<TData, TLayer, TPose>({
    scene,
    tools,
    sceneSlot: mergedLayers.scene,
    dispatcher,
  });

  // Dispatcher-driven chrome overlays — marquee rect + lasso polyline +
  // any other `OngoingHandle.overlay()` shapes the in-flight actions
  // publish. Screen-space; slotted after the preview-ghost so chrome
  // paints on top of any displaced ghost silhouettes. Phase 14e.2.5.
  const dispatcherOverlay = useDispatcherOverlayLayer({ dispatcher });

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

  // Selection overlay — constructed here (scene-aware) so Canvas receives a
  // pre-built RenderLayer via `layers.selectionOverlay` rather than a config
  // it would wire up itself. Canvas still owns the slot definition and render
  // ordering; SceneCanvas owns the factory call.
  //
  // Reconstructed when selection, bounds, or tools change (mirrors Canvas's
  // own useMemo dep list for the equivalent block).
  const selectedIds = selection.current;
  const multiActive = selectedIds.length > 1;
  const selectionOverlayLayer = useMemo(() => {
    const selCfg = mergedLayers.selectionOverlay as
      | SelectionOverlaySlotConfig<TPose>
      | null
      | undefined;
    if (selCfg === null) return null;
    const cfg = (selCfg ?? {}) as SelectionOverlaySlotConfig<TPose>;

    // Pose resolver: tools preview wins (tracks in-flight drag pose), then
    // dispatcher in-flight handles (dispatcher-path actions), then multi-union
    // AABB synthesis, then adapter committed pose.
    const poseById =
      cfg.poseById ??
      ((id: string): TPose | null => {
        // Tool preview (legacy tool channel) wins.
        const tp = firstPreviewPose(tools, id) as TPose | null;
        if (tp != null) return tp;
        // Dispatcher-path preview pose.
        for (const handle of dispatcher.getInFlightHandles()) {
          const dp = handle.previewPose?.(id);
          if (dp != null) return dp as TPose;
        }
        // Tool preview bounds (pre-projected, used for multi-union and the
        // MULTI_RESIZE_TARGET_ID synthetic handle).
        const tb = firstPreviewBounds(tools, id);
        if (tb != null) return tb as unknown as TPose;
        // Multi-union fallback: when no tool synthesizes the multi-resize id,
        // compute union AABB from the live selection ourselves.
        if (multiActive && id === MULTI_RESIZE_TARGET_ID && internalBoundsOf) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          let any = false;
          for (const sid of selectedIds) {
            const b = internalBoundsOf(sid);
            if (!b) continue;
            any = true;
            if (b.x < minX) minX = b.x;
            if (b.y < minY) minY = b.y;
            if (b.x + b.width > maxX) maxX = b.x + b.width;
            if (b.y + b.height > maxY) maxY = b.y + b.height;
          }
          if (any) {
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY } as unknown as TPose;
          }
          return null;
        }
        // Committed adapter pose (or internalBoundsOf fallback when no adapter).
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

    return createSelectionOverlayLayer<TPose>({
      ...cfg,
      getSelection,
      ...(getOutlineIds ? { getOutlineIds } : {}),
      getPose: poseById,
      getBounds:
        cfg.getBounds ??
        ((p: TPose): Bounds => {
          // Multi-union path returns pre-projected Bounds masquerading as TPose.
          if (multiActive) return p as unknown as Bounds;
          return AUTO_POSE_DESCRIPTOR.getBounds(p) as Bounds;
        }),
    });
  }, [mergedLayers.selectionOverlay, selectedIds, multiActive, internalBoundsOf, tools, adapter]);

  const wiredLayers = useMemo<LayersMap<Node<TData, TLayer, TPose>, TPose>>(() => ({
    ...mergedLayers,
    // Pass the pre-built selection overlay layer so Canvas receives a
    // CustomLayerEntry and skips its own factory construction for this slot.
    selectionOverlay: selectionOverlayLayer
      ? { layer: selectionOverlayLayer }
      : mergedLayers.selectionOverlay === null ? null : undefined,
    previewGhost: { layer: previewLayer, after: 'scene' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'previewGhost' },
    ...(penPreviewLayer ? { penPreview: { layer: penPreviewLayer, after: 'dispatcherOverlay' } } : {}),
  }), [mergedLayers, selectionOverlayLayer, previewLayer, dispatcherOverlay, penPreviewLayer]);

  // Standard-action deps: closures over the live scene / selection / adapter
  // so the resolved actions always read current state. `useStandardActions`
  // stabilizes via refs internally — these closures are passed every render
  // but the registered Action descriptors are not re-registered.
  // Merge the forwarded ref with our internalCanvasRef so usePinchZoomTool
  // can read the canvas element even when the consumer also forwards a ref.
  const mergedRef = useCallback(
    (node: CanvasExtensionApi | null) => {
      internalCanvasRef.current = node?.element ?? null;
      canvasApiRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<CanvasExtensionApi | null>).current = node;
    },
    [ref],
  );

  const canvas = (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={mergedRef}
      adapter={adapter}
      selection={selection}
      tools={tools}
      layers={wiredLayers}
      pickEvery={internalPickEvery}
      getNodeAtPoint={getNodeAtPoint}
      previewIdsExtra={() => {
        // Mirror usePreviewGhostLayer: walk the dispatcher's in-flight
        // OngoingHandles and merge each handle's previewIds() so source
        // ids being ghosted by dispatcher-path actions (move, clone,
        // rotate, etc.) get their committed paint hidden under the
        // ghost. Without this, post-Phase-14e-Task-3 the originals
        // would bleed through during drag.
        const out: string[] = [];
        for (const handle of dispatcher.getInFlightHandles()) {
          const ids = handle.previewIds?.();
          if (!ids) continue;
          for (const id of ids) out.push(id);
        }
        return out;
      }}
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
            actions={actions}
            currentViewRef={currentViewRef}
            onViewChange={handleViewChange}
            resizeOptions={selectToolOpts?.resize as UseResizeOptions<unknown> | undefined}
            dispatcher={dispatcher}
            pickEvery={internalPickEvery}
            viewportPanEnabled={viewport?.pan !== false}
            viewportZoomEnabled={viewport?.zoom !== false}
          />
          <GestureDispatcherMounter
            canvasRef={internalCanvasRef}
            canvasApiRef={canvasApiRef}
            tools={tools}
            enabled={enableGestureDispatcher}
            selectionRef={selectionRef}
            boundsOf={internalBoundsOf}
            pickEvery={internalPickEvery}
            viewRef={currentViewRef}
            dispatcher={dispatcher}
          />
          {children}
        </ActionsProviderIfRoot>
      </PointerProviderIfRoot>
    </DepRegistryProviderIfRoot>
  );
}

/**
 * Mounts the gesture dispatcher inside `<ActionsProviderIfRoot>` so it can
 * read the live registry. Phase 14e Task 2.6: the dispatcher is now
 * unconditionally present in every `<SceneCanvas>` tree; the
 * `DispatcherPresenceProvider` context (and `useIsDispatcherMounted` hook)
 * have been removed.
 *
 * Phase 13: accepts `selectionRef`, `boundsOf`, `pickEvery`, and `viewRef` so
 * it can wire `affordanceAt` + `classifyTarget` thunks into the dispatcher.
 * These thunks convert client coords → world coords via the canvas rect + view,
 * then classify the pointer position against affordances and scene bodies.
 */
function GestureDispatcherMounter({
  canvasRef,
  canvasApiRef,
  tools,
  enabled,
  selectionRef,
  boundsOf,
  pickEvery,
  viewRef,
  dispatcher,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Holds the full `CanvasExtensionApi` so the gesture dispatcher can call
   *  `requestRedraw()` between pointer events. */
  canvasApiRef?: React.RefObject<CanvasExtensionApi | null>;
  tools: ToolsApi;
  enabled: boolean;
  selectionRef?: React.RefObject<import('core/selection/useSelection').SelectionApi>;
  boundsOf?: (id: string) => import('core/viewport/fitViewToBounds').Bounds | null;
  pickEvery?: (worldX: number, worldY: number) => string[];
  viewRef?: React.RefObject<View>;
  /** Pre-created dispatcher to pump events into. When omitted,
   *  `useGestureDispatcher` creates one internally (legacy path). */
  dispatcher?: Dispatcher;
}) {
  const registry = useActionsRegistry();
  const depRegistry = useDepRegistry();
  const toolsById = useMemo<ReadonlyMap<string, AnyTool>>(() => {
    const m = new Map<string, AnyTool>();
    for (const [id, tool] of Object.entries(tools.registry)) {
      m.set(id, tool);
    }
    return m;
  }, [tools.registry]);

  // Stable refs for the optional thunk inputs so the thunks themselves are
  // stable function identities across renders (no need to pass them as deps).
  const boundsOfRef = useRef(boundsOf);
  boundsOfRef.current = boundsOf;
  const pickEveryRef = useRef(pickEvery);
  pickEveryRef.current = pickEvery;

  // `getAnchorState` thunk for `buildAffordanceAt` (Phase 14b).
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
      getPose: dep.getPose,
    };
  }, []);

  // Build the `affordanceAt` thunk. Converts client coords → world coords
  // internally, then delegates to `buildAffordanceAt` for handle hit-testing.
  const affordanceAt = useMemo(() => {
    if (!selectionRef || !boundsOf || !viewRef) return undefined;
    return buildAffordanceAt(
      () => {
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
      undefined,
      undefined,
      getAnchorState,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRef, boundsOf, viewRef, getAnchorState]);

  // Build the `classifyTarget` thunk. Converts client coords → world coords
  // internally using the canvas rect + view, then delegates to `buildClassifyTarget`.
  const classifyTarget = useMemo(() => {
    if (!selectionRef || !pickEvery || !viewRef) return undefined;
    return buildClassifyTarget(
      () => selectionRef.current?.current ?? [],
      (wx: number, wy: number) => {
        const ids = pickEveryRef.current?.(wx, wy) ?? [];
        return ids.length > 0 ? ids[ids.length - 1] : null;
      },
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
    const world = {
      x: (clientX - rect.left) / view.scale.x + view.x,
      y: (clientY - rect.top) / view.scale.y + view.y,
    };
    recordCoordTrace({
      ts: Date.now(), clientX, clientY,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      view: { x: view.x, y: view.y, scaleX: view.scale.x, scaleY: view.scale.y },
      world, fallback: false,
    });
    return world;
  }, [canvasRef, viewRef]);

  const wrappedAffordanceAt = useMemo(() => {
    if (!affordanceAt) return undefined;
    return (screenPoint: { x: number; y: number }) => {
      const worldPoint = clientToWorld(screenPoint.x, screenPoint.y);
      return affordanceAt(worldPoint);
    };
  }, [affordanceAt, clientToWorld]);

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

  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById,
    enabled,
    affordanceAt: wrappedAffordanceAt,
    classifyTarget: wrappedClassifyTarget,
    dispatcher,
    clientToWorld,
    requestRedraw,
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
  dispatcher,
  pickEvery,
  viewportPanEnabled,
  viewportZoomEnabled,
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
  /** Forwarded so `cancelGestureAction` and other actions that need to
   *  abort in-flight handles can read the dispatcher's control surface. */
  dispatcher: Dispatcher;
  /** World-space picker forwarded so the `nodeAtPoint` dep source can
   *  reuse the same hit-test plumbing the tool dispatcher uses. */
  pickEvery: (worldX: number, worldY: number) => string[];
  /** Resolved `viewport.pan` flag — default true, false to disable. */
  viewportPanEnabled: boolean;
  /** Resolved `viewport.zoom` flag — default true, false to disable. */
  viewportZoomEnabled: boolean;
}) {
  // Build the ViewApi (stable identity, refreshed closures) and hand it to
  // useStandardActions (which publishes the `view` dep along with selection,
  // scene, history, pointer, activeTool).
  const view = useViewDepSource(currentViewRef, onViewChange);
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
  useViewportActions({ pan: viewportPanEnabled, zoom: viewportZoomEnabled });

  // Per-dep wiring modules under `src/canvas/deps/`. See each file for the
  // dep's contract and trade-offs.
  useAreaSelectDepSource(scene, selection);
  useNodeAtPointDepSource(pickEvery);
  useInsertDepSource(scene, adapter);
  useLassoSelectDepSource(scene, selection);
  useTextEditDepSource(scene);
  useEditAnchorsDepSource(scene, selection, adapter);
  useDispatcherDepSource(dispatcher);

  useActionsPropResolver(actions);

  // Gate the `resizePolicy` dep registration on the consumer having
  // passed `selectTool.resize`. When absent, consumers wire it via a child
  // component (see PointSnapDemo / GroupsDemo). Registering empty defaults
  // here would race with child-component registrations — React runs child
  // effects before parent effects, so the parent's empty default would
  // overwrite the child's real value. The conditional mount avoids that.
  return resizeOptions ? <ResizePolicyRegistrar options={resizeOptions} /> : null;
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
  ref: React.ForwardedRef<CanvasExtensionApi>,
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
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<CanvasExtensionApi> },
) => ReturnType<typeof SceneCanvasInner>;
