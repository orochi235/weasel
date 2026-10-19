/**
 * The content script's half of the extension: carries devtools envelopes
 * between the page's window and a port to the background. It reads only
 * `message` events, never page objects.
 */
import type { PanelMessage } from '@weasel-js/core/devtools';
import type { PortLike } from '../browserApi';
import { envelopeFrom, wrap } from '../envelope';

/** Bridge `win` and `port` until the port disconnects or the returned stop is called. */
export function createContentBridge(win: Window, port: PortLike, onClose?: () => void): () => void {
  let protocol: number | null = null;

  const fromPage = (e: MessageEvent): void => {
    if (e.source !== win || !envelopeFrom(e.data, 'page')) return;
    port.postMessage(e.data.message);
  };
  const fromPanel = (m: unknown): void => {
    const message = m as PanelMessage;
    if (message.type === 'yo') protocol = message.protocol;
    else if (message.type === 'bye') protocol = null;
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
    if (protocol !== null) win.postMessage(wrap('panel', { type: 'bye', protocol }), '*');
  };

  win.addEventListener('message', fromPage);
  port.onMessage.addListener(fromPanel);
  port.onDisconnect.addListener(lost);
  return () => {
    stop();
    port.disconnect();
  };
}
