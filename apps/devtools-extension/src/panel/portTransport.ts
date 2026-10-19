/**
 * The panel's end of the connection, over a port to the background. An MV3
 * background is stopped when idle, which drops the port; the transport then
 * opens another and says `yo` again, so the page starts a fresh session.
 */
import type { PageMessage, PanelMessage, PanelTransport } from '@weasel-js/core/devtools-protocol';
import type { PortLike } from '../browserApi';
import { PORT_PANEL, type PanelHello } from '../envelope';

export interface PortTransport extends PanelTransport {
  /** Disconnect for good. */
  close(): void;
}

/** A transport to the page in tab `tabId`, over ports `connect` opens. */
export function createPortTransport(tabId: number, connect: (name: string) => PortLike): PortTransport {
  const listeners = new Set<(m: PageMessage) => void>();
  let yo: PanelMessage | null = null;
  let closed = false;
  let port: PortLike | null = null;

  const open = (): PortLike | null => {
    if (closed) return null;
    try {
      port = connect(PORT_PANEL);
    } catch {
      // The extension was reloaded or removed under this panel; nothing to reconnect to.
      closed = true;
      return null;
    }
    const p = port;
    p.onMessage.addListener((m) => { for (const l of [...listeners]) l(m as PageMessage); });
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = null;
      const opened = open();
      if (opened && yo) opened.postMessage(yo);
    });
    p.postMessage({ inspect: tabId } satisfies PanelHello);
    return p;
  };
  open();

  return {
    send(message) {
      if (message.type === 'yo') yo = message;
      else if (message.type === 'bye') yo = null;
      (port ?? open())?.postMessage(message);
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    close() {
      closed = true;
      const p = port;
      port = null;
      p?.disconnect();
    },
  };
}
