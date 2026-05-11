import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent, PointerClaim } from '../widget';
import type { DrawCommand, PathDrawCommand, TextDrawCommand } from '../../../../src/renderer';

export type ButtonEvent = 'press' | 'hover' | 'leave';
export type ButtonHandler = () => void;

export interface ButtonOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  label: string;
  fill?: string;
  pressedFill?: string;
  hoverFill?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

export interface ButtonWidget extends Widget {
  setLabel(label: string): void;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  on(event: ButtonEvent, handler: ButtonHandler): void;
  off(event: ButtonEvent, handler: ButtonHandler): void;
  dispose(): void;
}

export function createButton(opts: ButtonOptions): ButtonWidget {
  if (opts.w <= 0 || opts.h <= 0) {
    throw new Error(`createButton: bounds must have positive w/h`);
  }
  let disposed = false;
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
  let hidden = false;
  let label = opts.label;
  let pressed = false;
  let hovering = false;
  const fill = opts.fill ?? '#ffffff';
  const pressedFill = opts.pressedFill ?? '#e0e0e0';
  const hoverFill = opts.hoverFill ?? '#f5f5f5';
  const textColor = opts.textColor ?? '#1a1a1a';
  const fontSize = opts.fontSize ?? 13;

  const handlers: Record<ButtonEvent, Set<ButtonHandler>> = {
    press: new Set(),
    hover: new Set(),
    leave: new Set(),
  };
  const emit = (e: ButtonEvent) => { for (const h of handlers[e]) h(); };

  const isInside = (x: number, y: number) =>
    x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setLabel(l) { assertNotDisposed(); label = l; opts.onChange?.(); },
    on(event, handler) { assertNotDisposed(); handlers[event].add(handler); },
    off(event, handler) { assertNotDisposed(); handlers[event].delete(handler); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const { x, y, w, h } = bounds;
      const bodyColor = pressed ? pressedFill : hovering ? hoverFill : fill;
      const body: PathDrawCommand = {
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: h },
        fill: { fill: 'solid', color: bodyColor },
      };
      const text: TextDrawCommand = {
        kind: 'text',
        x: x + 8,                    // 8px left padding
        y: y + h / 2 + fontSize / 3, // rough vertical center
        text: label,
        style: {
          fontFamily: opts.fontFamily ?? ctx.defaultFont,
          fontSize,
          fill: { fill: 'solid', color: textColor },
        },
      };
      return [body, text];
    },
    hitTest(x, y) {
      if (hidden) return false;
      return isInside(x, y);
    },
    onPointer(evt: HudPointerEvent): PointerClaim {
      switch (evt.type) {
        case 'down':
          pressed = true;
          opts.onChange?.();
          return 'claim';
        case 'move': {
          const next = isInside(evt.x, evt.y);
          if (next !== pressed) { pressed = next; opts.onChange?.(); }
          return 'pass';
        }
        case 'up':
          if (pressed && isInside(evt.x, evt.y)) emit('press');
          if (pressed) { pressed = false; opts.onChange?.(); }
          return 'pass';
        case 'cancel':
          if (pressed) { pressed = false; opts.onChange?.(); }
          return 'pass';
        case 'hovermove':
          if (!hovering) { hovering = true; emit('hover'); opts.onChange?.(); }
          return 'pass';
        case 'hoverleave':
          if (hovering) { hovering = false; emit('leave'); opts.onChange?.(); }
          return 'pass';
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
      for (const set of Object.values(handlers)) set.clear();
    },
  };
}
