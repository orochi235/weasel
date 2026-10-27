import type { MenuHost } from '@weasel-js/core';
import type { Hud } from '../hud';
import type { Widget } from '../widget';
import { createMenuWidget, type MenuWidgetOptions } from './menuWidget';

/** What {@link attachMenuHost} needs beyond the hud and host. */
export type AttachMenuHostOptions =
  Pick<MenuWidgetOptions, 'toCanvas' | 'canvasSize' | 'measure' | 'metrics' | 'icons' | 'palette'>;

/** Draw `host`'s open menu as a widget on `hud`, focused while open. A press
 *  anywhere else takes focus from it, which closes the menu, as do a wheel
 *  outside it, the window losing focus and a resize. Closing any other way
 *  gives focus back to the widget that held it when the menu opened. Returns a detach. */
export function attachMenuHost(hud: Hud, host: MenuHost, opts: AttachMenuHostOptions): () => void {
  let widget: Widget | null = null;
  let returnTo: { widget: Widget | null; visible: boolean } = { widget: null, visible: false };

  // Cleared before removal: removing the focused widget blurs it, and that
  // blur must not read as a press elsewhere.
  const drop = () => {
    const w = widget;
    widget = null;
    if (!w) return;
    hud.remove(w);
    if (!w.disposed) w.dispose();
  };

  const giveBack = () => {
    const { widget: w, visible } = returnTo;
    returnTo = { widget: null, visible: false };
    if (w) hud.focus(w, { visible });
  };

  const sync = () => {
    const open = host.current();
    if (!widget) returnTo = { widget: hud.focused, visible: hud.focusVisible };
    const held = widget !== null && hud.focused === widget;
    drop();
    if (!open) {
      if (held) giveBack();
      return;
    }
    const w = createMenuWidget({
      ...opts, open,
      close: () => { if (host.current() === open) host.close(); },
      onChange: () => hud.markDirty(),
    });
    widget = w;
    hud.add(w);
    // A menu that cannot take focus could never be dismissed, so it does not open.
    if (!hud.focus(w)) { drop(); host.close(); }
  };

  const dismiss = () => { if (widget) host.close(); };
  const wheel = (e: WheelEvent) => {
    if (!widget) return;
    const p = opts.toCanvas({ x: e.clientX, y: e.clientY });
    if (!widget.hitTest(p.x, p.y)) host.close();
  };

  const unsubscribe = host.subscribe(sync);
  const unfocus = hud.subscribeFocus((f) => { if (widget && f !== widget) host.close(); });
  window.addEventListener('wheel', wheel, { capture: true, passive: true });
  window.addEventListener('blur', dismiss);
  window.addEventListener('resize', dismiss);
  sync();
  return () => {
    unsubscribe();
    unfocus();
    window.removeEventListener('wheel', wheel, true);
    window.removeEventListener('blur', dismiss);
    window.removeEventListener('resize', dismiss);
    drop();
  };
}
