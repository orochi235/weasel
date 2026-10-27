/** The props `<CanvasView>` takes, and the rect it paints into. */
import type { Ref } from 'react';
import type { CanvasViewCamera } from './canvasExtension';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { SelectionApi, UseSelectionOptions } from 'core/selection/useSelection';

/** A rect on the surface, in CSS pixels from the canvas top-left. */
export interface ViewRect { x: number; y: number; w: number; h: number }

/** The props every `<CanvasView>` takes, whichever side it holds. */
export interface CanvasViewCommonProps {
  /** Identifies the view to the surface and to input routing. Must be unique
   *  among the views on one canvas. */
  id: string;
  /**
   * The id of a view to nest this one in. `bounds` is then measured from that
   * view's rect, and a thunked `bounds`, `view` or `aim` receives that view's camera
   * and size as `outer` and `dims`. The view paints after it, cut to what it
   * shows, paints only the layers it paints, and takes input there before it
   * does. While no view has that id, this one neither paints nor takes input.
   */
  parent?: string;
  /** Where this view paints, recomputed every frame so the rect can track the
   *  outer camera. A plain rect is accepted for a fixed panel. */
  bounds: ViewRect | ((outer: View, dims: Dims) => ViewRect);
  /** Receives this view's camera, to read, drive, and watch from outside it. */
  cameraRef?: Ref<CanvasViewCamera>;
  /** Which of the surface's layers this view paints. Defaults to all of them —
   *  the same content through a second camera. */
  layers?: (surface: readonly RenderLayer<unknown>[]) => readonly RenderLayer<unknown>[];
  /**
   * The id of a view whose layers this one paints, read at every paint and
   * pick: what that view paints, as a `parent` gives a nested view, narrowed by
   * this view's own `layers`, `layerVisibility` and `layerOrder`. Its rect and
   * camera are not taken; this view is still measured on its own frame. A
   * loupe aimed over a panel follows the panel. `null`, or an id no view has,
   * paints what this view would without it.
   */
  follows?: () => string | null;
  /**
   * Show or hide layers in this view only, by id — the map `<Canvas>` takes,
   * applied after `layers` narrows the stack. A scene layer paints as
   * `scene:<layerId>`; one hidden here neither paints nor picks in this view,
   * and a marquee or Cmd+A routed here passes over it. The surface and every
   * other view are unaffected.
   */
  layerVisibility?: Record<string, boolean>;
  /** Draw order for this view, by layer id, bottom first. A listed order is
   *  the whole list, so a layer left out of it is neither painted nor picked
   *  here. */
  layerOrder?: string[];
  /** Opaque ground painted before the source layers, so the surface does not
   *  show through where the inner camera sees nothing. */
  background?: string;
  /** Paint and hit order. Defaults to `Infinity` — after every view the
   *  surface declared as a prop. */
  order?: number;
  /** Label for debug overlays. Defaults to the id. */
  label?: string;
  /**
   * Whether input over the view resolves through its camera. Default `true`:
   * a press selects what the view shows, and a drag moves it in the view's
   * world units. `false` paints only, and input over it reaches the canvas
   * beneath as though the view were not there.
   *
   * Overlapping views are hit in paint order; to put one inside another, give
   * it a `parent`.
   */
  interactive?: boolean;
  /**
   * Whether the surface paints the view. Default `true`. `false` is for a
   * host that draws the view inside chrome of its own — a HUD window's
   * interior — through `SceneCanvasApi.addView`'s `draw`, so it lands in
   * that chrome's z-order rather than the surface's.
   */
  paint?: boolean;
  /** A selection of this view's own, which actions dispatched inside it read
   *  and write instead of the surface's. Omit both this and
   *  `selectionOptions` and the view shares the surface's selection — the
   *  default, so undo restores one selection rather than N. */
  selection?: SelectionApi;
  /** Opts this view into owning a selection, configured thus. Ignored when
   *  `selection` is supplied. */
  selectionOptions?: UseSelectionOptions;
}

/** A view that holds its camera. */
export interface CameraHeldViewProps {
  /** Camera. Supply this to control it; otherwise the view keeps its own,
   *  seeded from `defaultView`. `onViewChange` fires either way.
   *
   *  A thunk is a camera derived from the canvas's — a loupe following the
   *  pointer — read fresh at every paint and every event, so the two cannot
   *  disagree mid-gesture. It is controlled: a pan inside the view reaches
   *  only `onViewChange`. */
  view?: View | ((outer: View, dims: Dims) => View);
  defaultView?: View;
  onViewChange?: (v: View) => void;
  /** Pan limits, applied to every camera change the same way `<Canvas>`
   *  applies its own. */
  viewBounds?: Bounds;
  aim?: never;
  onAimChange?: never;
}

/** A view that holds its aim, and derives its camera from it. */
export interface AimHeldViewProps {
  /** What the view shows, as a world rect; its camera fits it to the frame, uniformly and centered.
   *  A thunk is read at each paint and event, measured like a thunked `view`. */
  aim: Bounds | ((outer: View, dims: Dims) => Bounds);
  /** A pan or zoom inside the view, or `setAim` on it, reported as the held rect that camera move carries. */
  onAimChange?: (aim: Bounds) => void;
  view?: never;
  defaultView?: never;
  onViewChange?: never;
  viewBounds?: never;
}

/** Props for `<CanvasView>`: the common ones, and either a camera or an aim. `Omit` does not distribute over
 *  the union, and a `Partial` of it does not spread back into `<CanvasView>`, so a wrapper builds its props from
 *  {@link CanvasViewCommonProps} and one half. */
export type CanvasViewProps = CanvasViewCommonProps & (CameraHeldViewProps | AimHeldViewProps);
