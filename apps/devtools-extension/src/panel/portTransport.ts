/**
 * The panel's end of the connection, over a port to the background. An MV3
 * background is stopped when idle, which drops the port; the transport then
 * opens another and says `yo` again, so the page starts a fresh session.
 */
import { DEVTOOLS_PROTOCOL, type PageMessage, type PanelMessage, type PanelTransport } from '@weasel-js/core/devtools-protocol';
import { createEmitter } from '@weasel-js/registry';
import type { PortLike } from '../browserApi';
import { PORT_PANEL, type PanelHello } from '../envelope';

export interface PortTransport extends PanelTransport {
  /** Disconnect for good. */
  close(): void;
}

/** A transport to the page in tab `tabId`, over ports `connect` opens. */
export function createPortTransport(tabId: number, connect: (name: string) => PortLike): PortTransport {
  const listeners = createEmitter<[m: PageMessage]>();
  let yo: PanelMessage | null = null;
  let closed = false;
  let port: PortLike | null = null;
  /** The requests sent on the current port that it has not answered; a port that drops never will. */
  const asked = new Set<number>();
  const answer = (requestId: number, message = 'weasel devtools: the connection to the page restarted'): void =>
    listeners.emit({ type: 'error', protocol: DEVTOOLS_PROTOCOL, requestId, message });

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
    p.onMessage.addListener((m) => {
      const message = m as PageMessage;
      if ((message.type === 'result' || message.type === 'error') && message.requestId !== null) asked.delete(message.requestId);
      listeners.emit(message);
    });
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = null;
      const lost = [...asked];
      asked.clear();
      for (const requestId of lost) answer(requestId);
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
      const p = port ?? open();
      if (!p) {
        if ('requestId' in message) answer(message.requestId, 'weasel devtools: the panel is disconnected from the page');
        return;
      }
      if ('requestId' in message) asked.add(message.requestId);
      p.postMessage(message);
    },
    onMessage: listeners.subscribe,
    close() {
      closed = true;
      const p = port;
      port = null;
      p?.disconnect();
    },
  };
}
