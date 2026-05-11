import type { DrawCommand } from '../../../src/renderer';

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
}

export type HudPointerEvent =
  | { type: 'down'; x: number; y: number; native: PointerEvent }
  | { type: 'move'; x: number; y: number; native: PointerEvent }
  | { type: 'up'; x: number; y: number; native: PointerEvent }
  | { type: 'cancel'; native: PointerEvent };

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
