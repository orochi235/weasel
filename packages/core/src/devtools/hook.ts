/**
 * The devtools hook: the page-wide registry of roots a panel connects to,
 * published as `window.__weaselDevtools__`.
 */
import { createEmitter } from '@weasel-js/registry';
import { VERSION } from '../version';
import { DEVTOOLS_PROTOCOL, type DevtoolsRootInfo, type PanelMessage } from './protocol';
import type { DevtoolsRoot } from './root';
import { openSession, type DevtoolsSchedule, type SessionHost } from './session';
import { createWindowPageTransport, isDevtoolsEnvelope, type PageTransport } from './transport';

export interface WeaselDevtoolsHook {
  readonly protocol: number;
  readonly kitVersion: string;
  roots(): DevtoolsRootInfo[];
  /** The root registered under `id`, for in-page readers such as the test hook. */
  root(id: string): DevtoolsRoot | undefined;
  /** Add a canvas's root. Returns its removal. */
  register(root: DevtoolsRoot): () => void;
  /** Serve a panel over `transport` until the panel says `bye` or the returned close is called.
   *  `opening` is a message that arrived before the transport was listened to — the `yo` that
   *  prompted the connection. */
  connect(transport: PageTransport, opening?: PanelMessage): () => void;
}

declare global {
  interface Window {
    __weaselDevtools__?: WeaselDevtoolsHook;
  }
}

/** Waits for the next frame: the one-shot callback coalesces notices, it never loops. */
const nextFrame: DevtoolsSchedule = (flush) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => flush());
  else setTimeout(flush, 16);
};

/** A hook not published anywhere: what {@link installDevtoolsHook} publishes, and what tests build. */
export function createDevtoolsHook(opts: { schedule?: DevtoolsSchedule } = {}): WeaselDevtoolsHook {
  const live = new Map<string, DevtoolsRoot>();
  const rootEvents = createEmitter<[{ added: DevtoolsRoot } | { removed: string }]>();
  const host: SessionHost = {
    roots: () => [...live.values()],
    root: (id) => live.get(id),
    onRoots: (listener) => rootEvents.subscribe(listener),
    schedule: opts.schedule ?? nextFrame,
  };
  return {
    protocol: DEVTOOLS_PROTOCOL,
    kitVersion: VERSION,
    roots: () => [...live.values()].map((r) => r.info()),
    root: (id) => live.get(id),
    register(root) {
      live.set(root.id, root);
      rootEvents.emit({ added: root });
      return () => {
        if (live.get(root.id) !== root) return;
        live.delete(root.id);
        rootEvents.emit({ removed: root.id });
      };
    },
    connect(transport, opening) {
      const session = openSession(host, transport);
      const off = transport.onMessage((m) => session.receive(m));
      if (opening) session.receive(opening);
      return () => { off(); session.close(); };
    },
  };
}

/** Serve the one window-transport panel there can be: a `yo` posted to the window opens it, replacing any before. */
function serveWindow(hook: WeaselDevtoolsHook): void {
  const transport = createWindowPageTransport();
  let close: (() => void) | null = null;
  window.addEventListener('message', (e) => {
    if (!isDevtoolsEnvelope(e.data) || e.data.side !== 'panel' || e.data.message.type !== 'yo') return;
    close?.();
    close = hook.connect(transport, e.data.message as PanelMessage);
  });
}

/** Publish the hook on `window.__weaselDevtools__`, once; later calls return the same hook. */
export function installDevtoolsHook(): WeaselDevtoolsHook | null {
  if (typeof window === 'undefined') return null;
  if (window.__weaselDevtools__) return window.__weaselDevtools__;
  const hook = createDevtoolsHook();
  window.__weaselDevtools__ = hook;
  serveWindow(hook);
  return hook;
}
