/**
 * One panel's connection to the page: the handshake, every request, the
 * coalesced change notices, and the overrides the panel holds, which go when
 * it does.
 */
import { VERSION } from '../version';
import { childrenOf, nodeDetail, rootState, traceSlice } from './handlers';
import {
  DEVTOOLS_PROTOCOL,
  type DevtoolsArea, type DevtoolsOverlays, type DevtoolsRequest, type DevtoolsResult,
  type DevtoolsRootInfo, type PageMessage, type PanelMessage,
} from './protocol';
import type { DevtoolsRoot } from './root';
import { serialize } from './serialize';
import type { PageTransport } from './transport';

/** Run `flush` once, soon. The hook's default waits for the next animation frame. */
export type DevtoolsSchedule = (flush: () => void) => void;

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

interface Override {
  overlays: DevtoolsOverlays;
  highlight: readonly string[];
}

export function openSession(host: SessionHost, transport: PageTransport): DevtoolsSession {
  const send = (m: PageMessage): void => transport.send(m);
  const fail = (requestId: number | null, message: string): void =>
    send({ type: 'error', protocol: DEVTOOLS_PROTOCOL, requestId, message });

  let greeted = false;
  let closed = false;
  const overrides = new Map<string, Override>();
  /** Per root: the release of its trace watches and change subscription. */
  const following = new Map<string, () => void>();
  const pending = new Map<string, Set<DevtoolsArea>>();
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    if (closed) return;
    for (const [rootId, areas] of pending) {
      const root = host.root(rootId);
      if (!root) continue;
      const versions: Partial<Record<DevtoolsArea, number>> = {};
      for (const area of areas) versions[area] = root.version(area);
      send({ type: 'changed', protocol: DEVTOOLS_PROTOCOL, rootId, areas: versions });
    }
    pending.clear();
  };

  const follow = (root: DevtoolsRoot): void => {
    if (following.has(root.id)) return;
    const releaseTrace = root.source.trace.watch();
    const releaseCoords = root.source.coords.watch();
    const off = root.subscribe((area) => {
      let areas = pending.get(root.id);
      if (!areas) pending.set(root.id, (areas = new Set()));
      areas.add(area);
      if (!scheduled) {
        scheduled = true;
        host.schedule(flush);
      }
    });
    following.set(root.id, () => { releaseTrace(); releaseCoords(); off(); });
  };

  const unfollow = (rootId: string): void => {
    following.get(rootId)?.();
    following.delete(rootId);
    pending.delete(rootId);
    if (overrides.delete(rootId)) host.root(rootId)?.source.setOverride(null);
  };

  const infoOf = (root: DevtoolsRoot): DevtoolsRootInfo => root.info();

  const offRoots = host.onRoots((event) => {
    if (!greeted) return;
    if ('added' in event) {
      follow(event.added);
      send({ type: 'root-added', protocol: DEVTOOLS_PROTOCOL, root: infoOf(event.added) });
    } else {
      unfollow(event.removed);
      send({ type: 'root-removed', protocol: DEVTOOLS_PROTOCOL, rootId: event.removed });
    }
  });

  const steer = (root: DevtoolsRoot, change: Partial<Override>): null => {
    const prev = overrides.get(root.id) ?? { overlays: {}, highlight: [] };
    const next: Override = {
      overlays: change.overlays ? { ...prev.overlays, ...change.overlays } : prev.overlays,
      highlight: change.highlight ?? prev.highlight,
    };
    overrides.set(root.id, next);
    root.source.setOverride(next);
    return null;
  };

  const answer = (root: DevtoolsRoot, req: DevtoolsRequest): DevtoolsResult => {
    switch (req.type) {
      case 'get-children': return childrenOf(root, req.nodeId);
      case 'get-node': return nodeDetail(root, req.nodeId);
      case 'get-state': return rootState(root);
      case 'get-trace': return traceSlice(root, req.cursor, req.coordCursor);
      case 'get-frame': return serialize(root.source.frame());
      case 'select':
        root.source.select(req.ids);
        return null;
      case 'set-tool':
        if (req.toolId !== null && !root.source.tools().includes(req.toolId)) {
          throw new Error(`no tool "${req.toolId}"`);
        }
        root.source.setTool(req.toolId);
        return null;
      case 'highlight': return steer(root, { highlight: [...req.ids] });
      case 'set-overlays': return steer(root, { overlays: req.overlays });
    }
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    offRoots();
    for (const rootId of [...following.keys()]) unfollow(rootId);
    for (const rootId of [...overrides.keys()]) host.root(rootId)?.source.setOverride(null);
    overrides.clear();
  };

  return {
    receive(message) {
      if (closed) return;
      const requestId = 'requestId' in message ? message.requestId : null;
      if (message.protocol !== DEVTOOLS_PROTOCOL) {
        fail(requestId, `protocol mismatch: the page speaks ${DEVTOOLS_PROTOCOL}, the panel ${String(message.protocol)}`);
        return;
      }
      if (message.type === 'yo') {
        greeted = true;
        for (const root of host.roots()) follow(root);
        send({
          type: 'sup', protocol: DEVTOOLS_PROTOCOL, kitVersion: VERSION, roots: host.roots().map(infoOf),
        });
        return;
      }
      if (message.type === 'bye') {
        close();
        return;
      }
      if (!greeted) {
        fail(requestId, 'send yo before any request');
        return;
      }
      const root = host.root(message.rootId);
      if (!root) {
        fail(requestId, `no root "${message.rootId}"`);
        return;
      }
      let result: DevtoolsResult;
      try {
        result = answer(root, message);
      } catch (err) {
        fail(requestId, (err as Error).message);
        return;
      }
      send({ type: 'result', protocol: DEVTOOLS_PROTOCOL, requestId: message.requestId, result });
    },
    close,
  };
}
