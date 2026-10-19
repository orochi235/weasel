/**
 * The content script's lifecycle: connect as it loads when its tab already
 * has a panel open, and otherwise when the background asks — a panel opened,
 * or said `yo`. A tab nobody inspects never connects.
 */
import type { ExtensionApi } from '../browserApi';
import { HELLO, PORT_PAGE, isConnectRequest } from '../envelope';
import { createContentBridge } from './bridge';

export function startContentScript(api: ExtensionApi, win: Window): void {
  let connected = false;
  const connect = (): void => {
    if (connected) return;
    connected = true;
    createContentBridge(win, api.runtime.connect({ name: PORT_PAGE }), () => { connected = false; });
  };

  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!isConnectRequest(message)) return;
    respond(true);
    connect();
  });
  api.runtime.sendMessage(HELLO).then(
    (panelOpen) => { if (panelOpen === true) connect(); },
    () => {},
  );
}
