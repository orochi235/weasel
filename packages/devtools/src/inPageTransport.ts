import { createInPageTransports, type PanelTransport } from './protocol';
import { installDevtoolsHook, type WeaselDevtoolsHook } from './hook';

/**
 * A panel's end of a connection to this page's own hook. Each `yo` opens a
 * fresh session and each `bye` ends it, the way a `yo` posted to the window
 * does, so a panel that unmounts and mounts again reconnects. Two clients
 * sharing one transport get one session between them, the later `yo`'s: the
 * earlier client hears the later one's `sup` and reports itself replaced.
 * Installs the hook when the page has none.
 */
export function createInPagePanelTransport(hook: WeaselDevtoolsHook | null = installDevtoolsHook()): PanelTransport {
  const { page, panel } = createInPageTransports();
  let close: (() => void) | null = null;
  let session: string | undefined;
  return {
    send(message) {
      if (message.type === 'yo' && hook) {
        close?.();
        close = hook.connect(page);
        session = message.session;
      }
      panel.send(message);
      // A bye from a panel whose session a later yo replaced leaves the later one open.
      if (message.type === 'bye' && (message.session === undefined || session === undefined || message.session === session)) {
        close?.();
        close = null;
      }
    },
    onMessage: (listener) => panel.onMessage(listener),
  };
}
