import type { DrawCommand } from '@weasel-js/core/renderer';
import type { ResolvedTokens } from './theme';

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
  /** Resolved design tokens from the canvas element's computed style.
   *  Re-read on every draw, so live CSS changes (dark-mode toggle, etc.)
   *  take effect on the next state-driven redraw. */
  tokens: ResolvedTokens;
}

/**
 * Input handed to a widget, in screen space.
 *
 * `native` is the originating DOM event when there is one, and `null`
 * otherwise — it is **not** guaranteed. Hover is driven by a direct DOM
 * listener in `attachHud`, so `hovermove` carries the real `PointerEvent`.
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
  hitTest(x: number, y: number): boolean;
  onPointer(evt: HudPointerEvent): PointerClaim;
  /** Called by Hud.remove or widget.dispose. Detach event listeners, etc. */
  dispose(): void;
}
