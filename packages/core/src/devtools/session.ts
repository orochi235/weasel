/**
 * One panel's connection to the page: the handshake, every request, the
 * change notices, and the overrides the panel holds, which go when it does.
 */
import { VERSION } from '../version';
import { answer } from './handlers';
import { createNotices, type DevtoolsSchedule } from './notices';
import {
  DEVTOOLS_PROTOCOL, type DevtoolsOverlays, type DevtoolsResult, type PageMessage, type PanelMessage,
} from './protocol';
import type { DevtoolsRoot } from './root';
import type { PageTransport } from './transport';

export type { DevtoolsSchedule };

/** What a session needs from the hook. */
export interface SessionHost {
  roots(): readonly DevtoolsRoot[];
  root(id: string): DevtoolsRoot | undefined;
  /** Hear roots come and go. Returns the unsubscribe. */
  onRoots(listener: (event: { added: DevtoolsRoot } | { removed: string }) => void): () => void;
  schedule: DevtoolsSchedule;
}

export interface DevtoolsSession {
  receive(message: PanelMessage): void;
  close(): void;
}

/** What one panel lays over one canvas. */
export interface Override {
  overlays: DevtoolsOverlays;
  highlight: readonly string[];
}

export function openSession(host: SessionHost, transport: PageTransport): DevtoolsSession {
  const send = (m: PageMessage): void => transport.send(m);
  const fail = (requestId: number | null, message: string): void =>
    send({ type: 'error', protocol: DEVTOOLS_PROTOCOL, requestId, message });

  let greeted = false;
  let closed = false;
  const notices = createNotices(host.root, host.schedule, (m) => { if (!closed) send(m); });
  const overrides = new Map<string, Override>();

  const dropOverride = (rootId: string): void => {
    if (overrides.delete(rootId)) host.root(rootId)?.source.setOverride(null);
  };

  const steer = (root: DevtoolsRoot, change: Partial<Override>): void => {
    const prev = overrides.get(root.id) ?? { overlays: {}, highlight: [] };
    const next: Override = {
      overlays: change.overlays ? { ...prev.overlays, ...change.overlays } : prev.overlays,
      highlight: change.highlight ?? prev.highlight,
    };
    overrides.set(root.id, next);
    root.source.setOverride(next);
  };

  const offRoots = host.onRoots((event) => {
    if (!greeted) return;
    if ('added' in event) {
      notices.follow(event.added);
      send({ type: 'root-added', protocol: DEVTOOLS_PROTOCOL, root: event.added.info() });
    } else {
      notices.unfollow(event.removed);
      dropOverride(event.removed);
      send({ type: 'root-removed', protocol: DEVTOOLS_PROTOCOL, rootId: event.removed });
    }
  });

  const close = (): void => {
    if (closed) return;
    closed = true;
    offRoots();
    for (const rootId of notices.ids()) notices.unfollow(rootId);
    for (const rootId of [...overrides.keys()]) dropOverride(rootId);
  };

  const greet = (): void => {
    greeted = true;
    for (const root of host.roots()) notices.follow(root);
    send({ type: 'sup', protocol: DEVTOOLS_PROTOCOL, kitVersion: VERSION, roots: host.roots().map((r) => r.info()) });
  };

  return {
    receive(message) {
      if (closed) return;
      const requestId = 'requestId' in message ? message.requestId : null;
      if (message.protocol !== DEVTOOLS_PROTOCOL) {
        fail(requestId, `protocol mismatch: the page speaks ${DEVTOOLS_PROTOCOL}, the panel ${String(message.protocol)}`);
        return;
      }
      if (message.type === 'yo') return greet();
      if (message.type === 'bye') return close();
      if (!greeted) return fail(requestId, 'send yo before any request');
      const root = host.root(message.rootId);
      if (!root) return fail(requestId, `no root "${message.rootId}"`);
      let result: DevtoolsResult;
      try {
        result = answer(root, message, (change) => steer(root, change));
      } catch (err) {
        return fail(requestId, (err as Error).message);
      }
      send({ type: 'result', protocol: DEVTOOLS_PROTOCOL, requestId: message.requestId, result });
    },
    close,
  };
}
