/// <reference path="../css-modules.d.ts" />
/**
 * The reason an in-flight gesture cannot land where it is, beside the pointer:
 * the DOM half of the `reason` overlay, which the canvas layers cannot paint
 * as text.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { canvasToClient, overlaysOf, type Dispatcher } from '@weasel-js/routing';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { resolveOverlays } from 'interactions/actions/resolveOverlays';
import { useOptionalViewRegistry } from './viewRegistry';
import s from './GestureReason.module.css';

const NO_SUBSCRIBE = () => () => {};
const NO_VERSION = () => 0;

/** How far below and right of the pointer the reason sits, in CSS pixels. */
const OFFSET = 14;
/** How far apart the two placements that measure the tag's frame are, in its own pixels. */
const PROBE = 1000;

export interface GestureReasonProps {
  dispatcher: Dispatcher | null | undefined;
  canvasRef: RefObject<HTMLElement | null>;
  viewRef: RefObject<View>;
}

/** The pointer's client point, and what to say there. */
interface Shown { x: number; y: number; text: string }

/** Where one dispatcher's gestures are, on the canvas: a world point in the canvas's CSS px. */
interface Source { dispatcher: Dispatcher; toCanvas: (x: number, y: number) => { x: number; y: number } }

/** The first `reason` overlay of the in-flight gestures, shown beside the pointer: the surface's, then each
 *  `<CanvasView>`'s, each placed through the camera of the view it runs in. */
export function GestureReason({ dispatcher, canvasRef, viewRef }: GestureReasonProps) {
  const [shown, setShown] = useState<Shown | null>(null);
  const registry = useOptionalViewRegistry();
  const views = useSyncExternalStore(registry?.subscribe ?? NO_SUBSCRIBE, registry?.getVersion ?? NO_VERSION);
  useEffect(() => {
    const sources: Source[] = [];
    if (dispatcher) {
      sources.push({ dispatcher, toCanvas: (x, y) => {
        const [sx, sy] = worldToScreen(x, y, viewToTransform(viewRef.current));
        return { x: sx, y: sy };
      } });
    }
    for (const r of registry?.list() ?? []) sources.push({ dispatcher: r.target.dispatcher, toCanvas: r.worldToCanvas });
    if (sources.length === 0) return;
    const read = () => {
      const canvas = canvasRef.current;
      if (!canvas || !viewRef.current) {
        setShown(null);
        return;
      }
      for (const source of sources) {
        const all = [...source.dispatcher.inFlight().values()].flatMap((h) => [...overlaysOf(h)]);
        const reason = resolveOverlays(all).find((o) => o.kind === 'reason');
        if (reason?.kind !== 'reason') continue;
        const at = source.toCanvas(reason.at.x, reason.at.y);
        const [x, y] = canvasToClient(canvas, at.x, at.y);
        setShown({ x, y, text: reason.text });
        return;
      }
      setShown(null);
    };
    read();
    const offs = sources.map((source) => source.dispatcher.subscribe(read));
    return () => {
      for (const off of offs) off();
      setShown(null);
    };
  }, [dispatcher, canvasRef, viewRef, registry, views]);
  const tagRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (tagRef.current && shown) placeFixedAt(tagRef.current, shown.x, shown.y);
  }, [shown]);
  if (shown === null) return null;
  return <div ref={tagRef} role="status" className={s.reason}>{shown.text}</div>;
}

/**
 * Puts a `position: fixed` element `OFFSET` of its own pixels below and right of a client point.
 * A transformed ancestor makes itself the element's containing block, so `left`/`top` are read in
 * that ancestor's offset, scaled frame: the element is measured at two positions to find that frame,
 * since a scale read off `offsetWidth` is rounded. The pointer moves it every frame; nothing but an
 * inline position can follow it.
 */
function placeFixedAt(el: HTMLElement, x: number, y: number): void {
  const at = (left: number, top: number) => {
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    return el.getBoundingClientRect();
  };
  const far = at(PROBE, PROBE);
  const origin = at(0, 0);
  const kx = (far.left - origin.left) / PROBE || 1;
  const ky = (far.top - origin.top) / PROBE || 1;
  at((x - origin.left) / kx + OFFSET, (y - origin.top) / ky + OFFSET);
}
