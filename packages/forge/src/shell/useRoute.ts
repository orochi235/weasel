import { useCallback, useEffect, useState } from 'react';

/** The story id `#/<id>` names, or null. */
export function readRoute(): string | null {
  const { hash } = location;
  if (!hash.startsWith('#/')) return null;
  return decodeURIComponent(hash.slice(2)) || null;
}

/** The story the URL names, and a way to name another. */
export function useRoute(): [string | null, (id: string) => void] {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = (): void => setRoute(readRoute());
    window.addEventListener('hashchange', sync);
    sync();
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const go = useCallback((id: string) => {
    const hash = `#/${encodeURIComponent(id)}`;
    if (readRoute() === id) history.replaceState(null, '', hash);
    else location.hash = hash;
  }, []);
  return [route, go];
}
