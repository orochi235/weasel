import { useLatest } from '@weasel-js/react';
import { type CSSProperties, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { type LensSide, lensSides, splitRects } from './compare';
import { paintDifference } from './difference';
import {
  type LensCapture,
  type LensResolution,
  type LensSlotProps,
  type LensSource,
  type LensSourceHandle,
  type LensSourceRequest,
  type LensSources,
  LENS_SOURCE_KINDS,
  requestsOf,
  resolveSource,
  shownSource,
  unavailableText,
} from './lensSource';
import type { LensSettings, LensSourceKind } from './lensTypes';

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

/** What a lens shows (`shownSource`), re-resolved whenever any source's availability changes. */
export function useShownSource<C>(settings: LensSettings<C>, sources: LensSources<C>): LensResolution<C> {
  useLensResolution(settings.source, sources);
  return shownSource(settings, sources);
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

/** The seam's offset in the interior, as a custom property the stylesheet clips each side by. */
function seamStyle(x: number): CSSProperties {
  return { ['--lk-lens-seam' as string]: `${x}px` } as CSSProperties;
}

/** How long a Difference lens waits, after anything changes, before capturing again. */
export const RECAPTURE_REST_MS = 250;

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * The Difference view: a Pixels capture of the story as it is and one under
 * the comparison, whatever the lens's own source, with the pixels that differ
 * lit. A DOM render has no pixels, so without a Pixels source it says why.
 */
function LensDifference<C>({ lens, settings, sources, reticle, size }: LensSlotProps<C>) {
  const pixels = sources.pixels;
  const subscribe = useCallback((fn: () => void) => pixels?.subscribe(fn) ?? (() => {}), [pixels]);
  const status = useSyncExternalStore(subscribe, () => pixels?.status() ?? 'not provided');
  // Bumped by anything the source says may have changed, such as the story under the reticle.
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((n) => n + 1)), [subscribe]);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [said, say] = useState<string | null>(null);
  const started = useRef(false);
  const latest = useLatest({ reticle, size });
  const dpr = settings.dprs[0] ?? 1;
  const { compare, factor } = settings;
  const { lensId } = lens;
  useEffect(() => {
    const el = canvas.current;
    if (status !== true || !pixels?.capture || !el) return;
    const { reticle: at, size: box } = latest.current;
    const base: LensSourceRequest<C> = { lensId, reticle: at, factor, size: box, conditions: null, dpr };
    const capture = pixels.capture.bind(pixels);
    let live = true;
    const run = () =>
      Promise.all([capture(base), capture({ ...base, conditions: compare })])
        .then(([a, b]) => {
          if (!live) return;
          const missing = 'reason' in a ? a : 'reason' in b ? b : null;
          if (missing) {
            say(missing.reason);
            return;
          }
          paintDifference(el, a as LensCapture, b as LensCapture, { size: box, factor });
          say(null);
        })
        .catch((err: unknown) => {
          if (live) say(messageOf(err));
        });
    // At once the first time; after that, once whatever moved has come to rest.
    const timer = setTimeout(run, started.current ? RECAPTURE_REST_MS : 0);
    started.current = true;
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [pixels, status, lensId, reticle.x, reticle.y, size.width, size.height, factor, compare, dpr, tick, latest]);
  const reason = status === true ? said : unavailableText('pixels', status);
  // A message stands in for the image: what was drawn before it no longer answers.
  useEffect(() => {
    const el = canvas.current;
    if (reason !== null && el) el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
  }, [reason]);
  return (
    <div className="lk-lens-slot" data-view="difference">
      <canvas ref={canvas} className="lk-lens-difference" hidden={reason !== null} />
      {reason ? <div className="lk-lens-reason">{reason}</div> : null}
    </div>
  );
}

/**
 * Attaches the chosen source to the lens's interior: the story as it is, the
 * compared render (Swap), or both (Split), each side the whole interior clipped
 * to its half of the seam so the two line up. With no source, or one that is
 * unavailable, it says why and falls back to the first that answers.
 */
export function LensSlot<C>(props: LensSlotProps<C>) {
  const { lens, settings, sources, reticle, size } = props;
  const { source, reason } = useLensResolution(settings.source, sources);
  if (settings.compare !== null && settings.view === 'difference') return <LensDifference {...props} />;
  const requests = requestsOf(source, lens, settings, reticle, size);
  const sides = lensSides(settings);
  const split = sides.length > 1;
  const { seamX } = splitRects({ x: 0, y: 0, w: size.width, h: size.height }, settings.seam);
  const sideRequests = (side: LensSide) =>
    side === 'base' ? requests.map((r) => ({ ...r, conditions: null })) : requests;
  return (
    <div
      className="lk-lens-slot"
      data-view={split ? 'split' : undefined}
      style={split ? seamStyle(seamX) : undefined}
    >
      {source
        ? sides.map((side) => (
            <div key={side} className="lk-lens-side" data-side={side}>
              {sideRequests(side).map((request) => (
                <LensCell key={`${source.kind}:${request.dpr}`} source={source} request={request} />
              ))}
            </div>
          ))
        : null}
      {split ? <div className="lk-lens-seam" /> : null}
      {reason ? <div className="lk-lens-reason">{reason}</div> : null}
    </div>
  );
}
