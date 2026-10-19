import { describe, it, expect, vi } from 'vitest';
import { portPair, type FakePort } from '../testing/fakePorts';
import { DEVTOOLS_PROTOCOL as PROTOCOL } from '@weasel-js/core/devtools-protocol';
import { PORT_PAGE, PORT_PANEL } from '../envelope';
import { createRelay } from './relay';

const P = PROTOCOL;
const yo = { type: 'yo', protocol: P };
const root = (id: string, label = id) => ({ id, label, dimension: '2d' });
const sup = (...roots: ReturnType<typeof root>[]) => ({ type: 'sup', protocol: P, kitVersion: '1', roots });

function setup() {
  const wake = vi.fn();
  const relay = createRelay({ wake });
  /** A content script in `frameId` of `tabId` connecting; returns its end. */
  const page = (tabId: number, frameId = 0): FakePort => {
    const [local, remote] = portPair(PORT_PAGE, { tab: { id: tabId }, frameId });
    relay.connect(remote);
    return local;
  };
  /** A devtools panel for `tabId` connecting; returns its end. */
  const panel = (tabId: number): FakePort => {
    const [local, remote] = portPair(PORT_PANEL);
    relay.connect(remote);
    local.postMessage({ inspect: tabId });
    return local;
  };
  return { relay, wake, page, panel };
}

describe('the background relay', () => {
  it('routes by tab id, in both directions', () => {
    const { page, panel } = setup();
    const page1 = page(1);
    const page2 = page(2);
    const panel1 = panel(1);
    const panel2 = panel(2);
    panel1.postMessage(yo);
    expect(page1.received).toEqual([yo]);
    expect(page2.received).toEqual([]);
    page2.postMessage(sup(root('root-1')));
    expect(panel2.received).toEqual([sup(root('root-1'))]);
    expect(panel1.received).toEqual([]);
  });

  it('asks a tab to connect when its panel arrives, and replays the yo the panel sent first', () => {
    const { page, panel, wake } = setup();
    const p = panel(4);
    expect(wake).toHaveBeenCalledWith(4);
    p.postMessage(yo);
    const content = page(4);
    expect(content.received).toEqual([yo]);
    content.postMessage(sup(root('root-1')));
    expect(p.received).toEqual([sup(root('root-1'))]);
  });

  it('asks the tab to connect again on each yo, for content scripts a navigation brought', () => {
    const { panel, wake } = setup();
    const p = panel(4);
    p.postMessage(yo);
    p.postMessage(yo);
    expect(wake.mock.calls).toEqual([[4], [4], [4]]);
  });

  it('says whether a tab has a panel, for a content script that just loaded', () => {
    const { relay, panel } = setup();
    expect(relay.panelOpen(2)).toBe(false);
    const p = panel(2);
    expect(relay.panelOpen(2)).toBe(true);
    expect(relay.panelOpen(3)).toBe(false);
    p.disconnect();
    expect(relay.panelOpen(2)).toBe(false);
  });

  it('replays the yo to a frame that loads while the panel is open', () => {
    const { page, panel } = setup();
    const p = panel(1);
    p.postMessage(yo);
    page(1, 0).postMessage(sup(root('root-1')));
    const late = page(1, 3);
    expect(late.received).toEqual([yo]);
    late.postMessage(sup(root('root-1', 'late')));
    expect(p.received.at(-1)).toEqual({ type: 'root-added', protocol: P, root: root('frame3/root-1', 'late (frame 3)') });
  });

  it('serves a content script that connected before the panel', () => {
    const { page, panel } = setup();
    const content = page(3);
    content.postMessage(sup());
    const p = panel(3);
    p.postMessage(yo);
    expect(content.received).toEqual([yo]);
  });

  it('says bye to the page when the panel goes, and lets the page go', () => {
    const { page, panel } = setup();
    const content = page(1);
    const p = panel(1);
    p.postMessage({ type: 'yo', protocol: 9 });
    p.disconnect();
    expect(content.received).toEqual([{ type: 'yo', protocol: 9 }, { type: 'bye', protocol: 9 }]);
    expect(content.closed).toBe(true);
  });

  it('tells the panel a frame’s roots are gone when its content script goes', () => {
    const { page, panel } = setup();
    const p = panel(1);
    p.postMessage(yo);
    const content = page(1);
    content.postMessage(sup(root('root-1'), root('root-2')));
    content.disconnect();
    expect(p.received.slice(1)).toEqual([
      { type: 'root-removed', protocol: P, rootId: 'root-1' },
      { type: 'root-removed', protocol: P, rootId: 'root-2' },
    ]);
    const again = page(1);
    expect(again.received).toEqual([yo]);
  });

  it('keeps each frame’s roots apart, and routes a request to the frame that owns the root', () => {
    const { page, panel } = setup();
    const p = panel(1);
    const top = page(1, 0);
    const sub = page(1, 7);
    p.postMessage(yo);
    top.postMessage(sup(root('root-1', 'main')));
    sub.postMessage(sup(root('root-1', 'demo')));
    expect(p.received).toEqual([
      sup(root('root-1', 'main')),
      { type: 'root-added', protocol: P, root: root('frame7/root-1', 'demo (frame 7)') },
    ]);

    p.postMessage({ type: 'get-state', protocol: P, requestId: 5, rootId: 'frame7/root-1' });
    expect(sub.received.at(-1)).toEqual({ type: 'get-state', protocol: P, requestId: 5, rootId: 'root-1' });
    expect(top.received).toEqual([yo]);

    sub.postMessage({ type: 'changed', protocol: P, rootId: 'root-1', areas: { scene: 2 } });
    expect(p.received.at(-1)).toEqual({ type: 'changed', protocol: P, rootId: 'frame7/root-1', areas: { scene: 2 } });
  });

  it('answers a request for a frame that is not there with an error', () => {
    const { page, panel } = setup();
    const p = panel(1);
    page(1);
    p.postMessage({ type: 'get-state', protocol: P, requestId: 3, rootId: 'frame9/root-1' });
    expect(p.received).toEqual([
      { type: 'error', protocol: P, requestId: 3, message: 'weasel devtools: no frame 9 in this tab' },
    ]);
  });

  it('drops a panel that never says which tab it inspects', () => {
    const { relay, page } = setup();
    const content = page(1);
    const [local, remote] = portPair(PORT_PANEL);
    relay.connect(remote);
    local.postMessage(yo);
    expect(content.received).toEqual([]);
  });
});
