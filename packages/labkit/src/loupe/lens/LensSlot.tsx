import { useLatest } from '@weasel-js/react';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  type LensResolution,
  type LensSlotProps,
  type LensSource,
  type LensSourceHandle,
  type LensSourceRequest,
  type LensSources,
  LENS_SOURCE_KINDS,
  requestsOf,
  resolveSource,
} from './lensSource';
import type { LensSourceKind } from './lensTypes';

/** Which source a lens shows, re-resolved whenever any source's availability changes. */
export function useLensResolution<C>(
  wanted: LensSourceKind,
  sources: LensSources<C>,
): LensResolution<C> {
  const subscribe = useCallback(
    (listener: () => void) => {
      const offs = LENS_SOURCE_KINDS.map((k) => sources[k]?.subscribe(listener));
      return () => {
        for (const off of offs) off?.();
      };
    },
    [sources],
  );
  // The snapshot only drives a re-render when availability changes; the
  // resolution is read fresh from the sources themselves.
  useSyncExternalStore(subscribe, () =>
    LENS_SOURCE_KINDS.map((k) => String(sources[k]?.status())).join('|'),
  );
  return resolveSource(wanted, sources);
}

function LensCell<C>({
  source,
  request,
}: {
  source: LensSource<C>;
  request: LensSourceRequest<C>;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const handle = useRef<LensSourceHandle<C> | null>(null);
  const latest = useLatest(request);
  const first = useRef(true);
  useEffect(() => {
    if (!el.current) return;
    handle.current = source.attach(el.current, latest.current);
    return () => {
      handle.current?.detach();
      handle.current = null;
      // A remount attaches afresh with the latest request, so its first update is redundant.
      first.current = true;
    };
  }, [source, latest]);
  const { reticle, factor, size, conditions, dpr } = request;
  // `request` is a new object every render, so the effect runs on its fields.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    handle.current?.update(latest.current);
  }, [reticle.x, reticle.y, factor, size.width, size.height, conditions, dpr, latest]);
  return <div ref={el} className="lk-lens-cell" data-dpr={request.dpr} />;
}

/**
 * Attaches the chosen source to the lens's interior. With no source, or one
 * that is unavailable, it says why and falls back to the first that answers.
 */
export function LensSlot<C>({ lens, settings, sources, reticle, size }: LensSlotProps<C>) {
  const { source, reason } = useLensResolution(settings.source, sources);
  const requests = requestsOf(source, lens, settings, reticle, size);
  return (
    <div className="lk-lens-slot">
      {source
        ? requests.map((request) => (
            <LensCell key={`${source.kind}:${request.dpr}`} source={source} request={request} />
          ))
        : null}
      {reason ? <div className="lk-lens-reason">{reason}</div> : null}
    </div>
  );
}
