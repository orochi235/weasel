import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent, PointerClaim } from '../widget';
import type { DrawCommand, TextDrawCommand } from '../../../../src/renderer';

export interface TextOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize: number;
  color: string;
  /** Optional; falls back to the HUD default font from HudDrawCtx. */
  fontFamily?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
}

export interface TextWidget extends Widget {
  setText(text: string): void;
  setHidden(hidden: boolean): void;
  setBounds(b: WidgetBounds): void;
  dispose(): void;
}

export function createText(opts: TextOptions): TextWidget {
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: 0, h: opts.fontSize };
  let text = opts.text;
  let hidden = false;
  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { hidden = h; opts.onChange?.(); },
    setText(t) { text = t; opts.onChange?.(); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const cmd: TextDrawCommand = {
        kind: 'text',
        x: bounds.x,
        y: bounds.y,
        text,
        style: {
          fontFamily: opts.fontFamily ?? ctx.defaultFont,
          fontSize: opts.fontSize,
          fill: { fill: 'solid', color: opts.color },
        },
      };
      return [cmd];
    },
    hitTest() { return false; },   // text is passive in v1
    onPointer(_e: HudPointerEvent): PointerClaim { return 'pass'; },
    dispose() {},
  };
}
