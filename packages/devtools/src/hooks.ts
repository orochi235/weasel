/** The React side of a connection: the client a panel holds, the data it reads per root, and its polls. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { DevtoolsArea, PanelTransport } from './protocol';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import { coalesced } from './views/coalesced';
import { createDevtoolsClient, type DevtoolsClient, type DevtoolsClientState } from './client';

/** A connection over `transport` for as long as the component is mounted: `yo` on mount, `bye` on unmount. */
export function useDevtoolsClient(transport: PanelTransport): { client: DevtoolsClient; state: DevtoolsClientState } {
  const client = useMemo(() => createDevtoolsClient(transport), [transport]);
  useEffect(() => {
    client.open();
    return () => client.close();
  }, [client]);
  const state = useSyncExternalStore(client.subscribe, client.state);
  return { client, state };
}

/** What a view reads about one root: the last answer, or the page's refusal. */
export interface RootQuery<T> {
  data: T | undefined;
  error: string | null;
  /** Ask again now, as after a steering request whose effect no notice reports. */
  refresh(): void;
}

/**
 * `read`'s answer about `rootId`, asked again whenever a `changed` notice for
 * that root names one of `areas`, `refresh` is called, or a dependency in `deps`
 * changes. One read is out at a time: asking while one is out reads once more
 * after it answers, so a read slower than its asking is still shown.
 */
export function useRootQuery<T>(
  client: DevtoolsClient,
  rootId: string,
  areas: readonly DevtoolsArea[],
  read: () => Promise<T>,
  deps: readonly unknown[] = [],
): RootQuery<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const readRef = useLatest(read);
  const again = useRef<() => void>(() => {});
  const areaKey = areas.join(',');

  useEffect(() => {
    let live = true;
    const ask = coalesced(() => (!live ? Promise.resolve() : readRef.current().then(
      (result) => { if (live) { setData(result); setError(null); } },
      (err: Error) => { if (live) setError(err.message); },
    )));
    again.current = ask;
    ask();
    const wanted = areaKey.split(',');
    const off = client.onChanged((id, changed) => {
      if (id === rootId && changed.some((a) => wanted.includes(a))) ask();
    });
    return () => { live = false; again.current = () => {}; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's
  }, [client, rootId, areaKey, readRef, ...deps]);

  const refresh = useRef(() => again.current()).current;
  return { data, error, refresh };
}

/** Call `tick` every `ms` while `enabled` and the page is visible, and once at the start. */
export function usePoll(tick: () => void, ms: number, enabled: boolean): void {
  const tickRef = useLatest(tick);
  const last = useRef(-Infinity);
  const loop = useVisibleRaf((time, l) => {
    if (time - last.current >= ms) {
      last.current = time;
      tickRef.current();
    }
    l.request();
  });
  useEffect(() => {
    if (!enabled) return;
    last.current = -Infinity;
    loop.request();
    return () => loop.cancel();
  }, [enabled, loop]);
}
