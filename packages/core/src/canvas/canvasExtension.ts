import type { LayerHit } from '../affordances/types';
import type { Dims, RenderLayer } from '../core/layers/render';
import type { View } from '../core/viewport/view';
import type { IngestItem } from '../features/ingestion/ingestItems';

/**
 * The **base imperative ref handle** shared by the canvas components. For
 * `<SceneCanvas>` refs use {@link SceneCanvasApi} (this type plus the
 * scene-level surfaces, e.g. a non-optional `ingest`):
 *
 * ```tsx
 * const ref = useRef<SceneCanvasApi>(null);
 * <SceneCanvas ref={ref} … />;
 * ref.current?.element?.focus();
 * ```
 *
 * This is a deliberately small, supported consumer surface — not internal.
 * Consumers use `element` for focus / screenshots / `getBoundingClientRect`;
 * plugin packages (e.g. `@weasel-js/hud`) additionally use `requestRedraw`
 * and `registerLayer` to attach externally-owned draw layers.
 *
 * @public
 */
export interface CanvasExtensionApi {
  /** The underlying HTMLCanvasElement. Null until the canvas mounts.
   *  Use this for screenshots, getBoundingClientRect, focus management, etc.
   *  (Replaces the pre-A2 pattern where `ref.current` directly *was* the element.) */
  readonly element: HTMLCanvasElement | null;
  requestRedraw(): void;
  /**
   * Run `fn` after every paint, on the frame that painted — for chrome that
   * must observe landed pixels (a loupe readback, a frame counter). Returns
   * an unsubscribe.
   */
  subscribeFrame(fn: () => void): () => void;
  /** The current view. Readable mid-frame — this is the value the next paint
   *  will use, not a value from the last React commit. */
  getView(): View;
  /**
   * Set the view without a React render: the ref updates now and the next
   * frame paints with it.
   *
   * Ignored, with a console warning, when the canvas is controlled by a `view`
   * prop — there the prop is the authority and this would only desynchronize
   * pixels from props. `onViewChange` still fires either way.
   */
  setView(next: View | ((current: View) => View)): void;
  /** Called after each view change, for chrome that mirrors the camera — a
   *  zoom readout, a minimap, DOM pinned to world coordinates. Returns an
   *  unsubscribe. */
  subscribeView(fn: (view: View) => void): () => void;
  /** Register an externally-owned RenderLayer. The layer participates in the
   *  draw stack and, if it implements `hitTest`, in {@link hitTestExtras}. */
  registerLayer(layer: RenderLayer<unknown>): () => void;
  /**
   * Hit-test the registered layers (topmost-first, last-registered wins) at a
   * world-space point. Returns the id of the layer that claimed the point and
   * whatever its `hitTest` resolved, or `null` when none did.
   *
   * `<SceneCanvas>` folds this into the `affordanceAt` thunk it hands the
   * gesture dispatcher — ahead of the kit's own selection chrome, since
   * registered layers draw on top — so a hit surfaces to actions as an
   * `AffordanceHit` with kind `layer:<id>` and the hit's `initialScratch`
   * as its `payload`. `owner` is set to the layer id, and `cursor` /
   * `strength` carry through from the hit when the layer sets them.
   * A layer's owner binds a `kindOf` predicate on that kind to claim the
   * gesture; see `@weasel-js/hud` for the worked example.
   *
   * `frame` names the camera and surface size the point is expressed against.
   * Omit it for the canvas's own view — the only case until a caller routes
   * input to a viewport node, where the point is in that node's inner world
   * and a layer resolving screen-pixel tolerances needs its view and rect
   * size rather than the canvas's.
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
   *  Optional because ingestion needs the SceneCanvas action stack — the
   *  handle is always populated on `<SceneCanvas>` refs, absent on the
   *  bare-primitive handle. */
  ingest?(input: File[] | IngestItem[], point?: { x: number; y: number }): void;
}

/**
 * The imperative ref handle for `<SceneCanvas>` — everything on
 * {@link CanvasExtensionApi} plus the surfaces only the scene-level canvas
 * can provide. `ingest` is always populated here (the optional declaration
 * on the base type exists for the bare-primitive handle).
 * @public
 */
export interface SceneCanvasApi extends CanvasExtensionApi {
  ingest(input: File[] | IngestItem[], point?: { x: number; y: number }): void;
}
