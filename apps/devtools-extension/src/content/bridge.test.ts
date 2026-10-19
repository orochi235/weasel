import { describe, it, expect, afterEach } from 'vitest';
import { portPair } from '../testing/fakePorts';
import { createContentBridge } from './bridge';
import { DEVTOOLS_ENVELOPE as ENVELOPE, DEVTOOLS_PROTOCOL as PROTOCOL } from '@weasel-js/core/devtools-protocol';

const sup = { type: 'sup', protocol: PROTOCOL, kitVersion: 'x', roots: [] };

/** A `message` event as the browser fires it; jsdom's own `postMessage` leaves `source` null. */
function post(data: unknown, source: MessageEventSource | null = window): void {
  window.dispatchEvent(new MessageEvent('message', { data, source }));
}

const stops: (() => void)[] = [];
afterEach(() => { for (const s of stops.splice(0)) s(); });

function bridge() {
  const [local, remote] = portPair('page');
  stops.push(createContentBridge(window, local));
  return remote;
}

describe('the content-script bridge', () => {
  it('forwards what the page posts to the port', () => {
    const background = bridge();
    post({ source: ENVELOPE, side: 'page', message: sup });
    expect(background.received).toEqual([sup]);
  });

  it('ignores a message without the devtools tag', () => {
    const background = bridge();
    post({ side: 'page', message: sup });
    post({ source: 'react-devtools', side: 'page', message: sup });
    post('weasel-devtools');
    expect(background.received).toEqual([]);
  });

  it('ignores a message from another window', () => {
    const background = bridge();
    const other = document.createElement('iframe');
    document.body.append(other);
    post({ source: ENVELOPE, side: 'page', message: sup }, other.contentWindow);
    post({ source: ENVELOPE, side: 'page', message: sup }, null);
    other.remove();
    expect(background.received).toEqual([]);
  });

  it('ignores its own posts to the page', () => {
    const background = bridge();
    post({ source: ENVELOPE, side: 'panel', message: { type: 'yo', protocol: PROTOCOL } });
    expect(background.received).toEqual([]);
  });

  it('posts what the port sends to the page as panel traffic', async () => {
    const background = bridge();
    const heard = new Promise<unknown>((resolve) => {
      window.addEventListener('message', (e) => resolve(e.data), { once: true });
    });
    background.postMessage({ type: 'yo', protocol: PROTOCOL });
    expect(await heard).toEqual({ source: ENVELOPE, side: 'panel', message: { type: 'yo', protocol: PROTOCOL } });
  });

  it('says bye to the page when the port goes, and stops forwarding', async () => {
    const background = bridge();
    background.postMessage({ type: 'yo', protocol: 7 });
    await new Promise((r) => setTimeout(r));
    const heard = new Promise<unknown>((resolve) => {
      window.addEventListener('message', (e) => resolve(e.data), { once: true });
    });
    background.disconnect();
    expect(await heard).toEqual({ source: ENVELOPE, side: 'panel', message: { type: 'bye', protocol: 7 } });
    post({ source: ENVELOPE, side: 'page', message: sup });
    expect(background.received).toEqual([]);
  });

  it('does not repeat a bye the panel already sent', async () => {
    const background = bridge();
    background.postMessage({ type: 'yo', protocol: PROTOCOL });
    background.postMessage({ type: 'bye', protocol: PROTOCOL });
    await new Promise((r) => setTimeout(r));
    const heard: unknown[] = [];
    const listen = (e: MessageEvent) => heard.push(e.data);
    window.addEventListener('message', listen);
    background.disconnect();
    await new Promise((r) => setTimeout(r));
    window.removeEventListener('message', listen);
    expect(heard).toEqual([]);
  });

  it('says nothing to the page on disconnect when no panel ever said yo', async () => {
    const background = bridge();
    const heard: unknown[] = [];
    const listen = (e: MessageEvent) => heard.push(e.data);
    window.addEventListener('message', listen);
    background.disconnect();
    await new Promise((r) => setTimeout(r));
    window.removeEventListener('message', listen);
    expect(heard).toEqual([]);
  });
});
