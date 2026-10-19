/**
 * The background's job: pair each devtools panel with the content scripts of
 * the tab it inspects, and carry messages between them. Either side may
 * connect first, and either may go at any time.
 */
import type { DevtoolsRootInfo, PageMessage, PanelMessage } from '@weasel-js/core/devtools';
import type { PortLike } from '../browserApi';
import { PORT_PAGE, PORT_PANEL, PROTOCOL, isPanelHello } from '../envelope';
import { scopePageMessage, unscopeRootId } from './frames';

interface Frame {
  port: PortLike;
  /** The frame's roots as the panel knows them, by scoped id. */
  roots: Map<string, DevtoolsRootInfo>;
}

interface Tab {
  panel: PortLike | null;
  frames: Map<number, Frame>;
  /** The panel's last `yo`, replayed to each frame that connects after it. */
  yo: Extract<PanelMessage, { type: 'yo' }> | null;
  /** Whether the panel has had a `sup` since its last `yo`; later frames' roots arrive as `root-added`. */
  greeted: boolean;
}

export interface RelayOptions {
  /** Ask the tab's unconnected content scripts to connect: a panel opened on it, or said `yo`. */
  wake(tabId: number): void;
}

export interface Relay {
  /** Take a port `runtime.onConnect` handed the background. */
  connect(port: PortLike): void;
}

export function createRelay({ wake }: RelayOptions): Relay {
  const tabs = new Map<number, Tab>();
  const tab = (id: number): Tab => {
    let t = tabs.get(id);
    if (!t) tabs.set(id, t = { panel: null, frames: new Map(), yo: null, greeted: false });
    return t;
  };
  const prune = (id: number): void => {
    const t = tabs.get(id);
    if (t && !t.panel && t.frames.size === 0) tabs.delete(id);
  };

  function fromPage(t: Tab, frameId: number, frame: Frame, raw: PageMessage): void {
    const message = scopePageMessage(frameId, raw);
    if (message.type === 'sup') {
      const before = frame.roots;
      frame.roots = new Map(message.roots.map((r) => [r.id, r]));
      if (!t.greeted) {
        t.greeted = true;
        const roots = [...t.frames.values()].flatMap((f) => [...f.roots.values()]);
        t.panel?.postMessage({ ...message, roots });
        return;
      }
      for (const id of before.keys()) {
        if (!frame.roots.has(id)) t.panel?.postMessage({ type: 'root-removed', protocol: message.protocol, rootId: id });
      }
      for (const root of frame.roots.values()) {
        if (!before.has(root.id)) t.panel?.postMessage({ type: 'root-added', protocol: message.protocol, root });
      }
      return;
    }
    if (message.type === 'root-added') frame.roots.set(message.root.id, message.root);
    if (message.type === 'root-removed') frame.roots.delete(message.rootId);
    t.panel?.postMessage(message);
  }

  function fromPanel(t: Tab, tabId: number, message: PanelMessage): void {
    if (message.type === 'yo') {
      t.yo = message;
      t.greeted = false;
      for (const f of t.frames.values()) f.roots.clear();
      wake(tabId);
    } else if (message.type === 'bye') {
      t.yo = null;
    }
    if (!('rootId' in message)) {
      for (const f of t.frames.values()) f.port.postMessage(message);
      return;
    }
    const { frameId, rootId } = unscopeRootId(message.rootId);
    const frame = t.frames.get(frameId);
    if (frame) frame.port.postMessage({ ...message, rootId });
    else t.panel?.postMessage({
      type: 'error', protocol: PROTOCOL, requestId: message.requestId,
      message: `weasel devtools: no frame ${frameId} in this tab`,
    } satisfies PageMessage);
  }

  function connectPage(port: PortLike): void {
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) return port.disconnect();
    const frameId = port.sender?.frameId ?? 0;
    const t = tab(tabId);
    t.frames.get(frameId)?.port.disconnect();
    const frame: Frame = { port, roots: new Map() };
    t.frames.set(frameId, frame);
    port.onMessage.addListener((m) => fromPage(t, frameId, frame, m as PageMessage));
    port.onDisconnect.addListener(() => {
      if (t.frames.get(frameId) !== frame) return;
      t.frames.delete(frameId);
      for (const rootId of frame.roots.keys()) {
        t.panel?.postMessage({ type: 'root-removed', protocol: PROTOCOL, rootId } satisfies PageMessage);
      }
      prune(tabId);
    });
    if (t.yo) port.postMessage(t.yo);
  }

  function connectPanel(port: PortLike): void {
    let t: Tab | null = null;
    let tabId = -1;
    port.onMessage.addListener((m) => {
      if (t) return fromPanel(t, tabId, m as PanelMessage);
      if (!isPanelHello(m)) return port.disconnect();
      tabId = m.inspect;
      t = tab(tabId);
      t.panel?.disconnect();
      t.panel = port;
      wake(tabId);
    });
    port.onDisconnect.addListener(() => {
      if (!t || t.panel !== port) return;
      const bye: PanelMessage = { type: 'bye', protocol: t.yo?.protocol ?? PROTOCOL };
      t.panel = null;
      t.yo = null;
      for (const f of t.frames.values()) {
        f.port.postMessage(bye);
        f.port.disconnect();
      }
      t.frames.clear();
      prune(tabId);
    });
  }

  return {
    connect(port) {
      if (port.name === PORT_PAGE) connectPage(port);
      else if (port.name === PORT_PANEL) connectPanel(port);
    },
  };
}
