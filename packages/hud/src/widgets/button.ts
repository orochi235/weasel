import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent } from '../widget';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import { textCommand } from '@weasel-js/core';

/** The events a button reports through `on` / `off`. */
export type ButtonEvent = 'press' | 'hover' | 'leave';
/** A button event listener. */
export type ButtonHandler = () => void;

/** Options for a button widget. The three fill colors cover its rest, hover
 *  and pressed states. */
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
  /** CSS cursor over the button's bounds. Defaults to `'pointer'`. */
  cursor?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

/** A clickable labeled box that tracks hover and press state itself and
 *  reports them to listeners. */
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
    get disposed() { return disposed; },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setLabel(l) { assertNotDisposed(); label = l; opts.onChange?.(); },
    on(event, handler) { assertNotDisposed(); handlers[event].add(handler); },
    off(event, handler) { assertNotDisposed(); handlers[event].delete(handler); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const fill        = opts.fill        ?? ctx.tokens['--wzl-surface-raised'];
      const hoverFill   = opts.hoverFill   ?? ctx.tokens['--wzl-surface-hover'];
      const pressedFill = opts.pressedFill ?? ctx.tokens['--wzl-surface-pressed'];
      const textColor   = opts.textColor   ?? ctx.tokens['--wzl-fg'];
      const { x, y, w, h } = bounds;
      const bodyColor = pressed ? pressedFill : hovering ? hoverFill : fill;
      const body: PathDrawCommand = {
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: h },
        fill: { fill: 'solid', color: bodyColor },
      };
      const text = textCommand(
        x + 8,                    // 8px left padding
        y + h / 2 + fontSize / 3, // rough vertical center
        label,
        {
          fontFamily: opts.fontFamily ?? ctx.defaultFont,
          fontSize,
          fill: { fill: 'solid', color: textColor },
        },
      );
      return [body, text];
    },
    hitTest(x, y) {
      if (hidden) return false;
      return isInside(x, y);
    },
    cursorAt(x, y) {
      if (hidden || !isInside(x, y)) return 'default';
      return opts.cursor ?? 'pointer';
    },
    onPointer(evt: HudPointerEvent): void {
      switch (evt.type) {
        case 'down':
          pressed = true;
          opts.onChange?.();
          break;
        case 'move': {
          const next = isInside(evt.x, evt.y);
          if (next !== pressed) { pressed = next; opts.onChange?.(); }
          break;
        }
        case 'up':
          if (pressed && isInside(evt.x, evt.y)) emit('press');
          if (pressed) { pressed = false; opts.onChange?.(); }
          break;
        case 'cancel':
          if (pressed) { pressed = false; opts.onChange?.(); }
          break;
        case 'hovermove':
          if (!hovering) { hovering = true; emit('hover'); opts.onChange?.(); }
          break;
        case 'hoverleave':
          if (hovering) { hovering = false; emit('leave'); opts.onChange?.(); }
          break;
        // A double-click already fired two presses; the rest are claimed so
        // they don't reach the scene, not because a button reacts to them.
        default:
          break;
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
