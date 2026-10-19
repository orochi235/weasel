/** The props `<Canvas>` takes. */
import type React from 'react';
import type { Paint } from '@weasel-js/paint';
import type { FlattenTolerance, ShaderProgramHandle } from '@weasel-js/renderer';
import type { LayerGroup, RedrawSource, RenderLayer } from 'core/layers/render';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { CanvasDebugSink, DebugConfig } from '../debug/types';
import type { ToolsApi } from '../tools/overlayBinding';
import type { DrawnBoundsScene } from './drawnBounds';
import type { GestureSource } from './gestureBounds';
import type { CanvasLayers } from './layerSlots';
import type { CanvasViewState } from './useCanvasView';
import type { SurfaceSizeProps } from './useSurfaceSize';
import type { CanvasHelpers, ViewPoseAdapter } from './useViewHelpers';

/** How a canvas retains its layers. Unset fields keep their defaults. */
export interface CanvasRetainOptions {
  /** Drawing commands a layer must hold to be retained, when it does not say
   *  for itself. Default `DEFAULT_LAYER_RETAIN.minCommands`. */
  minCommands?: number;
  /** GPU memory, in bytes, retained layers may hold together:
   *  `WeaselRendererOptions.retainBudget`. 0 retains nothing. */
  budget?: number;
}

/**
 * Props for `<Canvas>`. Canvas is scene-agnostic: it owns the GL surface, view state, hover
 * delivery, and slot composition, and not gesture dispatch, selection state, picking logic,
 * kind registries, or scene-aware overlays.
 */
export interface CanvasProps<TPose = unknown> extends SurfaceSizeProps {
  /** Drawing-buffer density (device pixels per CSS pixel). When omitted the
   *  canvas reads `window.devicePixelRatio` per paint. */
  dpr?: number;

  /** Flatness tolerance for curve tessellation, forwarded to
   *  `WeaselRendererOptions.flattenTolerance`: world units, or `{ px }` in
   *  device pixels. Unset, curves stay within half a device pixel at every
   *  zoom, whatever the scene's world unit. A number holds a fixed world
   *  tolerance instead. */
  flattenTolerance?: FlattenTolerance;

  /** Which unchanged layers the renderer keeps as pixels between frames and
   *  composites as one quad, instead of drawing their commands again — see
   *  `RenderLayer.retain` and `LayerRetainPolicy`. `false` retains no layer on
   *  this canvas, whatever the layer asks. */
  retain?: false | CanvasRetainOptions;

  /** The version of whatever content this canvas draws, sampled at paint time
   *  and reported by {@link CanvasExtensionApi.getPaintedVersion}.
   *  `<SceneCanvas>` wires this to `scene.getVersion`. Chrome that must not
   *  show DOM ahead of pixels compares the two and defers a frame. */
  contentVersion?: () => number;

  /** Paint inside the React commit rather than on the next animation frame.
   *  Costs a synchronous paint per commit and per redraw request; buys
   *  single-commit consistency between React-rendered DOM and canvas pixels.
   *  For consumers with DOM chrome pinned to canvas content that cannot
   *  tolerate a frame of skew. Live: toggling it switches modes from the next
   *  redraw on. A redraw requested from inside a layer's `draw`, or from a
   *  `subscribeFrame` callback, still waits for a frame — painting it in place
   *  would recurse. */
  syncPaint?: boolean;

  /** External state the paint reads that no layer declares — typically what
   *  an `alphaFor` consults. Each source is subscribed while mounted and
   *  repaints the canvas when it notifies. A layer that reads outside state
   *  declares it on `RenderLayer.subscribe` instead. */
  redrawOn?: readonly RedrawSource[];

  /** Adapter the pose and bounds lookups on `helpersRef` read. */
  adapter?: ViewPoseAdapter<TPose>;
  /** The nodes the adapter's ids name. With it, the default bounds are each
   *  node's box as drawn, stroke included (`drawnBoundsOf`); without, its
   *  pose box. Ignored where `boundsOf` / `boundsOfPose` answer. */
  nodes?: DrawnBoundsScene;

  /** Layer map. See module docstring for slot semantics. */
  layers: CanvasLayers;

  /**
   * Current selection state; Canvas owns none of its own and never writes it. When absent,
   * Canvas behaves as if nothing is selected: no selection chrome.
   */
  selection?: SelectionApi;


  /**
   * How to read and rewrite a pose. Drives the default `boundsOf` fallback and the
   * selection-overlay bounds. Defaults to the rect identity (`AUTO_POSE_DESCRIPTOR`); supply
   * one for a non-rect pose type.
   */
  poseDescriptor?: PoseDescriptor<TPose>;

  /**
   * Override for committed bounds lookup, taking precedence over the `poseDescriptor`-derived
   * fallback. Used by the selection overlay, the multi-select union AABB, and
   * `helpersRef.getEffectiveBounds`.
   */
  boundsOf?: (id: string) => Bounds | null;
  /** Bounds of `id` drawn at an in-flight pose — how chrome boxes a preview.
   *  Defaults to the `poseDescriptor`'s box of that pose. */
  boundsOfPose?: (id: string, pose: TPose) => Bounds | null;
  /**
   * Custom pointer-to-world coordinate transform, overriding the default canvas-rect
   * calculation. Useful for consumers that apply an additional CSS transform to the canvas
   * element.
   */
  clientToWorld?: (canvas: HTMLElement, cx: number, cy: number) => [number, number];

  /**
   * Paint into a caller-owned canvas at a rect on it, instead of an element
   * this component creates. `x`/`y` are the rect's top-left in that canvas's
   * CSS pixels; the rect's size is the existing `width`/`height` props, which
   * it requires: a pane has no element of its own to measure.
   *
   * Requires `inputElement`: with no element of its own there is nowhere for
   * pointer input, focus or the cursor to live, and nothing renders.
   *
   * N canvases can then share one GL context and one buffer.
   */
  paintInto?: { canvas: HTMLCanvasElement | null; x: number; y: number };
  /**
   * The element pointer input, focus and the cursor come from, and the element
   * every client→world conversion measures. Only read alongside `paintInto`;
   * an attached canvas uses the one it renders.
   */
  inputElement?: HTMLElement | null;

  /** Class for the `<canvas>` this component renders. Under `paintInto` it
   *  renders none, and the input element is the caller's to style. */
  className?: string;
  /** Inline style for the `<canvas>` this component renders; a tool's cursor
   *  is merged over it. Not applied under `paintInto`, where only that cursor
   *  is written, onto the input element. */
  style?: React.CSSProperties;
  /** Tab order of the `<canvas>` this component renders. Default 0, so the
   *  canvas is focusable. Not applied under `paintInto`: whether the input
   *  element can take focus is the caller's to decide. */
  tabIndex?: number;
  /** Accessible name of the `<canvas>` this component renders; devtools lists the canvas under it.
   *  Not applied under `paintInto`. */
  'aria-label'?: string;
  /** Fired when the element input comes from gains focus: the canvas, or
   *  under `paintInto` the `inputElement`. Called with the DOM event. */
  onFocus?: (event: FocusEvent) => void;
  /** Fired when that element loses focus. */
  onBlur?: (event: FocusEvent) => void;
  /**
   * When `true` (default), the canvas element receives focus on `pointerdown` so keyboard
   * events are captured without a separate click-to-focus step. Set to `false` where
   * auto-focus would steal focus from sibling inputs.
   */
  autoFocusOnPointerDown?: boolean;

  /** The tool set. Canvas reads the active tool's cursor and its overlays;
   *  it dispatches nothing to a tool. */
  tools?: ToolsApi;

  /** The camera this surface looks through, from `useCanvasView`. Whoever
   *  made it holds the view props; the surface adopts and announces a
   *  controlled view among its own effects, and repaints when one moves. */
  viewState: CanvasViewState;
  /**
   * Mutable ref Canvas writes overlay-aware pose/bounds lookups to on every render. Custom
   * layers can read it from inside their `draw` closure to reflect in-flight gestures
   * (move/resize/rotate) instead of the committed scene; an id outside the active overlay
   * falls back to the adapter.
   */
  helpersRef?: React.MutableRefObject<CanvasHelpers<TPose> | null>;

  /**
   * Debug overlay configuration.
   *  - `undefined` (default): read `?debug=…` from the URL.
   *  - `false`: force off, ignore URL.
   *  - `DebugConfig` object: force on with that config, ignore URL.
   *
   * When enabled, the Canvas appends a screen-space `debug-overlay` layer and builds the
   * sink it paints: each paint records into it, and the layer helpers and the ref handle's
   * `getDebug` hand it to whatever else records.
   */
  debug?: DebugConfig | false;

  /** Test-only escape hatch: writes the live debug sink to this ref so tests
   *  can call `snapshot()` after a render. No effect when debug is off. */
  debugSinkRef?: React.MutableRefObject<CanvasDebugSink | null>;

  /**
   * Shader programs to compile before the frame that first draws them; one
   * not named here compiles on that frame. Each handle comes from a
   * module-level `registerProgram()`. The array is read at each paint and
   * registered again when its ids change, so a handle added after mount is
   * picked up. Re-registering one of these ids with new source repaints the
   * canvas, and the renderer recompiles it for that frame.
   */
  shaders?: ShaderProgramHandle[];

  /**
   * Preview-pose lookup, so selection chrome tracks the ghost during dispatcher-driven
   * drags. Returns `null` / `undefined` when no preview is in flight.
   */
  previewPoseExtra?: (id: string) => unknown;

  /**
   * In-flight gesture state `<Canvas>` can't see for itself. Backs the `getGestureBounds` /
   * `subscribeGestures` / `getGestureVersion` trio on `helpersRef`. Unwired, those three
   * report "no gesture in flight" and never fire.
   */
  gestureSource?: GestureSource;

  /**
   * Fill for the full canvas surface, drawn as a screen-space layer beneath every other
   * layer, the grid and anything anchored before it included — independent of pan / zoom.
   */
  backgroundFill?: Paint;

  /**
   * Mode-owned decoration layer (e.g. path-edit anchor dots). Composed as a `decorationLayer`
   * entry in `layers` with no anchor, which this prop replaces: it paints above every slot
   * and every other custom layer, and beneath a tool's `'top'` overlays. A tool's
   * selection-anchored overlays sit beneath it too while there is selection chrome to anchor
   * them; with that slot empty they fall to the tail and paint above it.
   */
  decorationLayer?: RenderLayer<unknown>;

  /**
   * Chrome-caps visibility resolver. Exposed on `helpersForLayers.getIsVisible` so custom
   * layers (notably `composeAffordanceLayer`) can gate paint by chrome id, and threaded into
   * hit-testing so the same gate applies there. Called fresh per draw / per hitTest. Omit to
   * leave every chrome element visible.
   */
  getIsVisible?: () => (id: string) => boolean;

  /**
   * Show or hide whole render layers by id. An id absent from the map falls
   * back to the layer's own `defaultVisible`, and a layer marked `alwaysOn`
   * ignores the map entirely.
   *
   * Hiding a layer also stops it claiming pointer events through
   * `hitTestExtras` — a layer nobody can see must not swallow a click.
   *
   * This is `getIsVisible`'s coarser sibling: that one gates individual
   * chrome elements *within* a layer, this one gates the layer.
   */
  layerVisibility?: Record<string, boolean>;

  /**
   * Draw order, by layer id, bottom first. Omit for the order the layers
   * arrive in.
   *
   * **A listed order is the whole list:** any layer whose id is missing from
   * it is not drawn. Reordering two layers means naming all of them.
   */
  layerOrder?: string[];

  /**
   * Runs of consecutive layers that composite as one — the surface for blurring the world
   * while the chrome above it stays sharp. Members are named by layer id. See
   * {@link LayerGroup}.
   */
  layerGroups?: readonly LayerGroup[];
}
