/**
 * How devtools messages travel. A transport sends one side's messages and
 * hears the other side's; the session neither knows nor cares which kind it has.
 */
import type { PageMessage, PanelMessage } from './protocol';

export interface DevtoolsTransport<Out, In> {
  send(message: Out): void;
  /** Hear the other side. Returns the unsubscribe. */
  onMessage(listener: (message: In) => void): () => void;
}

/** The page's end of a connection. */
export type PageTransport = DevtoolsTransport<PageMessage, PanelMessage>;
/** The panel's end of a connection. */
export type PanelTransport = DevtoolsTransport<PanelMessage, PageMessage>;

/** Marks devtools traffic among whatever else a page posts to its window. */
export const DEVTOOLS_ENVELOPE = 'weasel-devtools';

/** A devtools message as posted to a window. */
export interface DevtoolsEnvelope {
  source: typeof DEVTOOLS_ENVELOPE;
  side: 'page' | 'panel';
  message: PageMessage | PanelMessage;
}

export function isDevtoolsEnvelope(data: unknown): data is DevtoolsEnvelope {
  return typeof data === 'object' && data !== null
    && (data as { source?: unknown }).source === DEVTOOLS_ENVELOPE;
}

function pair<A, B>(): [DevtoolsTransport<A, B>, DevtoolsTransport<B, A>] {
  const toA = new Set<(m: B) => void>();
  const toB = new Set<(m: A) => void>();
  const listen = <M>(set: Set<(m: M) => void>) => (listener: (m: M) => void) => {
    set.add(listener);
    return () => { set.delete(listener); };
  };
  return [
    { send: (m) => { for (const l of [...toB]) l(m); }, onMessage: listen(toA) },
    { send: (m) => { for (const l of [...toA]) l(m); }, onMessage: listen(toB) },
  ];
}

/** Both ends of a connection within one page: delivery is a direct, synchronous call. */
export function createInPageTransports(): { page: PageTransport; panel: PanelTransport } {
  const [page, panel] = pair<PageMessage, PanelMessage>();
  return { page, panel };
}

function windowTransport<Out extends PageMessage | PanelMessage, In>(
  side: 'page' | 'panel',
  target: Window,
): DevtoolsTransport<Out, In> {
  return {
    send(message) {
      const envelope: DevtoolsEnvelope = { source: DEVTOOLS_ENVELOPE, side, message };
      target.postMessage(envelope, '*');
    },
    onMessage(listener) {
      const onEvent = (e: MessageEvent): void => {
        if (isDevtoolsEnvelope(e.data) && e.data.side !== side) listener(e.data.message as In);
      };
      target.addEventListener('message', onEvent);
      return () => target.removeEventListener('message', onEvent);
    },
  };
}

/** The page's end over `window.postMessage`, for an extension's content script. */
export function createWindowPageTransport(target: Window = window): PageTransport {
  return windowTransport<PageMessage, PanelMessage>('page', target);
}

/** The panel's end over `window.postMessage`: what a content script uses to reach the page. */
export function createWindowPanelTransport(target: Window = window): PanelTransport {
  return windowTransport<PanelMessage, PageMessage>('panel', target);
}
