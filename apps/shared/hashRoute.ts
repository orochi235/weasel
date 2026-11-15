import { useEffect, useState } from 'react';

/** The route a `#/route` hash names among `routes`, else `fallback`. */
export function hashRoute<R extends string>(hash: string, routes: readonly R[], fallback: R): R {
  const named = hash.replace(/^#\/?/, '');
  return (routes as readonly string[]).includes(named) ? (named as R) : fallback;
}

/** The route the page's `#/route` hash names, following the hash as it changes. */
export function useHashRoute<R extends string>(routes: readonly R[], fallback: R): R {
  const [route, setRoute] = useState<R>(() => hashRoute(window.location.hash, routes, fallback));
  useEffect(() => {
    const onHash = () => setRoute(hashRoute(window.location.hash, routes, fallback));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [routes, fallback]);
  return route;
}
