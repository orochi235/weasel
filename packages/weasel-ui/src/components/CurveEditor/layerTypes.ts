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
import type { ReactNode } from 'react';
import type { Point as PlotPoint, ModelRange } from '../Plot2D/geometry';

/** Convenience aliases — both are `{ x, y }` but with different units. */
export type ModelPoint = PlotPoint;
export type { PlotPoint };

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
}

export interface LayerRenderCtx extends LayerCtx {
  /** True when this layer owns the currently-active gesture. Useful for
   *  surfacing "active anchor" visuals without threading the index. */
  readonly isActive: boolean;
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
  /** Pointercancel. Return the state to restore (usually the
   *  pre-gesture snapshot). Default: return state unchanged. */
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

  /** Keyboard while the editor has focus. Top-to-bottom; call
   *  `e.preventDefault()` to stop propagation. */
  onKeyDown?(state: S, e: KeyboardEvent, ctx: LayerCtx): void;
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
