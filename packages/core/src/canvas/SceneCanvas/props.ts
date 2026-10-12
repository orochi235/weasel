import type { ModeRegistry } from '@weasel-js/modes';
import type { FillStyle } from '@weasel-js/paint';
import type { ActionsProp } from '@weasel-js/routing';
import { Yoke } from '@weasel-js/routing/react';
import type { PasteOmission } from 'core/adapters/types';
import type { Op } from 'core/ops/types';
import type { Node, NodeId, Scene, SerializedScene } from 'core/scene/types';
import type { SelectionApi, UseSelectionOptions } from 'core/selection/useSelection';
import type { BuiltinShapeToolId } from 'core/shapeKinds';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
import type { PanBounds } from 'core/viewport/useDecayLoop';
import type { View } from 'core/viewport/view';
import type {
  ContentHandlerEntry
} from 'features/ingestion';
import type { PinchZoomOptions } from 'interactions/actions/defaults/pinchZoom';
import type { WheelPanOptions } from 'interactions/actions/defaults/viewportWheelPan';
import type { ViewportZoomAnimateOptions, ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';
import type { SvgIngestOptions } from 'interactions/actions/depSchema';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import type { ReactNode } from 'react';
import type { Bounds } from 'tools/builtin/select';
import type { Animator } from '@weasel-js/animator';
import { HANDLE_BASE_PX, targetSizesPx } from '../../core/device/targets';
import type { DeviceProfile } from '../../core/device/types';
import type { NodeRoutingEntry } from '../../core/scene/NodeRouting';
import type { DebugConfig } from '../../debug/types';
import type { LayoutDropTargetMode, ReflowTransition } from '../../layout/types';
import type { DrawCommand, ShaderProgramHandle } from '@weasel-js/renderer';
import type { AnyTool } from '../../tools/overlayBinding';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasProps, LayersMap, SceneSlotConfig } from '../Canvas';
import type { CanvasViewProps } from '../CanvasView';
import { defaultDrawOne, defaultPaintBounds, paintBoundsFor } from '../defaultDrawOne';
import type {
  InsertNodeFactory,
  InsertPaint
} from '../deps';
import type { SceneToAdapterOptions } from '../sceneAdapter';
import type { SurfaceContribution } from '../surfaceContribution';
import type {
  Feature
} from './features';
import type { BuiltinToolOptions } from './useBuiltinShapeTools';
import type { VersionCheck } from './useContributionRoles';

/**
 * Minimal adapter surface the legacy bridge factories need for delete /
 * duplicate / group / ungroup. Extracted from `SceneCanvasAdapter` to avoid
 * threading the full generic type through `StandardActionsRegistrar` (which is
 * non-generic). The actual adapter supplied is always a `SceneCanvasAdapter`
 * so the cast is safe.
 */
export interface BridgeAdapter {
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

/**
 * `import.meta.env.DEV`, read through a cast rather than off a typed
 * `ImportMeta`. Core must not depend on a bundler's ambient augmentation
 * (`vite/client`) to compile — until core moved into `packages/core/`, two
 * call sites below read `import.meta.env` bare and only type-checked because
 * `apps/site/vite-env.d.ts` leaked its `/// <reference types="vite/client" />`
 * into the shared root-tsconfig program. Isolating core's build surfaced it.
 * Mirrors the same cast in dispatcher.ts and buildDeps.ts.
 */
/** `<SceneCanvas longPress>`. */
export interface SceneCanvasLongPress {
  /**
   * Shown while a long-press is held and some binding would fire on it.
   * Default: a ring that fills around the press point
   * (`createLongPressFeedbackContribution()`), static under
   * `prefers-reduced-motion`. `false` shows nothing; a contribution replaces
   * it, reading the `longPress` dep. Installed beside `ambient`, so under a
   * `tools` takeover add it to your own `useTools` call instead.
   */
  feedback?: boolean | SurfaceContribution;
  /** Default true. A long-press some binding handled pulses
   *  `navigator.vibrate` briefly, for touch and pen, where the API exists. */
  haptics?: boolean;
  /** Hold time in ms. Default `LONG_PRESS_MS` (500). */
  duration?: number;
}

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
export const NON_SHAPE_BUILTIN_TOOLS: readonly Exclude<BuiltinToolId, BuiltinShapeToolId>[] = ['select', 'hand'];

/** Every built-in tool id, shape tools included. */
export const BUILTIN_TOOL_IDS: readonly BuiltinToolId[] = [...NON_SHAPE_BUILTIN_TOOLS, ...KIT_SHAPE_KINDS];

/** Minimal hit descriptor passed to `onDoubleClick`. Contains the fields
 *  modality dispatch needs; extends as the kit's `Hit` type evolves. */
export interface SceneCanvasHit {
  id: string;
  kind: string;
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

    /** Layout strategies keyed by container node id (or a resolver), for
     *  containers whose scene node declares none (`ContainerNode.layout`
     *  wins). Applied to a drag and to every other change to their children,
     *  through the scene's layout pass. */
    layouts?: SceneToAdapterOptions<TData, TLayer, TPose>['layouts'];

    /** Which layout container a drag lands in when several contain the drop
     *  point — the innermost (default), the topmost in paint order, or only
     *  containers whose strategy declares a `dropRegion`. Decides both the
     *  drag-time reflow preview and the commit. */
    layoutDropTarget?: LayoutDropTargetMode;

    /** Carries the siblings a layout reflow displaces to their slots over time
     *  instead of snapping them — `useAnimatedReflow` builds one. Covers a
     *  drag's reflow and every one the scene records (an insert, delete,
     *  reorder or resize inside a laid-out container). Absent or `null`,
     *  they snap. */
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
    //     `move`, `snap`, `resize` and `rotate` configure the `move`,
    //     `resize` and `rotate` presets, and apply either way. ---
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

    /** The fill and stroke a kit-built shape is inserted with, by tool `kind`
     *  and insert count; the kit keeps the geometry. Default
     *  `paletteInsertPaint`, the kit palette in turn. A kind with a factory in
     *  `insertNodeFactories` is not asked. */
    insertPaint?: InsertPaint;

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
     *  `clipboard` also governs Cmd/Ctrl+V under the `edit` preset; the rest
     *  takes the `ingest` preset.
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
        /** Called when a paste left copied nodes out, with each one and the
         *  reason. `useClipboardOps` takes the same callback as
         *  `onPasteOmitted` for a paste from its own in-memory copy. */
        onOmitted?: (omitted: PasteOmission[]) => void;
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
     * - `select` — the select tool, as the initial active tool and Escape's
     *   return target: click to pick, drag on empty to marquee, click on empty
     *   to clear.
     * - `outline` — the selection outline, whichever tool sets the selection.
     * - `pick` — `select` and `outline`.
     * - `move` — drag a body to move it, Alt-drag to clone it. Ambient, so it
     *   runs under any tool that does not claim the drag.
     * - `resize` — resize handles, drawn and bound.
     * - `rotate` — the rotation handle, drawn and bound.
     * - `transform` — `resize` and `rotate`.
     * - `edit` — undo/redo, delete, duplicate, group/ungroup, nudge,
     *   select-all, Escape, cancel-gesture, cut/copy/paste, fill and stroke,
     *   and their keys. Cmd/Ctrl+V pastes nodes a kit canvas copied, from
     *   this tab or another, and nothing else.
     * - `arrange` — align, distribute, reorder, flip.
     * - `paths` — pathfinder operations, path-edit entry and anchor editing.
     * - `ingest` — dropped and pasted content: images, SVG, files, and
     *   whatever `ingestion.handlers` accept, on Cmd/Ctrl+V or an OS drop.
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
     * Take the keyboard on mount, as a press in the canvas would. A key that
     * reaches the page goes to the canvas the user last pressed or scrolled
     * in, and to no canvas before the first such interaction, so a canvas in a
     * side panel does not take Space from a page that wants it. An app whose
     * canvas is the page sets this so its shortcuts work before the first
     * click. Default `false`.
     */
    claimKeys?: boolean;

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

    /** What an entry's `requires` does when the running kit does not meet
     *  it: `'warn'` (the default) logs in development, `'strict'` throws,
     *  `'off'` skips the check. */
    versionCheck?: VersionCheck;

    /** Touch and pen long-press: its hold time, its haptic, and the
     *  feedback shown while it is held. */
    longPress?: SceneCanvasLongPress;

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
    /** Called on every click — a press and release without a drag — with the
     *  node under it, or `null` on empty canvas. Fires after the click's own
     *  behavior, so a pick it made is already in the selection, and fires
     *  again on a node that was already picked. */
    onClick?: (hit: SceneCanvasHit | null) => void;
  };
