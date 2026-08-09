import type { DrawCommand } from '@weasel-js/core/renderer';
import type { View } from '@weasel-js/core';
import type { ResolvedTheme } from '@weasel-js/theme';

export interface WidgetBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /** Where the content is painted, in screen-space CSS px. */
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
 * Press / move / release arrive through the gesture dispatcher, which hands
 * actions normalized input rather than the event that produced it, so those
 * arms carry `null`. A widget that needs `native` must handle its absence;
 * prefer the normalized `x` / `y` and the event `type`.
 */
export type HudPointerEvent =
  | { type: 'down'; x: number; y: number; native: PointerEvent | null }
  | { type: 'move'; x: number; y: number; native: PointerEvent | null }
  | { type: 'up'; x: number; y: number; native: PointerEvent | null }
  | { type: 'cancel'; native: PointerEvent | null }
  | { type: 'hovermove'; x: number; y: number; native: PointerEvent | null }
  | { type: 'hoverleave'; native: PointerEvent | null };

export type PointerClaim = 'claim' | 'pass';

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
  onPointer(evt: HudPointerEvent): PointerClaim;
  /** Called by Hud.remove or widget.dispose. Detach event listeners, etc. */
  dispose(): void;
}
