import type { MenuHost } from '@weasel-js/core';
import type { Hud } from '../hud';
import type { Widget } from '../widget';
import { createMenuWidget, type MenuWidgetOptions } from './menuWidget';

/** What {@link attachMenuHost} needs beyond the hud and host. `measure` defaults to {@link canvasMeasure} in Inter. */
export type AttachMenuHostOptions =
  Pick<MenuWidgetOptions, 'toCanvas' | 'canvasSize'> & Partial<Pick<MenuWidgetOptions, 'measure' | 'metrics'>>;

/** Measures with a 2D canvas in the given family. Matches the atlas font
 *  only as closely as the browser's copy of that family does. */
export function canvasMeasure(fontFamily: string): (text: string, fontSize: number) => number {
  const ctx = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('2d') : null;
  return (text, size) => {
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${size}px ${fontFamily}`;
    return ctx.measureText(text).width;
  };
}

/** Draw `host`'s open menu as a widget on `hud`, focused while open. A press
 *  anywhere else takes focus from it, which closes the menu. Returns a detach. */
export function attachMenuHost(hud: Hud, host: MenuHost, opts: AttachMenuHostOptions): () => void {
  let widget: Widget | null = null;
  const measure = opts.measure ?? canvasMeasure('Inter, sans-serif');

  // Cleared before removal: removing the focused widget blurs it, and that
  // blur must not read as a press elsewhere.
  const drop = () => {
    const w = widget;
    widget = null;
    if (!w) return;
    hud.remove(w);
    if (!w.disposed) w.dispose();
  };

  const sync = () => {
    const open = host.current();
    drop();
    if (!open) return;
    const w = createMenuWidget({
      ...opts, measure, open,
      close: () => { if (host.current() === open) host.close(); },
      onChange: () => hud.markDirty(),
    });
    widget = w;
    hud.add(w);
    if (!hud.focus(w)) drop();
  };

  const unsubscribe = host.subscribe(sync);
  const unfocus = hud.subscribeFocus((f) => { if (widget && f !== widget) host.close(); });
  sync();
  return () => { unsubscribe(); unfocus(); drop(); };
}
