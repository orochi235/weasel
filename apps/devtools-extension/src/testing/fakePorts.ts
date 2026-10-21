/**
 * Both ends of a fake `runtime.Port`. Delivery is synchronous; as with a real
 * port, `disconnect` fires `onDisconnect` on the other end only, and a closed
 * port drops what is posted to it.
 */
import type { ExtEvent, PortLike } from '../browserApi';

function event<A extends unknown[]>(): ExtEvent<A> & { fire(...args: A): void } {
  const listeners = new Set<(...args: A) => void>();
  return {
    addListener: (l) => { listeners.add(l); },
    removeListener: (l) => { listeners.delete(l); },
    fire: (...args) => { for (const l of [...listeners]) l(...args); },
  };
}

export interface FakePort extends PortLike {
  /** Everything this end received, in order. */
  readonly received: unknown[];
  readonly closed: boolean;
}

interface End extends FakePort {
  deliver(m: unknown): void;
  hangUp(): void;
}

/** `[local, remote]`: `local` is what the connecting side holds, `remote` what `onConnect` hands the other. */
export function portPair(name: string, sender?: PortLike['sender']): [FakePort, FakePort] {
  let closed = false;
  const ends: End[] = [];
  const make = (index: number, s?: PortLike['sender']): End => {
    const onMessage = event<[unknown, PortLike]>();
    const onDisconnect = event<[PortLike]>();
    const received: unknown[] = [];
    const end: End = {
      name, sender: s, received, onMessage, onDisconnect,
      get closed() { return closed; },
      postMessage: (m) => { if (!closed) ends[1 - index]!.deliver(m); },
      disconnect: () => {
        if (closed) return;
        closed = true;
        ends[1 - index]!.hangUp();
      },
      deliver: (m) => { received.push(m); onMessage.fire(m, end); },
      hangUp: () => onDisconnect.fire(end),
    };
    return end;
  };
  ends.push(make(0), make(1, sender));
  return [ends[0]!, ends[1]!];
}
