import type { ModeRegistry } from '@weasel-js/modes';
import type { PathEditHost, PathEditOpening } from './pathEditHost';
import type { SceneCanvasGeometry } from './geometryProps';
import type { SceneCanvasHit, SceneCanvasPointerProps } from './pointerProps';
import type { Paint } from '@weasel-js/paint';
import type { SceneCanvasActionProps } from './actionProps';
import type { SceneCanvasIngestion } from './ingestionProps';
import type { SceneCanvasSelectTool } from './selectToolProps';
export type { SceneCanvasIngestion } from './ingestionProps';
export type { SceneCanvasSelectTool } from './selectToolProps';
import type { SceneCanvasLongPress } from './longPressProps';
import type { SceneCanvasSampleProps } from './sampleProps';
export type { SceneCanvasLongPress } from './longPressProps';
import { Yoke } from '@weasel-js/routing/react';
import type { Op } from 'core/ops/types';
import type { Node, Scene, SerializedScene } from 'core/scene/types';
import type { SelectionApi, UseSelectionOptions } from 'core/selection/useSelection';
import type { SceneCanvasSnap } from 'domains/snap/types';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { ReactNode } from 'react';
import type { Animator } from '@weasel-js/animator';
import type { PoseTransitionSeat } from '../../animation/poseTransition';
import { HANDLE_BASE_PX } from '../../core/device/targets';
import type { DeviceProfile } from '../../core/device/types';
import type { NodeRoutingEntry } from '../../core/scene/NodeRouting';
import type { DebugConfig } from '../../debug/types';
import type { LayoutDropTargetMode, ReflowTransition } from '../../layout/types';
import type { FlattenTolerance, ShaderProgramHandle } from '@weasel-js/renderer';
import type { Tool, ToolsApi } from '../../tools/overlayBinding';
import type { SceneSlotConfig } from '../buildSceneLayer';
import type { CanvasProps } from '../Canvas';
import type { LayersMap } from '../layerSlots';
import type { CanvasViewProps } from '../CanvasView';
import type { InsertNodeFactory } from '../deps';
import type { SurfaceContribution } from '../surfaceContribution';
import type { SceneCameraProps } from './sceneViewBounds';
import type { FeatureEntry } from './features';
import type { BuiltinToolOptions } from './useBuiltinShapeTools';
import type { VersionCheck } from './useContributionRoles';
import type { SceneCanvasViewport } from './viewportProp';

/** The adapter surface delete / duplicate / group / ungroup need, narrowed from
 *  `SceneCanvasAdapter` because `useSceneStandardActions` is non-generic. */
export interface BridgeAdapter {
  applyOps(ops: Op[], label?: string): void;
  insertNode(node: { id: string; [k: string]: unknown }): void;
  removeNode(id: string): void;
  setSelection(ids: string[]): void;
}

/** Default size in CSS pixels for selection corner-handles AND their
 *  hit-test radius, at `targetScale = 1`. Deliberately unscaled; kit-internal
 *  use sites multiply by `DeviceProfile.targetScale`. */
export const DEFAULT_HANDLE_SIZE = HANDLE_BASE_PX;

/** `<SceneCanvas layers>`: a {@link LayersMap} whose scene slot may be partial,
 *  since the defaults fill in whatever it leaves out. */
export type SceneCanvasLayers<TNode extends { id: string }, TPose> = LayersMap<
  TNode,
  TPose,
  Partial<SceneSlotConfig<TNode, TPose>>
>;

import type { BuiltinToolId } from './builtinToolSets'; import type { SceneCanvasPaintedBy } from './workerProps';
import type { ToolEntry } from '@weasel-js/routing';
export { BUILTIN_TOOL_IDS, type BuiltinToolId } from './builtinToolSets';

export type { SceneCanvasHit };

/** Props for `<SceneCanvas>`. A scene is the only thing it needs. With nothing
 *  else it renders that scene and keeps a selection no input sets; `features`
 *  turns behavior on by preset, and the rest configures what those turn on. */
export type SceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<
    CanvasProps<TPose>,
    | 'adapter' | 'boundsOf' | 'selection' | 'tools'
    | 'viewState'       // SceneCanvas makes the camera from the view props below
    | 'layers'          // stripped so we can re-add as optional below
    | 'getIsVisible'    // SceneCanvas synthesizes this from chromeVisibility
    | 'contentVersion'  // SceneCanvas wires this to the scene's own version
    | 'layerVisibility' | 'layerOrder' // re-declared below: they gate picking here too
    | 'debug' | 'worker' // `debug` re-declared below with `slops`; `worker` in `SceneCanvasPaintedBy`
  > & SceneCameraProps
  & {
    /** A `Scene` (typically from `useScene`) — or a `SerializedScene` JSON
     *  object, which SceneCanvas bakes into a Scene on first render. The
     *  serialized form is read once; pass a `key` on `<SceneCanvas>` to force
     *  a fresh canvas from updated JSON.
     *
     *  The JSON shape is relaxed (`version: number` rather than the `1`
     *  literal) so an `import json from './x.json'` result satisfies the type
     *  without an `as` cast. */
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

    /** Glides what is shown when the scene writes a pose — a `scene.setPose`, an undo — and sees
     *  removed nodes off with `exit`. Absent or `null`, writes snap. See {@link PoseTransitionSeat}. */
    poseTransition?: PoseTransitionSeat<TPose> | null;

    /**
     * Lets pose-transform actions (move, resize, nudge, flip — NOT rotate) also rewrite a
     * node's data-held geometry: `transform(node, m, change)` returns updated `data`, or
     * `null` for nodes with no data-held geometry. When absent, the kit emits only the pose
     * op and leaves `data` untouched.
     *
     * @see GeometryProjection
     */
    geometryProjection?: GeometryProjection;

    /**
     * Routing-trait classifiers. The kit builds a `NodeRouting` registry per `<SceneCanvas>`
     * from this prop and uses it to derive each hit's `kind`, which tool routing tables
     * (e.g. `{ target: 'rect', actionId: 'move' }`) match against. Default
     * `inferredNodeRouting`: groups, boolean groups, and data shaped as text, a path or an
     * image. A list given here replaces it, so add consumer kinds by spreading it
     * (`[...inferredNodeRouting, mine]`), or `defaultNodeRouting` for data carrying a
     * `kind` tag. An empty list routes every hit as `'unknown'`.
     *
     * **Memoize the `routing` value.** The registry is memoized on the prop's reference
     * identity: a fresh array each render rebuilds it and cascades into a new adapter,
     * churning gesture state.
     */
    routing?: readonly NodeRoutingEntry[];

    /** How to read and rewrite this scene's poses. Every built-in action,
     *  the selection chrome and picking read it. Default `AUTO_POSE_DESCRIPTOR`
     *  (rect poses and `Path` poses). */
    poseDescriptor?: PoseDescriptor<TPose>;

    // --- Geometry: hit-test + bounds overrides for the surface's picking,
    //     hover, clicks, chrome and actions, whatever `tools` it runs. ---
    geometry?: SceneCanvasGeometry;

    /** The select tool's options, and the move, resize and rotate presets'. See {@link SceneCanvasSelectTool}. */
    selectTool?: SceneCanvasSelectTool<TPose>;

    /** Consumer node factories for the `insert` action, keyed by tool `kind`.
     *  Each factory receives the drag AABB + tool `extras` and returns the
     *  node's `data` (in this canvas's own data shape) plus an optional `pose`.
     *  A factory for a kit kind (`rect`, `line`, …) replaces the kit's default
     *  `{ path, fill }` node for that kind; a factory for a novel kind (e.g.
     *  `text`) adds insert support the kit doesn't ship. The dep supplies id,
     *  layer, and the undoable op. Return `null` to reject an insert. */
    insertNodeFactories?: Record<string, InsertNodeFactory>;

    /** External-content ingestion: OS drop, clipboard paste, the file picker. See {@link SceneCanvasIngestion}. */
    ingestion?: SceneCanvasIngestion;

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
     * Click policy (whether Cmd-click toggles and Shift-click ranges) is the selection's `mode`:
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
     * - `whiteboard` — `view`, `pick`, `move`, `resize` and `edit`, with the
     *   pencil, text and sticky-note tools.
     * - `tools:select`, `tools:view`, `tools:shape`, `tools:draw`,
     *   `tools:type`, `tools:page` — a built-in tool set and nothing else.
     *
     * The parts of `edit`, `arrange` and `paths` are names of their own
     * (`nudge`, `clipboard`, `align`, `pathfinder`, …), for a canvas that
     * wants one without the rest; `SCENE_CANVAS_FEATURES` lists every name.
     *
     * Any `FeaturePreset` object goes beside the names: core's own
     * (`pathsPreset`), or one a package ships.
     * Tools add the actions they bind — a shape tool brings `insert` — so
     * `defaultTools` composes with any preset. `actions` then adds, overrides
     * or removes on top of what the presets registered.
     */
    features?: readonly FeatureEntry[];

    /** Extra tools or overrides keyed by id, or a full `ToolsApi` takeover.
     *
     *  **Patch form** (`Record<string, Tool | true | false>`): merged
     *  into the built-in registry on top of whatever `defaultTools` and
     *  `features` already selected.
     *    - `true` pulls in the built-in for this id (`'pen'`, `'lasso'`,
     *      `'hand'`, …), the same as listing it in `defaultTools`. Unknown
     *      built-in ids warn in dev and are ignored.
     *    - `Tool` adds a new id or replaces an existing one in place
     *      (dev-only warning if `defaultTools` also names that id).
     *    - `false` omits a bundled tool entirely.
     *  Auto-wiring (keybindings, dispatcher, action registry) still runs.
     *
     *  **Takeover form** (`ToolsApi`): the internal registry is bypassed and
     *  this `tools` value is forwarded to Canvas as-is — the consumer owns
     *  active-slot management, and `pick`'s select tool is theirs to supply.
     *  Every other preset still applies. Keybindings are still auto-wired
     *  against the supplied registry; pass `enableKeybindings={false}` to opt
     *  out. */
    tools?: ToolsApi | Record<string, Tool | true | false>;

    /**
     * Auto-wire keyboard shortcuts. Default `true`. When `false`, SceneCanvas still mounts
     * its tools but routes no keyboard input to them — neither tool hotkeys nor
     * keyboard-bound actions like delete / escape / nudge. Pointer, wheel, and contextmenu
     * interactions are unaffected.
     */
    enableKeybindings?: boolean;

    /**
     * Take the keyboard on mount, as a press in the canvas would. A key that
     * reaches the page goes to the canvas last pressed or scrolled in, and to
     * none before that, so a canvas in a side panel does not take Space from a
     * page. An app whose canvas is the page sets this so its shortcuts work
     * before the first click, as after a selection made in its own UI. The keys
     * come back here when a canvas pressed later unmounts. Default `false`.
     */
    claimKeys?: boolean;

    /**
     * Auto-mount the gesture dispatcher (`useGestureDispatcher`). Default `true`. `false` is
     * for tests or demos that drive actions another way, or that call
     * `useGestureDispatcher` themselves.
     */
    enableGestureDispatcher?: boolean;

    /** Called with the `ToolsApi` SceneCanvas constructs or receives, whenever its identity
     *  changes. For introspection. */
    onToolsCreated?: (tools: ToolsApi) => void;

    /**
     * Built-in tools SceneCanvas registers in its internal `useTools`, on top
     * of the ones presets bring (`select` from `pick`, `hand` from `view`):
     * ids, or sets of them such as `SHAPE_TOOLS`, or `withoutTools(...)` of one.
     * Default: none. Each tool also registers the kit actions it binds, so
     * `['rect']` brings `insert`. Ignored under a full `ToolsApi` takeover in
     * `tools`; the patch form of `tools` lays over it.
     */
    defaultTools?: readonly ToolEntry<BuiltinToolId>[];

    /** Per-tool option overrides for the built-in tools. Each entry is a
     *  narrow subset of the underlying hook's options surface — `lasso.mode`,
     *  `rig.state`, etc. */
    toolOptions?: BuiltinToolOptions;
    /** What gestures snap to, and how near it pulls. */
    snap?: SceneCanvasSnap;

    /** Initial active-slot tool id. Default: `'select'` when it is
     *  registered, otherwise none — a canvas can run on ambient bindings
     *  alone. Must be one of the registered tools. Ignored when the consumer
     *  supplies their own `tools` prop. */
    defaultActiveTool?: string;

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

    /** Configures the `view` preset, and implies it. See {@link SceneCanvasViewport}. */
    viewport?: SceneCanvasViewport;

    /**
     * Given a scene node, return a short human-readable "kind" label (e.g. `'rectangle'`,
     * `'sticky note'`), which the kit publishes per id into any surrounding
     * `<SelectionContextProvider>`. Return `undefined` to skip an entry. When omitted,
     * each node reports its routing kind (see `routing`), and a node that routes as
     * `'unknown'` is left unlabeled.
     */
    describeKind?: (node: Node<TData, TLayer, TPose>) => string | undefined;

    /**
     * Animator to bind for per-frame redraws. SceneCanvas requests a redraw on every active
     * animation frame and paints `animator.colorOverrides` and `animator.trimOverrides` onto
     * the scene's nodes: the kit's path and shape painters apply them, and a custom `drawOne`
     * receives them as `ctx.vertexColors` and `ctx.trim`. Picking reads the authored trim.
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

    /** A yoke to join, from `useYoke()`: canvases on one yoke share the active tool, the gesture
     *  in flight and history. Omitted, this canvas keeps its own. */
    yoke?: Yoke;

    /**
     * Chrome-caps visibility overrides, keyed by chrome id (`selection.outline`,
     * `selection.rotation-handle`, `gesture.marquee`, …). Each entry is a composable
     * {@link Condition} built from the `cond()` builder, merged on top of the kit's
     * `defaultVisibilityRules`. Set an id to `never` to suppress a chrome element
     * entirely (also unhittable), or to `always` to force-show.
     */
    chromeVisibility?: import('domains/chrome-caps').VisibilityRules;

    /**
     * The app's mode registry (`createModeRegistry` in `@weasel-js/modes`).
     * The canvas reads the active mode from it to gate chrome, tool
     * activation and the dispatcher's eligibility filter, repaints when it
     * switches, and hands every registered mode to the dev-time route-conflict
     * check. Omitted, the canvas behaves as the kit's normal mode and nothing
     * revokes anchor editing.
     */
    modes?: ModeRegistry;

    /** Hands which path is being anchor-edited to the host. See {@link PathEditHost}. */
    pathEdit?: PathEditHost;
    /** A path to open in anchor edit as the canvas mounts, with anchors selected. Read once. */
    defaultPathEdit?: PathEditOpening;

    /**
     * Override detected device facts. Merged over what `matchMedia` reports;
     * `targetScale` is re-derived from the merged `coarsePointer` unless you
     * override it explicitly.
     */
    device?: Partial<DeviceProfile>;

    /**
     * Live focus getter for chrome-caps' `focused` ctx field, for visibility rules that
     * read the `focused` atom (the kit's default `selection.rotation-handle` rule does).
     * Omit to default `focused` to `true`.
     */
    getFocused?: () => boolean;

    /** Shader programs for the renderer (`CanvasProps.shaders`); under `worker`, the page's, not `serveSceneRender`'s. */
    shaders?: ShaderProgramHandle[];

    /** Curve flatness (`CanvasProps.flattenTolerance`); under `worker`, the page's, not `serveSceneRender`'s. */
    flattenTolerance?: FlattenTolerance;

    /** Fill for the full canvas behind the scene, drawn as a screen-space layer slotted
     *  before `'scene'` — independent of pan / zoom. */
    backgroundFill?: Paint;
    /** Dev HUD: a fixed-position widget showing live cursor coords in both viewport
     *  (client) and canvas (world) frames. */
    cursorCoordsHud?: boolean;
    /** Dev HUD: a fixed-position widget listing the ids `pickEvery(world)` returns under
     *  the cursor. */
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
     * Per-id alpha multiplier for the scene-render slot: each node's draw output is wrapped
     * in a group with the returned alpha, and 1 emits no wrapper. Typical use: dimming
     * non-active nodes during a mode transition.
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
  } & SceneCanvasPointerProps<TData> & SceneCanvasActionProps & SceneCanvasPaintedBy & SceneCanvasSampleProps;
