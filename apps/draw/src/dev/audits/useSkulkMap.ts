import { useEffect, useState } from 'react';
import { after } from '@weasel-js/registry';
import { SKULK_MAP_PATH } from './skulkMapRoute';
import type { SkulkMap } from './skulkMap.types';

export type SkulkMapState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly map: SkulkMap; readonly error?: string }
  | { readonly status: 'failed'; readonly error: string }
  /** No dev server answers the route: a build, or a server without the plugin. */
  | { readonly status: 'no-server' };

/** How often the page asks again. Each ask runs `map.mjs`, which asks onto for its running jobs. */
export const POLL_MS = 15_000;

export interface UseSkulkMapOptions {
  readonly url?: string;
  readonly everyMs?: number;
  /** Whether a dev server can be there at all; a build has none. */
  readonly dev?: boolean;
}

/**
 * The audit map's data from the dev server, asked for again every `everyMs` while the page is visible, and at
 * once when it becomes visible again. A failed ask keeps the last map it had and says why.
 */
export function useSkulkMap(options: UseSkulkMapOptions = {}): SkulkMapState {
  const { url = `${import.meta.env.BASE_URL}${SKULK_MAP_PATH}`, everyMs = POLL_MS, dev = import.meta.env.DEV } = options;
  const [state, setState] = useState<SkulkMapState>(dev ? { status: 'loading' } : { status: 'no-server' });
  useEffect(() => {
    if (!dev) return;
    let live = true;
    let stop = () => {};
    let asking = false;
    const noServer = () =>
      setState((was) => (was.status === 'ready' ? { ...was, error: 'the dev server no longer answers the route' } : { status: 'no-server' }));
    const ask = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!live) return;
        // Vite answers a route no plugin serves with its index.html fallback, not a 404.
        if (res.status === 404 || res.headers.get('content-type')?.includes('text/html')) return noServer();
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
        const map = (await res.json()) as SkulkMap;
        if (live) setState({ status: 'ready', map });
      } catch (e) {
        if (!live) return;
        const error = (e as Error).message;
        setState((was) => (was.status === 'ready' ? { ...was, error } : { status: 'failed', error }));
      }
    };
    const loop = () => {
      if (!live || document.hidden) return;
      asking = true;
      void ask().finally(() => {
        asking = false;
        if (live) stop = after(everyMs, loop);
      });
    };
    const onVisible = () => {
      if (document.hidden || asking) return;
      stop();
      loop();
    };
    document.addEventListener('visibilitychange', onVisible);
    loop();
    return () => {
      live = false;
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, everyMs, dev]);
  return state;
}
