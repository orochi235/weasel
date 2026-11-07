import { describe, it, expect } from 'vitest';
import { portPair, type FakePort } from '../testing/fakePorts';
import { DEVTOOLS_PROTOCOL as PROTOCOL } from '@weasel-js/core/devtools-protocol';
import { PORT_PANEL } from '../envelope';
import { createPortTransport } from './portTransport';

const yo = { type: 'yo', protocol: PROTOCOL } as const;
const sup = { type: 'sup', protocol: PROTOCOL, kitVersion: '1', roots: [] } as const;

function setup() {
  const backgrounds: FakePort[] = [];
  const names: string[] = [];
  const transport = createPortTransport(9, (name) => {
    names.push(name);
    const [local, remote] = portPair(name);
    backgrounds.push(remote);
    return local;
  });
  return { transport, backgrounds, names };
}

describe('the panel’s port transport', () => {
  it('says which tab it inspects before anything else', () => {
    const { transport, backgrounds, names } = setup();
    transport.send(yo);
    expect(names).toEqual([PORT_PANEL]);
    expect(backgrounds[0]!.received).toEqual([{ inspect: 9 }, yo]);
  });

  it('hands each listener what the port carries, until it unsubscribes', () => {
    const { transport, backgrounds } = setup();
    const heard: unknown[] = [];
    const off = transport.onMessage((m) => heard.push(m));
    backgrounds[0]!.postMessage(sup);
    off();
    backgrounds[0]!.postMessage(sup);
    expect(heard).toEqual([sup]);
  });

  it('reconnects when the background goes, and says yo again', () => {
    const { transport, backgrounds } = setup();
    const heard: unknown[] = [];
    transport.onMessage((m) => heard.push(m));
    transport.send(yo);
    backgrounds[0]!.disconnect();
    expect(backgrounds).toHaveLength(2);
    expect(backgrounds[1]!.received).toEqual([{ inspect: 9 }, yo]);
    backgrounds[1]!.postMessage(sup);
    expect(heard).toEqual([sup]);
  });

  it('answers the requests the background went without answering, and none it answered', () => {
    const { transport, backgrounds } = setup();
    const heard: unknown[] = [];
    transport.onMessage((m) => heard.push(m));
    transport.send(yo);
    const ask = (requestId: number) => transport.send({ type: 'get-state', protocol: PROTOCOL, requestId, rootId: 'root-1' });
    ask(1);
    ask(2);
    backgrounds[0]!.postMessage({ type: 'result', protocol: PROTOCOL, requestId: 1, result: null });
    backgrounds[0]!.disconnect();
    ask(3);
    expect(heard.slice(1)).toEqual([
      { type: 'error', protocol: PROTOCOL, requestId: 2, message: 'weasel devtools: the connection to the page restarted' },
    ]);
    expect(backgrounds[1]!.received.at(-1)).toMatchObject({ requestId: 3 });
  });

  it('does not say yo again after it said bye', () => {
    const { transport, backgrounds } = setup();
    transport.send(yo);
    transport.send({ type: 'bye', protocol: PROTOCOL });
    backgrounds[0]!.disconnect();
    expect(backgrounds[1]!.received).toEqual([{ inspect: 9 }]);
  });

  it('stays closed once closed', () => {
    const { transport, backgrounds } = setup();
    transport.close();
    expect(backgrounds[0]!.closed).toBe(true);
    transport.send(yo);
    expect(backgrounds).toHaveLength(1);
  });
});
