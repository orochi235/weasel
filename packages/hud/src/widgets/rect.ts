import type { Widget, HudDrawCtx, HudPointerEvent, WidgetBounds } from '../widget';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import type { RectPath } from '@weasel-js/core';

/** Options for a filled rectangle widget. */
export interface RectOptions {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  /** Called whenever a setter mutates state. The Hud's `rect()` factory
   *  injects this so mutations trigger `requestRedraw`. Direct callers of
   *  `createRect` may set it themselves or omit it (no auto-redraw). */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

/** A solid filled rectangle — backdrops, dividers, and the base other
 *  widgets are composed on. */
export interface RectWidget extends Widget {
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  setFill(color: string): void;
  dispose(): void;
}

export function createRect(opts: RectOptions): RectWidget {
  if (opts.w <= 0 || opts.h <= 0) {
    throw new Error(`createRect: bounds must have positive w/h (got ${opts.w}x${opts.h})`);
  }
  let disposed = false;
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
  let hidden = false;
  let fill = opts.fill;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setFill(c) { assertNotDisposed(); fill = c; opts.onChange?.(); },
    draw(_ctx: HudDrawCtx): DrawCommand[] {
      const { x, y, w, h } = bounds;
      const path: RectPath = { kind: 'rect', x, y, width: w, height: h };
      const cmd: PathDrawCommand = {
        kind: 'path',
        path,
        fill: { fill: 'solid', color: fill },
      };
      return [cmd];
    },
    hitTest(px: number, py: number): boolean {
      if (hidden) return false;
      return px >= bounds.x && px < bounds.x + bounds.w && py >= bounds.y && py < bounds.y + bounds.h;
    },
    claims: [],
    onPointer(_evt: HudPointerEvent): void {},
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
