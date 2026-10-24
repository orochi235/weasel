/**
 * Layered curve editor contract.
 *
 * A `CurveLayer` is a pure-value description of one composable layer
 * inside `LayeredCurveEditor`. State lives outside the layer (held by
 * the consumer); the layer only provides render + hit-test + gesture
 * starters. This lets the editor coordinate cross-layer reactivity —
 * when one layer's gesture updates its state, the consumer can update
 * other layers' states in the same render, and the in-flight gesture
 * keeps reading the latest state.
 */
import type { ColorSource } from '@weasel-js/paint';
import type { KitSettingsStore } from '@weasel-js/react';
import type { ReactNode } from 'react';
import type { Point as PlotPoint, ModelRange } from '../Plot2D/geometry';

/** Convenience aliases — both are `{ x, y }` but with different units. */
export type ModelPoint = PlotPoint;
export type { PlotPoint };

/** Modifier keys held at the moment a layer callback fires. */
export interface LayerModifiers {
  shift: boolean;
  alt: boolean;
  meta: boolean;
  ctrl: boolean;
}

/** Read-only context passed to every layer hook. Layers use this to
 *  convert between plot (SVG-pixel) and model (data) coordinates. */
export interface LayerCtx {
  readonly modelRange: ModelRange;
  readonly plotSize: { readonly width: number; readonly height: number };
  toPlot(p: ModelPoint): PlotPoint;
  toModel(p: PlotPoint): ModelPoint;
  readonly modifiers: LayerModifiers;
  /** The kit settings the editor sees, for a layer's hit and snap radii. Absent, a layer uses its own constants. */
  readonly kitSettings?: KitSettingsStore;
}

/**
 * The {@link LayerCtx} a layer's `render` gets, plus whether this layer owns
 * the gesture currently in flight.
 */
export interface LayerRenderCtx extends LayerCtx {
  /** True when this layer owns the currently-active gesture. Useful for
   *  surfacing "active anchor" visuals without threading the index. */
  readonly isActive: boolean;
  /** A color source as a CSS color under the theme, tints, and palette in
   *  force; `undefined` for no source and for one nothing answers. */
  colorCss(source: ColorSource | null | undefined): string | undefined;
}

/** Layer-private payload returned from `hitTest`. The editor doesn't
 *  read it — it just round-trips it back into `onPointerDown`. */
export interface LayerHit {
  /** Layer-local discriminator (e.g. `'anchor'`, `'curve'`). */
  kind: string;
  payload?: unknown;
}

/** A live gesture installed by a successful `onPointerDown`. The editor
 *  routes window-level pointermove/up/cancel into these callbacks until
 *  the gesture ends.
 *
 *  `onMove` is pure: it takes the layer's *current* state (which may
 *  have been updated by upstream re-renders since the gesture started)
 *  and returns the next state. The editor publishes that next state via
 *  `onLayerChange`. */
export interface LayerGesture<S> {
  onMove(state: S, model: ModelPoint, e: PointerEvent, ctx: LayerCtx): S;
  /** Pointerup. Return the final state. The editor uses this as the
   *  `next` value passed to `onLayerCommit`. Default: return state
   *  unchanged. */
  onCommit?(state: S, ctx: LayerCtx): S;
  /** The gesture ended without a release. Return the state to restore.
   *  Default: the layer's state from before the press that started it. */
  onCancel?(state: S, ctx: LayerCtx): S;
}

/** Pure-value layer description. Multiple instances of the same factory
 *  output (e.g. two `createFunctionLayer` results) coexist by `id`. */
export interface CurveLayer<S> {
  /** Stable identifier — used as the key when the editor calls back
   *  with state updates. Must be unique within an editor instance. */
  readonly id: string;

  /** Render the layer's visuals as SVG children inside the editor's
   *  Plot2D. Coordinates the layer renders into are plot-space. */
  render(state: S, ctx: LayerRenderCtx): ReactNode;

  /** Plot-space hit test. Return null to pass the point to the next
   *  layer (top-to-bottom). Topmost-claimed wins. */
  hitTest?(state: S, plot: PlotPoint, ctx: LayerCtx): LayerHit | null;

  /** A positive hit-test starts a gesture, absorbs the click with no
   *  gesture by returning void, or publishes a one-shot edit via
   *  `extra.commit(next)` and returns void (e.g. shift-click delete). */
  onPointerDown?(
    state: S,
    hit: LayerHit,
    e: PointerEvent,
    ctx: LayerCtx,
    extra: EmptyDownArgs<S>,
  ): LayerGesture<S> | void;

  /** The context-menu gesture (a right-click, a long press, the menu key)
   *  on a positive hit-test. `e.preventDefault()` keeps the browser's menu
   *  shut; publish a one-shot edit with `extra.commit(next)`, which is one
   *  undo step like any other. Only the topmost layer claiming the point is
   *  asked. */
  onContextMenu?(
    state: S,
    hit: LayerHit,
    e: MouseEvent,
    ctx: LayerCtx,
    extra: EmptyDownArgs<S>,
  ): void;

  /** Pointerdown landed where no layer claimed a hit. Layers get a
   *  turn top-to-bottom; first non-void return wins. Either start a
   *  gesture or commit a one-shot edit (return void after publishing
   *  state via the editor — see `EmptyDownArgs.commit`). */
  onEmptyPointerDown?(
    state: S,
    model: ModelPoint,
    e: PointerEvent,
    ctx: LayerCtx,
    extra: EmptyDownArgs<S>,
  ): LayerGesture<S> | void;

  /** Keyboard while focus is on the editor or on anything a layer rendered
   *  into it; `e.target` says which. Top-to-bottom; `e.preventDefault()` keeps
   *  the key from the layers below. Publish an edit with `extra.commit`. */
  onKeyDown?(state: S, e: KeyboardEvent, ctx: LayerCtx, extra: KeyDownArgs<S>): void;
}

/** Handed to `onKeyDown` so a key press can publish a committed edit. */
export interface KeyDownArgs<S> {
  commit(next: S): void;
}

/** Helpers handed to `onPointerDown` and `onEmptyPointerDown` so a
 *  layer can publish a one-shot edit (shift-click delete, empty-click
 *  insert) without a drag gesture, and read the click's plot+model
 *  coords without re-deriving them from the DOM event. */
export interface EmptyDownArgs<S> {
  /** Pointer in plot space. */
  readonly plot: PlotPoint;
  /** Pointer in model space. */
  readonly model: ModelPoint;
  /** Publish a state update *and* mark the action as committed. Use
   *  this when the click results in an immediate, undoable edit. */
  commit(next: S): void;
}
