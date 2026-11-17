/**
 * The panel's end of the connection, over a port to the background. An MV3
 * background is stopped when idle, which drops the port; the transport then
 * opens another and says `yo` again, so the page starts a fresh session.
 */
import { DEVTOOLS_PROTOCOL, isPageMessage, type PageMessage, type PanelMessage, type PanelTransport } from '@weasel-js/devtools/protocol';
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
  /**
   * The requests sent on the current port that it has not answered, by the id this transport gave
   * each, to the id its client did; a port that drops never will answer. A client numbers its
   * requests from 1, and each panel mount brings a new client, so the transport numbers them for
   * its own lifetime: a late answer to an earlier client's request then settles nothing.
   */
  const asked = new Map<number, number>();
  let nextId = 1;
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
    p.onMessage.addListener((message) => {
      if (!isPageMessage(message)) return;
      if ((message.type === 'result' || message.type === 'error') && message.requestId !== null) {
        const requestId = asked.get(message.requestId);
        if (requestId === undefined) return;
        asked.delete(message.requestId);
        listeners.emit({ ...message, requestId });
        return;
      }
      listeners.emit(message);
    });
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = null;
      const lost = [...asked.values()];
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
      // A new session: no answer to a request from before it is its client's.
      if (message.type === 'yo') {
        yo = message;
        asked.clear();
      } else if (message.type === 'bye') yo = null;
      const p = port ?? open();
      if (!p) {
        if ('requestId' in message) answer(message.requestId, 'weasel devtools: the panel is disconnected from the page');
        return;
      }
      if (!('requestId' in message)) return p.postMessage(message);
      const id = nextId++;
      asked.set(id, message.requestId);
      p.postMessage({ ...message, requestId: id });
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
