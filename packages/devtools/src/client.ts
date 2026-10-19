/**
 * The panel's side of the devtools protocol, free of any framework: the
 * handshake, request ids and their replies, the roots the page reports, and
 * its change notices. The views, the extension and tests all drive this.
 */
import {
  DEVTOOLS_PROTOCOL, type DevtoolsArea, type DevtoolsNodeDetail, type DevtoolsNodeSummary,
  type DevtoolsRequest, type DevtoolsRootInfo, type DevtoolsRootState, type DevtoolsTraceSlice,
  type PageMessage, type PanelTransport, type SerializedValue,
} from '@weasel-js/core/devtools';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A request as a caller writes it: the client adds the protocol, the request id and the root. */
export type DevtoolsRequestBody = DistributiveOmit<DevtoolsRequest, 'protocol' | 'requestId' | 'rootId'>;

/** What each request resolves to. */
export interface DevtoolsResultMap {
  'get-children': DevtoolsNodeSummary[];
  'get-node': DevtoolsNodeDetail;
  'get-state': DevtoolsRootState;
  'get-trace': DevtoolsTraceSlice;
  'get-frame': SerializedValue;
  select: null;
  highlight: null;
  'set-tool': null;
  'set-overlays': null;
}

/** Where a connection stands. `error` holds a message the page sent about no request, such as a protocol mismatch. */
export interface DevtoolsClientState {
  status: 'connecting' | 'connected' | 'error' | 'closed';
  kitVersion: string | null;
  roots: readonly DevtoolsRootInfo[];
  error: string | null;
}

export interface DevtoolsClient {
  state(): DevtoolsClientState;
  /** Hear every change to {@link DevtoolsClient.state}. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Hear a root's `changed` notices, with the areas each names. Returns the unsubscribe. */
  onChanged(listener: (rootId: string, areas: DevtoolsArea[]) => void): () => void;
  /** Send `body` about `rootId`. Rejects with the page's message when it refuses. */
  request<B extends DevtoolsRequestBody>(rootId: string, body: B): Promise<DevtoolsResultMap[B['type']]>;
  /** Say `yo` and start listening. Called again after {@link DevtoolsClient.close}, it reconnects. */
  open(): void;
  /** Say `bye` and stop listening. Pending requests reject. */
  close(): void;
}

interface Pending {
  resolve(result: unknown): void;
  reject(err: Error): void;
}

/** A connection over `transport`, sending nothing until it is opened. It is connected once the page says `sup`. */
export function createDevtoolsClient(transport: PanelTransport): DevtoolsClient {
  let state: DevtoolsClientState = { status: 'closed', kitVersion: null, roots: [], error: null };
  const listeners = new Set<() => void>();
  const changeListeners = new Set<(rootId: string, areas: DevtoolsArea[]) => void>();
  const pending = new Map<number, Pending>();
  let nextId = 1;

  const set = (patch: Partial<DevtoolsClientState>): void => {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l();
  };

  const receive = (m: PageMessage): void => {
    if (state.status === 'closed') return;
    switch (m.type) {
      case 'sup':
        set({ status: 'connected', kitVersion: m.kitVersion, roots: m.roots, error: null });
        return;
      case 'root-added':
        set({ roots: [...state.roots.filter((r) => r.id !== m.root.id), m.root] });
        return;
      case 'root-removed':
        set({ roots: state.roots.filter((r) => r.id !== m.rootId) });
        return;
      case 'changed': {
        const areas = Object.keys(m.areas) as DevtoolsArea[];
        for (const l of [...changeListeners]) l(m.rootId, areas);
        return;
      }
      case 'result':
        pending.get(m.requestId)?.resolve(m.result);
        pending.delete(m.requestId);
        return;
      case 'error':
        if (m.requestId === null) {
          set({ status: 'error', error: m.message });
          return;
        }
        pending.get(m.requestId)?.reject(new Error(m.message));
        pending.delete(m.requestId);
        return;
    }
  };

  let off: (() => void) | null = null;

  return {
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    onChanged(listener) {
      changeListeners.add(listener);
      return () => { changeListeners.delete(listener); };
    },
    request(rootId, body) {
      if (state.status === 'closed') return Promise.reject(new Error('the devtools connection is closed'));
      const requestId = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve: resolve as (r: unknown) => void, reject });
        transport.send({ ...body, protocol: DEVTOOLS_PROTOCOL, requestId, rootId } as DevtoolsRequest);
      });
    },
    open() {
      if (off) return;
      off = transport.onMessage(receive);
      set({ status: 'connecting', error: null });
      transport.send({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
    },
    close() {
      if (!off) return;
      transport.send({ type: 'bye', protocol: DEVTOOLS_PROTOCOL });
      off();
      off = null;
      set({ status: 'closed' });
      const err = new Error('the devtools connection is closed');
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    },
  };
}

/** {@link createDevtoolsClient}, opened: it says `yo` at once. */
export function connectDevtools(transport: PanelTransport): DevtoolsClient {
  const client = createDevtoolsClient(transport);
  client.open();
  return client;
}
