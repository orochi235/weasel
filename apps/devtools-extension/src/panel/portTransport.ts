/**
 * The panel's end of the connection, over a port to the background. An MV3
 * background is stopped when idle, which drops the port; the transport then
 * opens another and says `yo` again, so the page starts a fresh session. A
 * transport another panel replaced goes for good.
 */
import { DEVTOOLS_PROTOCOL, isPageMessage, type PageMessage, type PanelMessage, type PanelTransport } from '@weasel-js/devtools/protocol';
import { after, createEmitter } from '@weasel-js/registry';
import type { PortLike } from '../browserApi';
import { PORT_PANEL, isReplaced, type PanelHello } from '../envelope';

/** The wait before the second of several ports in a row that dropped carrying nothing; it doubles with each, up to the max. */
export const RETRY_MS = 250;
export const RETRY_MAX_MS = 30_000;

export interface PortTransport extends PanelTransport {
  /** Disconnect for good. */
  close(): void;
}

/** A transport to the page in tab `tabId`, over ports `connect` opens. */
export function createPortTransport(tabId: number, connect: (name: string) => PortLike): PortTransport {
  const listeners = createEmitter<[m: PageMessage]>();
  let yo: Extract<PanelMessage, { type: 'yo' }> | null = null;
  let closed = false;
  let port: PortLike | null = null;
  /**
   * The requests sent on the current port that it has not answered, by the id this transport gave
   * each, to the id its client did; a port that drops never will answer. A client numbers its
   * requests from 1, and each panel mount brings a new client, so the transport numbers them for
   * its own lifetime: a late answer to an earlier client's request then settles nothing. Each keeps
   * the root it asks about, since the page never answers a request about a root that went.
   */
  const asked = new Map<number, { requestId: number; rootId: string }>();
  let nextId = 1;
  const answer = (requestId: number, message = 'weasel devtools: the connection to the page restarted'): void =>
    listeners.emit({ type: 'error', protocol: DEVTOOLS_PROTOCOL, requestId, message });
  const answerAll = (message?: string): void => {
    const lost = [...asked.values()];
    asked.clear();
    for (const { requestId } of lost) answer(requestId, message);
  };
  const forget = (gone: (rootId: string) => boolean): void => {
    for (const [id, { rootId }] of asked) if (gone(rootId)) asked.delete(id);
  };
  // Ports in a row that dropped before carrying anything: a background that hangs up at once is not one to call straight back.
  let quiet = 0;
  let retry: (() => void) | null = null;
  const reopen = (): void => {
    retry = null;
    const opened = open();
    if (opened && yo) opened.postMessage(yo);
  };

  const replaced = (p: PortLike): void => {
    const message = 'weasel devtools: another devtools panel connected to this tab in place of this one';
    closed = true;
    port = null;
    p.disconnect();
    answerAll(message);
    listeners.emit({ type: 'error', protocol: DEVTOOLS_PROTOCOL, requestId: null, message });
  };

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
    let heard = false;
    p.onMessage.addListener((message) => {
      if (port !== p) return;
      heard = true;
      if (isReplaced(message)) return replaced(p);
      if (!isPageMessage(message)) return;
      if ((message.type === 'result' || message.type === 'error') && message.requestId !== null) {
        const request = asked.get(message.requestId);
        if (!request) return;
        asked.delete(message.requestId);
        listeners.emit({ ...message, requestId: request.requestId });
        return;
      }
      if (message.session === undefined || message.session === yo?.session) {
        if (message.type === 'root-removed') forget((rootId) => rootId === message.rootId);
        if (message.type === 'sup') forget((rootId) => !message.roots.some((r) => r.id === rootId));
      }
      listeners.emit(message);
    });
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = null;
      answerAll();
      quiet = heard ? 0 : quiet + 1;
      if (quiet <= 1) reopen();
      else retry = after(Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** (quiet - 2)), reopen);
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
      const p = port ?? (retry ? null : open());
      if (!p) {
        if ('requestId' in message) answer(message.requestId, 'weasel devtools: the panel is disconnected from the page');
        return;
      }
      if (!('requestId' in message)) return p.postMessage(message);
      const id = nextId++;
      asked.set(id, { requestId: message.requestId, rootId: message.rootId });
      p.postMessage({ ...message, requestId: id });
    },
    onMessage: listeners.subscribe,
    close() {
      closed = true;
      retry?.();
      retry = null;
      const p = port;
      port = null;
      p?.disconnect();
    },
  };
}
