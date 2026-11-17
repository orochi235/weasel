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

/** Where a content script marks its world as bridged. */
export interface BridgeScope {
  __weaselDevtoolsBridge__?: unknown;
}

/**
 * {@link startContentScript}, unless a live copy already runs in `scope`. The background injects the
 * content script into tabs that loaded before the extension did, so it may run twice. A copy orphaned
 * by an extension reload keeps its globals but not its runtime, and Chrome runs the reloaded
 * extension's injection in the same world, so the mark asks whether its runtime still lives.
 */
export function startContentScriptOnce(api: ExtensionApi, win: Window, scope: BridgeScope): void {
  const mark = scope.__weaselDevtoolsBridge__ as { alive?: unknown } | undefined;
  if (typeof mark?.alive === 'function' && mark.alive() === true) return;
  scope.__weaselDevtoolsBridge__ = {
    alive: (): boolean => {
      try {
        return Boolean(api.runtime.id);
      } catch {
        return false;
      }
    },
  };
  startContentScript(api, win);
}
