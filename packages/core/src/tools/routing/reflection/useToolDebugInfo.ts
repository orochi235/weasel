// src/tools/routing/reflection/useToolDebugInfo.ts
import { useEffect, useState } from 'react';
import type { ToolsDispatcher } from '../../dispatcher';
import type { RouteResolvedInfo } from './route-resolved';

/** Reactive snapshot of the most recently resolved route. Re-renders
 *  the consuming component whenever a new route resolves. Returns null
 *  when no route has resolved yet (or after `cancelGesture()`).
 *
 *  Pass the kit's ToolsDispatcher reference. The hook subscribes via
 *  the dispatcher's existing onRouteResolved option — if the consumer's
 *  dispatcher wasn't constructed with this hook in mind, the consumer
 *  must thread an extra subscription. (Future improvement: kit-shipped
 *  dispatcher context.) */
export function useToolDebugInfo(
  dispatcher: ToolsDispatcher,
): RouteResolvedInfo | null {
  const [info, setInfo] = useState<RouteResolvedInfo | null>(() =>
    dispatcher.getLastRoute(),
  );
  useEffect(() => {
    // Poll-on-tick fallback: the dispatcher's onRouteResolved option is
    // owned by createToolsDispatcher (set once at construction). If the
    // consumer didn't wire it to this hook, we still want some signal.
    // Strategy: use requestAnimationFrame loop while mounted to read
    // getLastRoute(). Cheap (single function call per frame); the kit's
    // event loop is the same one driving renders, so no extra work.
    let raf = 0;
    let last = dispatcher.getLastRoute();
    const tick = (): void => {
      const next = dispatcher.getLastRoute();
      if (next !== last) {
        last = next;
        setInfo(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dispatcher]);
  return info;
}
