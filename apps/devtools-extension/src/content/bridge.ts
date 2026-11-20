/**
 * The content script's half of the extension: carries devtools envelopes
 * between the page's window and a port to the background. It reads only
 * `message` events, never page objects.
 */
import { isPageMessage, isPanelMessage } from '@weasel-js/devtools/protocol';
import type { PortLike } from '../browserApi';
import { envelopeFrom, wrap } from '../envelope';

/** Bridge `win` and `port` until the port disconnects or the returned stop is called. */
export function createContentBridge(win: Window, port: PortLike, onClose?: () => void): () => void {
  // The panel's open `yo`, for the `bye` sent on its behalf when the port goes.
  let yo: { protocol: number; session?: string } | null = null;

  const fromPage = (e: MessageEvent): void => {
    if (e.source !== win || !envelopeFrom(e.data, 'page') || !isPageMessage(e.data.message)) return;
    port.postMessage(e.data.message);
  };
  const fromPanel = (message: unknown): void => {
    if (!isPanelMessage(message)) return;
    if (message.type === 'yo') yo = { protocol: message.protocol, ...(message.session !== undefined ? { session: message.session } : {}) };
    else if (message.type === 'bye') yo = null;
    win.postMessage(wrap('panel', message), '*');
  };
  const stop = (): void => {
    win.removeEventListener('message', fromPage);
    port.onMessage.removeListener(fromPanel);
    port.onDisconnect.removeListener(lost);
    onClose?.();
  };
  // The panel, the background, or the whole extension went: the page should not keep its overlays.
  const lost = (): void => {
    stop();
    if (yo !== null) win.postMessage(wrap('panel', { type: 'bye', ...yo }), '*');
  };

  win.addEventListener('message', fromPage);
  port.onMessage.addListener(fromPanel);
  port.onDisconnect.addListener(lost);
  return () => {
    stop();
    port.disconnect();
  };
}
