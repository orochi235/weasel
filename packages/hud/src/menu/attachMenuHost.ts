import type { MenuHost } from '@weasel-js/core';
import type { Hud } from '../hud';
import type { Widget } from '../widget';
import { createMenuWidget, type MenuWidgetOptions } from './menuWidget';

/** What {@link attachMenuHost} needs beyond the hud and host. */
export type AttachMenuHostOptions =
  Pick<MenuWidgetOptions, 'toCanvas' | 'canvasSize' | 'measure' | 'metrics'>;

/** Draw `host`'s open menu as a widget on `hud`, focused while open. A press
 *  anywhere else takes focus from it, which closes the menu. Returns a detach. */
export function attachMenuHost(hud: Hud, host: MenuHost, opts: AttachMenuHostOptions): () => void {
  let widget: Widget | null = null;

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
      ...opts, open,
      close: () => { if (host.current() === open) host.close(); },
      onChange: () => hud.markDirty(),
    });
    widget = w;
    hud.add(w);
    // A menu that cannot take focus could never be dismissed, so it does not open.
    if (!hud.focus(w)) { drop(); host.close(); }
  };

  const unsubscribe = host.subscribe(sync);
  const unfocus = hud.subscribeFocus((f) => { if (widget && f !== widget) host.close(); });
  sync();
  return () => { unsubscribe(); unfocus(); drop(); };
}
