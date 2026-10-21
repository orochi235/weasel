import type { LayerHit } from '../affordances/types';
import type { Dims, RenderLayer } from '../core/layers/render';
import type { View } from '../core/viewport/view';
import type { IngestItem } from '@weasel-js/routing';
import type { ViewAnimationOptions } from '../core/viewport/useViewAnimation';
import type { CursorSink, PaintedCursorState } from '@weasel-js/cursor';
import type { DrawCommand } from '@weasel-js/renderer';
import type { CanvasViewProps } from './CanvasView';
import type { CanvasDebugSink } from '../debug/types';
import type { ViewAim } from '../features/viewports/aim';
import type { Target } from '@weasel-js/animator';
import type { Animator } from '@weasel-js/animator';

/**
 * A view added through {@link SceneCanvasApi.addView}.
 */
export interface CanvasViewHandle {
  readonly id: string;
  /** Paint the view for one frame of the canvas: its layers through its own
   *  camera, clipped to its rect. For a view added with `paint: false`, whose
   *  host draws it; empty until the view has mounted. */
  draw(data: unknown, outer: View, dims: Dims): DrawCommand[];
  /** Stop painting and routing the view. */
  remove(): void;
}

/** The view under a canvas point, as {@link SceneCanvasApi.viewAt} answers. */
export interface ViewAt {
  /** `null` for the canvas itself. */
  id: string | null;
  view: View;
  /** Where the view paints, in canvas CSS px. */
  rect: { x: number; y: number; w: number; h: number };
}

/**
 * A `<CanvasView>`'s camera, as its `cameraRef` receives it: the members a
 * canvas's own handle carries for its camera, with the same contract. A camera
 * derived by a thunk reads fresh but tells no subscriber when it moves;
 * subscribe to the canvas it derives from.
 */
export type CanvasViewCamera = Pick<CanvasExtensionApi, 'getView' | 'setView' | 'subscribeView'>;

/**
 * The **base imperative ref handle** shared by the canvas components. For
 * `<SceneCanvas>` refs use {@link SceneCanvasApi} (this type plus the
 * scene-level surfaces, e.g. a non-optional `ingest`).
 *
 * Consumers use `element` for focus / screenshots / `getBoundingClientRect`;
 * plugin packages (e.g. `@weasel-js/hud`) additionally use `requestRedraw`
 * and `registerLayer` to attach externally-owned draw layers.
 *
 * @public
 */
export interface CanvasExtensionApi {
  /** Where pointer input, focus and the cursor live, and the element every
   *  client→world conversion measures. Null until the canvas mounts.
   *  Use this for `getBoundingClientRect` and focus management.
   *
   *  Normally the `<canvas>` the component renders, so `element === surface`.
   *  Under `paintInto` it is the caller's `inputElement` instead — a plain box
   *  over one pane of a shared surface — so use {@link surface} for anything
   *  that needs the pixels. */
  readonly element: HTMLElement | null;
  /** The canvas pixels land on — for screenshots and readback. Null until the
   *  canvas mounts.
   *
   *  Under `paintInto` this is the caller's shared canvas, which co-tenant
   *  panes also paint into: its rect is the whole surface, not this pane's, so
   *  read geometry off {@link element} rather than off this, and find this
   *  pane's pixels on it with {@link getSurfaceRect}. */
  readonly surface: HTMLCanvasElement | null;
  /**
   * The rect of {@link surface} this canvas paints into, in the surface's CSS
   * px — the rect the renderer is confined to. Under `paintInto` that is the
   * pane's `x`/`y` and this canvas's size; otherwise the whole canvas at the
   * origin. A point measured against {@link element} sits at
   * `(x + px, y + py)` on the surface, which is where a readback must look.
   * Read live: the value is the one the next paint uses.
   */
  getSurfaceRect(): { x: number; y: number; width: number; height: number };
  /**
   * A client point in this canvas's world: through the `clientToWorld`
   * override when the canvas was given one, and through {@link element}'s
   * rect and the current view otherwise. It is the conversion the canvas
   * makes for hover and for its registered layers' hit-tests, so a point
   * converted here lands where the canvas says it does. Before the canvas
   * mounts there is nothing to measure and the point comes back unchanged.
   */
  clientToWorld(clientX: number, clientY: number): [number, number];
  requestRedraw(): void;
  /**
   * Run `fn` after every paint, on the frame that painted — for chrome that
   * must observe landed pixels (a loupe readback, a frame counter). `time` is
   * the frame's timestamp, on `performance.now()`'s clock. Returns an
   * unsubscribe.
   */
  subscribeFrame(fn: (time: number) => void): () => void;
  /**
   * Run `fn` on every frame just before it paints, with the same `time` the
   * frame's {@link subscribeFrame} subscribers get. For state a frame's layers
   * read, advanced once per frame. Returns an unsubscribe.
   */
  subscribeBeforePaint(fn: (time: number) => void): () => void;
  /**
   * Run `fn` when the frame loop resumes after being suspended (a hidden tab,
   * a canvas scrolled out of the viewport), before the frame that follows. No
   * frame runs while suspended, so a subscriber that advances by the time
   * between frames rebases its clock here rather than taking the whole
   * suspension as one step. Returns an unsubscribe.
   */
  subscribeResume(fn: () => void): () => void;
  /** The current view. Readable mid-frame — this is the value the next paint
   *  will use, not a value from the last React commit. */
  getView(): View;
  /**
   * Set the view without a React render: the ref updates now and the next
   * frame paints with it.
   *
   * Not applied locally when the canvas is controlled by a `view` prop — there
   * the prop is the authority and a local write would only desynchronize
   * pixels from props. The value still goes out through `onViewChange`, so a
   * controlled owner can honor it; without an `onViewChange` it is dropped.
   * Either way the canvas warns once per mount.
   */
  setView(next: View | ((current: View) => View)): void;
  /** Called after each view change, for chrome that mirrors the camera — a
   *  zoom readout, a minimap, DOM pinned to world coordinates. Returns an
   *  unsubscribe. */
  subscribeView(fn: (view: View) => void): () => void;
  /** The `contentVersion` the current pixels were painted from — on
   *  `<SceneCanvas>`, the scene version. Chrome in lockstep with canvas
   *  content compares this against the version it is about to render and
   *  defers a frame when they differ. `0` until the first paint lands. */
  getPaintedVersion(): number;
  /**
   * The painted tier's channel for this surface.
   *
   * Most cursors are a CSS `url()` string the compositor draws, and nothing
   * needs this. A cursor that is sized in world units or too big to be a CSS
   * cursor at all is drawn into the canvas instead, and whoever decides which
   * cursor is showing publishes it here — the kit's gesture dispatcher does,
   * and so should an input layer built against a bare `<Canvas>`.
   */
  paintedCursor: PaintedCursorState;
  /**
   * Where this surface's cursor is written: its input element's `cursor`
   * style and `paintedCursor`. The canvas sets the active tool's cursor as the
   * base. Whoever shows a cursor over it, as the kit's gesture dispatcher does
   * on hover, sets the override here, and clearing that puts the tool's back.
   */
  cursorSink: CursorSink;
  /** The sink this canvas's debug overlay reads, or null while `debug` is off.
   *  Its `snapshot()` is what `renderDebugSnapshot` rasterizes. */
  getDebug(): CanvasDebugSink | null;
  /** Register an externally-owned RenderLayer. The layer participates in the
   *  draw stack and, if it implements `hitTest`, in {@link hitTestExtras}. */
  registerLayer(layer: RenderLayer<unknown>): () => void;
  /**
   * Hit-test the registered layers (topmost-first, last-registered wins) at a
   * world-space point. Returns the id of the layer that claimed the point and
   * whatever its `hitTest` resolved, or `null` when none did.
   *
   * `<SceneCanvas>` folds this into the gesture dispatcher's hit-test ahead of
   * the kit's own selection chrome, so a hit surfaces to actions as an
   * `AffordanceHit` with kind `layer:<id>`, the hit's `initialScratch` as its
   * `payload`, `owner` set to the layer id, and `cursor` / `strength` carried
   * through. A layer's owner binds a `kindOf` predicate on that kind to claim
   * the gesture.
   *
   * `frame` names the camera and surface size the point is expressed against.
   * Omit it for the canvas's own view.
   */
  hitTestExtras(
    worldX: number,
    worldY: number,
    frame?: { view: View; dims: Dims },
  ): { layerId: string; hit: LayerHit } | null;
  /** Feed external content into the ingestion pipeline imperatively — the
   *  same content-handler registry that OS drop and clipboard paste hit.
   *  `input` may be raw `File[]` (e.g. from `openFilePicker`) or
   *  pre-normalized `IngestItem[]`. `point` is a world-space placement
   *  anchor; omitted → handlers use their point-less policy (the kit image
   *  handler centers on the viewport).
   *
   *  Returns whether the canvas had an `ingest` action to hand the items to.
   *  `false` means nothing will be inserted: there were no items, or the
   *  canvas lacks the `ingest` preset. Handlers run after it returns, so
   *  `true` does not say one of them accepted the content.
   *
   *  Optional because ingestion needs the SceneCanvas action stack — the
   *  handle is always populated on `<SceneCanvas>` refs, absent on the
   *  bare-primitive handle. */
  ingest?(input: File[] | IngestItem[], point?: { x: number; y: number }): boolean;
  /** Add a view to the canvas from outside React. See
   *  {@link SceneCanvasApi.addView}; absent on the bare-primitive handle,
   *  which hosts no views. */
  addView?(props: CanvasViewProps): CanvasViewHandle;
}

/**
 * The imperative ref handle for `<SceneCanvas>` — everything on
 * {@link CanvasExtensionApi} plus the surfaces only the scene-level canvas
 * can provide. `ingest` is always populated here (the optional declaration
 * on the base type exists for the bare-primitive handle).
 * @public
 */
export interface SceneCanvasApi extends CanvasExtensionApi {
  ingest(input: File[] | IngestItem[], point?: { x: number; y: number }): boolean;
  /**
   * Glide the camera to `to` rather than jumping there — a fit-to-selection, a
   * recenter, a scripted tour. A thunk receives the pending target when an
   * animation is already in flight, so steps compound. Any other view write
   * cancels it.
   */
  animateView(to: View | ((base: View) => View), opts?: ViewAnimationOptions): void;
  /** Cancel a camera animation. The view stays where it is. */
  stopViewAnimation(): void;
  isViewAnimating(): boolean;
  /**
   * The camera as an animation target, and the animator that moves it. An
   * animation started on `animator` with `target` adds to a glide in flight: a
   * shake, a nudge, a spring toward a followed node. Start it without a
   * `cancelKey` and neither `animateView` nor `stopViewAnimation` ends it.
   *
   * `animator` is the canvas's own for its camera, apart from the `animator`
   * prop. A target is moved by one animator at a time, so use this one.
   */
  readonly camera: { readonly target: Target<View>; readonly animator: Animator };
  /**
   * Add a view — the same declaration as a `<CanvasView>` child, for code
   * outside React: chrome that opens a lens, a panel a plugin owns. Input over
   * it resolves through its camera unless `interactive` is `false`.
   *
   * Pass thunks for `bounds` and `view` rather than re-adding to move it.
   * Adding an id already present replaces that view.
   */
  addView(props: CanvasViewProps): CanvasViewHandle;
  /**
   * The innermost view painted under `at`, a point in CSS px from the
   * canvas's top-left, whether or not that view takes input: its id, its
   * camera, and the rect it paints into. Where no view is, the canvas itself,
   * with `id: null`. `except` passes over a view and the views nested in it —
   * a lens asking what is beneath itself.
   */
  viewAt(at: { x: number; y: number }, opts?: { except?: string }): ViewAt;
  /** What view `id` shows (`null`: the canvas's own camera), or `null` while no such view is mounted. */
  aimOf(id: string | null): ViewAim | null;
  /** Point view `id` at `aim`. A camera-held view moves its camera to show the aim exactly, per axis, so a
   *  rect of another shape stretches it; for a uniform zoom-to-fit, use `fitViewToBounds` or `animateView`.
   *  An aim-held view reports the aim through `onAimChange`. `false` when there is no such view, the aim is
   *  not one it can read, or the write goes nowhere: no camera writer, or a controlled view with no handler. */
  setAim(id: string | null, aim: ViewAim): boolean;
}
