import type { DrawCommand } from '@weasel-js/core/renderer';
import type { ClaimableGesture, View } from '@weasel-js/core';
import type { ResolvedTheme } from '@weasel-js/theme';

/** A widget's rectangle, in screen-space CSS pixels relative to the canvas. */
export interface WidgetBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything a widget is given to draw itself. Deliberately carries no scene
 *  data, which is what lets a HUD render identically headlessly — a window's
 *  `content` painter is the one opt-in exception (see {@link HudContentCtx}). */
export interface HudDrawCtx {
  /** Canvas size in CSS pixels. */
  dims: { width: number; height: number };
  /** Family name of the auto-registered default font. */
  defaultFont: string;
  /** The resolved theme, keyed by CSS custom-property name. Supplied by the
   *  caller rather than read back off the DOM, so a HUD drawn headlessly is
   *  themed the same way one drawn in a browser is. */
  tokens: ResolvedTheme;
}

/**
 * Input to a widget's optional `content` painter — the one place hud sees
 * the scene. `HudDrawCtx` stays data-free so widgets stay renderable
 * headlessly; this is an explicit opt-in on the composite instead.
 */
export interface HudContentCtx {
  /** Scene data the hud layer was handed. Opaque here; painters that need
   *  it cast to a known shape, as tools do with `ToolCtx.adapter`. */
  data: unknown;
  /** The outer view. A painter deriving an inner view starts from this. */
  view: View;
  dims: { width: number; height: number };
  /** Where the content is painted, in screen-space CSS px. The group the
   *  painter's commands land in carries a clip but no transform, so those
   *  commands are in absolute canvas coordinates — a painter that treats the
   *  rect's origin as (0,0) silently draws nothing. */
  rect: WidgetBounds;
  defaultFont: string;
  tokens: ResolvedTheme;
}

/**
 * Input handed to a widget, in screen space.
 *
 * `native` is the originating DOM event when there is one, and `null`
 * otherwise — it is **not** guaranteed. Hover arrives through the layer's
 * `onUncapturedMove`, so `hovermove` carries the real `PointerEvent` — and,
 * being uncaptured-only, stops for the duration of any drag.
 * Every other arm arrives through the gesture dispatcher, which hands
 * actions normalized input rather than the event that produced it, so they
 * carry `null`. A widget that needs `native` must handle its absence;
 * prefer the normalized `x` / `y` and the event `type`.
 */
export type HudPointerEvent =
  | { type: 'down'; x: number; y: number; native: PointerEvent | null }
  | { type: 'move'; x: number; y: number; native: PointerEvent | null }
  | { type: 'up'; x: number; y: number; native: PointerEvent | null }
  | { type: 'cancel'; native: PointerEvent | null }
  | { type: 'hovermove'; x: number; y: number; native: PointerEvent | null }
  | { type: 'hoverleave'; native: PointerEvent | null }
  | { type: 'doubleclick'; x: number; y: number; native: PointerEvent | null }
  | { type: 'contextmenu'; x: number; y: number; native: PointerEvent | null }
  | { type: 'longpress'; x: number; y: number; native: PointerEvent | null }
  | {
      type: 'wheel'; x: number; y: number;
      deltaX: number; deltaY: number; native: PointerEvent | null;
    };

/** What a widget consumes when it declares nothing: chrome is opaque to every
 *  pointer-family gesture except the wheel, which stays with the viewport
 *  unless a widget asks for it. */
export const DEFAULT_WIDGET_CLAIMS: readonly ClaimableGesture[] =
  ['pointer', 'doubleClick', 'contextMenu', 'longPress'];

/** The gestures `w` consumes, applying {@link DEFAULT_WIDGET_CLAIMS} when the
 *  widget declares none. */
export function claimsOf(w: Widget): readonly ClaimableGesture[] {
  return w.claims ?? DEFAULT_WIDGET_CLAIMS;
}

/** Cursor for a point on `w`: what the widget says, else `'pointer'` if it
 *  takes the press at all. Keyed on the claim a widget already declares, so a
 *  consumer-authored widget answers without implementing anything; decoration
 *  never reaches here, since the hit walk descends past it. */
export function cursorOf(w: Widget, x: number, y: number): string | undefined {
  return w.cursorAt?.(x, y)
    ?? (claimsOf(w).includes('pointer') ? 'pointer' : undefined);
}

/**
 * The contract every HUD widget implements: a rectangle, a painter, a
 * hit-test, and a pointer handler. Widgets are plain objects — consumers can
 * write their own without any registration step.
 */
export interface Widget {
  readonly id: string;
  readonly bounds: WidgetBounds;
  readonly hidden: boolean;
  draw(ctx: HudDrawCtx): DrawCommand[];
  /** Optional interior painter, drawn beneath every widget frame and
   *  clipped to `contentRect`. See {@link HudContentCtx}. */
  content?(ctx: HudContentCtx): DrawCommand[];
  /** Region `content` is clipped to. Required when `content` is set. */
  readonly contentRect?: WidgetBounds;
  hitTest(x: number, y: number): boolean;
  /** Which gestures this widget consumes. Absent means
   *  {@link DEFAULT_WIDGET_CLAIMS}; `[]` is decoration, and the hit-test walk
   *  descends past it to whatever lies beneath. Anything not listed falls
   *  through to the scene. */
  readonly claims?: readonly ClaimableGesture[];
  /** CSS cursor for a point inside this widget, in screen space. Resolved per
   *  point rather than read off hover state, because the layer's `hitTest`
   *  runs for a point and hover state may lag it. */
  cursorAt?(x: number, y: number): string;
  onPointer(evt: HudPointerEvent): void;
  /** Called by Hud.remove or widget.dispose. Detach event listeners, etc. */
  dispose(): void;
}
