import { useLatest } from '@weasel-js/react';
import { useEffect, useRef, useState } from 'react';
import type { LensCapture, LensSource, LensSourceRequest } from './lensSource';
import { drawPixelGrid, readBitmap, softEdgeMask } from './pixelGrid';

/** How long the grid waits, after anything changes, before it asks for the capture again. */
const REST_MS = 250;

interface Read {
  capture: LensCapture;
  mask: Uint8Array | null;
  columns: number;
}

const masks = new WeakMap<ImageBitmap, { mask: Uint8Array; columns: number } | null>();

function maskOf(bitmap: ImageBitmap): { mask: Uint8Array; columns: number } | null {
  if (masks.has(bitmap)) return masks.get(bitmap) ?? null;
  const img = readBitmap(bitmap);
  const read = img ? { mask: softEdgeMask(img), columns: img.width } : null;
  masks.set(bitmap, read);
  return read;
}

function colorOf(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * The Pixel grid over one cell of a Pixels lens: a line on every boundary
 * between the capture's pixels, and a tint on each pixel that blends its
 * neighbors. It asks the source for the same capture the cell shows, so it
 * lines up with it.
 */
export function GridCanvas<C>({ source, request }: { source: LensSource<C>; request: LensSourceRequest<C> }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useLatest(request);
  const started = useRef(false);
  const { reticle, factor, size, conditions, dpr } = request;
  const { width: w, height: h } = size;
  useEffect(() => source.subscribe(() => setTick((n) => n + 1)), [source]);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () => {
        void source.capture?.(latest.current).then((got) => {
          if (!live) return;
          if ('reason' in got) {
            setRead(null);
            return;
          }
          const m = maskOf(got.bitmap);
          setRead({ capture: got, mask: m?.mask ?? null, columns: m?.columns ?? 0 });
        });
      },
      started.current ? REST_MS : 0,
    );
    started.current = true;
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [source, reticle.x, reticle.y, factor, w, h, conditions, dpr, tick, latest]);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const sd = el.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    const width = Math.max(1, Math.round(w * sd));
    const height = Math.max(1, Math.round(h * sd));
    if (el.width !== width) el.width = width;
    if (el.height !== height) el.height = height;
    ctx.setTransform(sd, 0, 0, sd, 0, 0);
    const view = { factor, dpr, columns: read?.columns ?? 0, size: { width: w, height: h } };
    if (!read) {
      ctx.clearRect(0, 0, w, h);
      return;
    }
    // Where the lens puts the capture's first pixel, rounded to a device pixel as it is.
    const origin = {
      x: Math.round(width / 2 - read.capture.at.x * factor * sd) / sd,
      y: Math.round(height / 2 - read.capture.at.y * factor * sd) / sd,
    };
    drawPixelGrid(ctx, { ...view, origin }, read.mask, {
      line: colorOf(el, '--wzl-fg', '#ffffff'),
      tint: colorOf(el, '--wzl-accent', '#4c8dff'),
    });
  }, [read, factor, dpr, w, h]);
  return <canvas ref={canvas} className="lk-lens-grid" />;
}
