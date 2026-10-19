import {
  createInPageTransports, installDevtoolsHook, type PanelTransport, type WeaselDevtoolsHook,
} from '@weasel-js/core/devtools-protocol';

/**
 * A panel's end of a connection to this page's own hook. Each `yo` opens a
 * fresh session and each `bye` ends it, the way a `yo` posted to the window
 * does, so a panel that unmounts and mounts again reconnects. Installs the
 * hook when the page has none.
 */
export function createInPagePanelTransport(hook: WeaselDevtoolsHook | null = installDevtoolsHook()): PanelTransport {
  const { page, panel } = createInPageTransports();
  let close: (() => void) | null = null;
  return {
    send(message) {
      if (message.type === 'yo' && hook) {
        close?.();
        close = hook.connect(page);
      }
      panel.send(message);
      if (message.type === 'bye') {
        close?.();
        close = null;
      }
    },
    onMessage: (listener) => panel.onMessage(listener),
  };
}
