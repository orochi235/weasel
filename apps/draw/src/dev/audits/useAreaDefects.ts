import { useEffect, useState } from 'react';
import { SKULK_AREA_PATH } from './skulkMapRoute';
import type { AuditAreaRound } from './skulkMap.types';

export type AreaDefectsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly rounds: readonly AuditAreaRound[] }
  | { readonly status: 'failed'; readonly error: string };

/** Every round's defects in area `id` from draw's dev server, asked for again whenever `version` changes. */
export function useAreaDefects(id: string, version: string): AreaDefectsState {
  const [state, setState] = useState<{ key: string; value: AreaDefectsState }>({ key: '', value: { status: 'loading' } });
  const key = `${id}\n${version}`;
  useEffect(() => {
    let live = true;
    const url = `${import.meta.env.BASE_URL}${SKULK_AREA_PATH}?id=${encodeURIComponent(id)}`;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
        const rounds: unknown = await res.json();
        if (!Array.isArray(rounds)) throw new Error('the dev server answered something other than a list of rounds');
        return rounds as AuditAreaRound[];
      })
      .then((rounds) => live && setState({ key, value: { status: 'ready', rounds } }),
        (e: Error) => live && setState({ key, value: { status: 'failed', error: e.message } }));
    return () => { live = false; };
  }, [id, key]);
  // A new area shows as loading rather than the last one's list.
  return state.key === key || state.value.status === 'ready' && state.key.startsWith(`${id}\n`) ? state.value : { status: 'loading' };
}
