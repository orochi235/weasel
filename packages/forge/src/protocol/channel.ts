import { type Envelope, PROTOCOL_VERSION } from './messages';

export interface PortLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', fn: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', fn: (event: MessageEvent) => void): void;
  start?(): void;
  close(): void;
}

export interface Channel<In, Out> {
  send(msg: Out): void;
  on(fn: (msg: In) => void): () => void;
  close(): void;
}

export type Mismatch = { reason: 'not-an-envelope' } | { reason: 'version'; version: unknown };

export interface ChannelOptions {
  onMismatch?: (mismatch: Mismatch) => void;
}

export function openChannel<In, Out>(port: PortLike, options: ChannelOptions = {}): Channel<In, Out> {
  const listeners = new Set<(msg: In) => void>();
  const onMessage = (event: MessageEvent) => {
    const data: unknown = event.data;
    if (typeof data !== 'object' || data === null || !('msg' in data)) {
      options.onMismatch?.({ reason: 'not-an-envelope' });
      return;
    }
    const envelope = data as Partial<Envelope<In>>;
    if (envelope.v !== PROTOCOL_VERSION) {
      options.onMismatch?.({ reason: 'version', version: envelope.v });
      return;
    }
    for (const fn of listeners) fn(envelope.msg as In);
  };
  port.addEventListener('message', onMessage);
  port.start?.();
  return {
    send: (msg) => port.postMessage({ v: PROTOCOL_VERSION, msg } satisfies Envelope<Out>),
    on: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close: () => {
      port.removeEventListener('message', onMessage);
      listeners.clear();
      port.close();
    },
  };
}
